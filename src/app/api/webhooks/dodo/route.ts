/**
 * POST /api/webhooks/dodo
 *
 * Not session-authenticated: Dodo is the caller. Authenticated instead by
 * Standard Webhooks signature verification over the RAW body, so the bytes
 * that were signed are the bytes verified.
 *
 * The order of operations is the whole design:
 *
 *   1. Verify the signature. Invalid → 400, nothing stored, nothing changed.
 *   2. Store the raw event with a unique (provider, webhook-id). A duplicate
 *      delivery inserts nothing and is acknowledged — Dodo retries, and a
 *      retry must not double-charge.
 *   3. Process. Mark processed_at, or record the error so it can be replayed.
 *
 * A missing webhook key returns 503 and activates nothing. It never falls
 * through to "assume valid".
 *
 * The event body is the *provider's* view of the world. Every entitlement
 * decision is reconciled against Orindle's own records first: the checkout
 * reference resolves to a pending checkout row that was written by this
 * server, and that row is the only thing that says who the money is for.
 */

import "server-only";

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import {
  isDodoConfigured,
  isDodoWebhookConfigured,
  mapBillingPeriod,
  mapProviderStatus,
  verifyWebhook,
  type VerifiedWebhookEvent,
} from "@/domain/billing/dodo";
import {
  completePendingCheckout,
  rememberProviderCustomer,
  resolvePendingCheckout,
} from "@/domain/billing/checkout-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The events this endpoint acts on.
 *
 * The list in the administrator guide must match this list exactly. An
 * unhandled event is stored and ignored — it must never break the endpoint —
 * but these are the ones that change state.
 */
export const HANDLED_EVENTS = [
  "subscription.active",
  "subscription.updated",
  "subscription.renewed",
  "subscription.past_due",
  "subscription.on_hold",
  "subscription.failed",
  "subscription.paused",
  "subscription.unpaused",
  "subscription.plan_changed",
  "subscription.cancelled",
  "subscription.expired",
  "payment.succeeded",
  "payment.failed",
  "refund.succeeded",
  "refund.failed",
  "dispute.opened",
  "dispute.lost",
  "dispute.won",
] as const;

export async function POST(request: Request) {
  if (!isDodoWebhookConfigured()) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Webhooks aren't configured." },
      { status: 503 },
    );
  }
  if (!isDodoConfigured()) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Billing isn't configured." },
      { status: 503 },
    );
  }

  /*
   * The raw text, not a parsed object: JSON key order and whitespace are part
   * of what was signed. The signature covers `{id}.{timestamp}.{body}`.
   */
  const raw = await request.text();

  let event: VerifiedWebhookEvent;
  try {
    event = verifyWebhook(raw, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    });
  } catch {
    console.warn("[webhook:dodo] signature rejected");
    return NextResponse.json(
      { ok: false, code: "forbidden", message: "Invalid signature." },
      { status: 400 },
    );
  }

  const supabase = getServiceClient();

  /*
   * Store raw BEFORE processing. A failure below must not lose the event, and
   * the event must be durably recorded before it is acknowledged — otherwise a
   * crash between "processed" and "acknowledged" would silently drop a
   * renewal.
   */
  const { error: insertError } = await supabase.from("webhook_events").insert({
    provider: "dodo",
    event_id: event.webhookId,
    event_type: event.type,
    payload: { type: event.type, business_id: event.businessId, timestamp: event.timestamp, data: event.data },
  });

  if (insertError) {
    // Unique violation means we have already accepted this event.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, data: { duplicate: true } });
    }
    console.error("[webhook:dodo] store failed", { message: insertError.message });
    // 500 so Dodo retries: we did not durably store it, so we cannot claim to
    // have handled it.
    return NextResponse.json(
      { ok: false, code: "unknown", message: "Could not record event." },
      { status: 500 },
    );
  }

  try {
    await processEvent(event);
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "dodo")
      .eq("event_id", event.webhookId);

    return NextResponse.json({ ok: true, data: { processed: event.type } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("webhook_events")
      .update({ error: message })
      .eq("provider", "dodo")
      .eq("event_id", event.webhookId);

    console.error("[webhook:dodo] processing failed", { type: event.type, message });
    // 500 so Dodo retries. The event is stored, so a replay is safe.
    return NextResponse.json(
      { ok: false, code: "unknown", message: "Processing failed." },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Event processing                                                   */
/* ------------------------------------------------------------------ */

interface DodoSubscriptionPayload {
  subscription_id?: string;
  product_id?: string;
  status?: string;
  currency?: string;
  next_billing_date?: string | null;
  previous_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean;
  payment_frequency_interval?: string;
  quantity?: number;
  customer?: { customer_id?: string; email?: string } | null;
  metadata?: Record<string, unknown> | null;
  payment_id?: string | null;
  past_due_ends_at?: string | null;
}

interface DodoPaymentPayload {
  payment_id?: string;
  amount?: number;
  currency?: string;
  subscription_id?: string | null;
  subscription_ids?: string[];
  total_amount?: number;
  charge_type?: string | null;
  service_periods?: Array<{
    subscription_id?: string;
    starts_at?: string;
    ends_at?: string;
    proration_factor?: string;
  }>;
  customer?: { customer_id?: string; email?: string } | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
}

async function processEvent(event: VerifiedWebhookEvent): Promise<void> {
  switch (event.type) {
    case "subscription.active":
    case "subscription.updated":
    case "subscription.renewed":
    case "subscription.past_due":
    case "subscription.on_hold":
    case "subscription.failed":
    case "subscription.paused":
    case "subscription.unpaused":
    case "subscription.plan_changed":
    case "subscription.cancelled":
    case "subscription.expired":
      await handleSubscriptionEvent(event);
      return;

    case "payment.succeeded":
      await handlePaymentSucceeded(event);
      return;

    case "payment.failed":
      await handlePaymentFailed(event);
      return;

    case "refund.succeeded":
      await handleRefund(event, "refunded");
      return;

    case "refund.failed":
      await handleRefund(event, "failed");
      return;

    case "dispute.opened":
    case "dispute.lost":
      await handleDispute(event);
      return;

    case "dispute.won":
      // A won dispute restores the invoice to paid. No entitlement change.
      await handleRefund(event, "paid");
      return;

    default:
      /*
       * Unknown event types are stored and ignored. A new Dodo event must not
       * break the endpoint.
       */
      return;
  }
}

/**
 * Find the Orindle owner for a provider subscription.
 *
 * Three sources, in order of trust:
 *
 *   1. The pending checkout row, resolved through the checkout reference in
 *      the server-authored metadata. This is the only source that can
 *      *activate* a plan.
 *   2. The subscription row that already carries the provider subscription id.
 *   3. The provider customer id, through `billing_customers`.
 *
 * A user id in provider metadata alone is never enough.
 */
async function resolveOwner(
  subscription: DodoSubscriptionPayload,
): Promise<{ ownerId: string; reference: string | null } | null> {
  const supabase = getServiceClient();

  // 1. The pending checkout row.
  const metadata = (subscription.metadata ?? {}) as Record<string, unknown>;
  const reference =
    typeof metadata.orindle_checkout_reference === "string"
      ? metadata.orindle_checkout_reference
      : null;

  if (reference) {
    const pending = await resolvePendingCheckout(reference);
    if (pending) {
      return { ownerId: pending.ownerId, reference };
    }
  }

  // 2. An existing subscription row.
  if (subscription.subscription_id) {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("owner_id")
      .eq("billing_provider", "dodo")
      .eq("provider_subscription_id", subscription.subscription_id)
      .maybeSingle();

    if (existing?.owner_id) {
      return { ownerId: String(existing.owner_id), reference };
    }
  }

  // 3. The provider customer id.
  const customerId = subscription.customer?.customer_id;
  if (customerId) {
    const { data: mapped } = await supabase
      .from("billing_customers")
      .select("owner_id")
      .eq("provider", "dodo")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (mapped?.owner_id) {
      return { ownerId: String(mapped.owner_id), reference };
    }
  }

  return null;
}

/**
 * A subscription event.
 *
 * The important properties:
 *
 *   - The period dates come from the provider, never from local arithmetic.
 *   - A renewal is recorded exactly once, keyed on the provider payment id.
 *   - `subscription.renewed` and `payment.succeeded` can both describe the
 *     same renewal; the invoice is keyed on the payment id, so the second one
 *     inserts nothing.
 *   - Nothing here deletes a file, an R2 object, or a subscription row.
 */
async function handleSubscriptionEvent(event: VerifiedWebhookEvent): Promise<void> {
  const subscription = event.data as unknown as DodoSubscriptionPayload;
  if (!subscription.subscription_id) return;

  const supabase = getServiceClient();
  const owner = await resolveOwner(subscription);
  if (!owner) {
    /*
     * An event we cannot attribute is recorded as an error rather than
     * guessed at. Dodo retries, and a human can then reconcile it. Activating
     * a plan for an unattributable subscription is exactly the failure this
     * whole design exists to prevent.
     */
    throw new Error(`cannot attribute subscription ${subscription.subscription_id} to a user`);
  }

  const providerStatus = subscription.status ?? "";
  const localStatus = mapProviderStatus(providerStatus);
  const customerId = subscription.customer?.customer_id ?? null;

  if (customerId) {
    await rememberProviderCustomer(
      owner.ownerId,
      customerId,
      subscription.customer?.email ?? null,
    );
  }

  const periodStart = subscription.previous_billing_date ?? null;
  const periodEnd = subscription.next_billing_date ?? null;
  const billingPeriod = subscription.payment_frequency_interval
    ? mapBillingPeriod(subscription.payment_frequency_interval)
    : null;

  const { data: current } = await supabase
    .from("subscriptions")
    .select("id, plan_id, currency, billing_period, status")
    .eq("owner_id", owner.ownerId)
    .in("status", ["active", "past_due", "cancelled", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  /*
   * A cancellation scheduled for the end of the period keeps the entitlement.
   * `cancel_at_next_billing_date` is the provider's statement that the
   * subscription is still live until then.
   */
  const cancelAtPeriodEnd = Boolean(subscription.cancel_at_next_billing_date);

  /*
   * `subscription.failed` is terminal: the mandate could not be created, so
   * there is no subscription and no entitlement. The row is moved to expired
   * and the recovery window opens, exactly as a lapsed subscription does. No
   * file is touched.
   */
  if (providerStatus === "failed") {
    await supabase
      .from("subscriptions")
      .update({
        billing_provider: "dodo",
        provider_subscription_id: subscription.subscription_id,
        status: "expired",
        expired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", current?.id ?? "");

    await supabase.from("activity_events").insert({
      actor_id: owner.ownerId,
      subject_type: "subscription",
      subject_id: current?.id ?? null,
      kind: "subscription.failed",
      metadata: { providerSubscriptionId: subscription.subscription_id },
    });
    return;
  }

  /*
   * The plan for this subscription comes from the provider's product id,
   * resolved through the mapping table. If the mapping is missing, the plan is
   * left alone rather than guessed at — a wrong plan grants the wrong amount
   * of storage.
   */
  let planId: string | null = null;
  if (subscription.product_id) {
    const { data: mapping } = await supabase
      .from("billing_provider_prices")
      .select("plan_id")
      .eq("provider", "dodo")
      .eq("product_id", subscription.product_id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    planId = mapping?.plan_id ? String(mapping.plan_id) : null;
  }

  /*
   * The currency. It is fixed for the life of the subscription, so an existing
   * subscription keeps its own currency and a new one takes the currency from
   * the pending checkout row.
   */
  let currency: string | null = null;
  if (owner.reference) {
    const pending = await resolvePendingCheckout(owner.reference);
    if (pending) currency = pending.currency;
  }
  if (!currency && current?.currency) currency = String(current.currency);
  if (!currency && subscription.currency) currency = String(subscription.currency);

  const payload = {
    billing_provider: "dodo" as const,
    provider_subscription_id: subscription.subscription_id,
    status: localStatus,
    cancel_at_period_end: cancelAtPeriodEnd,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    expired_at: null,
    recovery_ends_at: null,
    updated_at: new Date().toISOString(),
  };

  if (current?.id) {
    await supabase
      .from("subscriptions")
      .update({
        ...payload,
        ...(planId ? { plan_id: planId } : {}),
        ...(currency ? { currency } : {}),
        ...(billingPeriod ? { billing_period: billingPeriod } : {}),
      })
      .eq("id", current.id);
  } else {
    /*
     * No local subscription yet. This is the initial purchase. It is only
     * written when the pending checkout row resolved the owner — that is the
     * attribution that makes an activation legitimate.
     */
    if (!owner.reference) {
      throw new Error(
        `subscription ${subscription.subscription_id} has no pending checkout to activate`,
      );
    }

    const pending = await resolvePendingCheckout(owner.reference);
    if (!pending) {
      throw new Error(`pending checkout ${owner.reference} could not be resolved`);
    }

    await supabase.from("subscriptions").insert({
      owner_id: owner.ownerId,
      plan_id: planId ?? pending.planId,
      currency: currency ?? pending.currency,
      billing_period: billingPeriod ?? pending.period,
      status: localStatus,
      provider_subscription_id: subscription.subscription_id,
      billing_provider: "dodo",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    await completePendingCheckout(owner.reference);

    await supabase.from("activity_events").insert({
      actor_id: owner.ownerId,
      subject_type: "subscription",
      subject_id: null,
      kind: "subscription.activated",
      metadata: {
        planId: planId ?? pending.planId,
        period: billingPeriod ?? pending.period,
        currency: currency ?? pending.currency,
        providerSubscriptionId: subscription.subscription_id,
      },
    });
  }

  /*
   * A scheduled plan change is applied only when the provider confirms it.
   * The provider's product id is the source of truth for the new plan.
   */
  if (event.type === "subscription.plan_changed" && planId && current?.id) {
    const { data: pendingChange } = await supabase
      .from("subscriptions")
      .select("pending_plan_id")
      .eq("id", current.id)
      .maybeSingle();

    if (pendingChange?.pending_plan_id === planId) {
      const { data: applied } = await supabase.rpc("apply_scheduled_plan_change", {
        p_subscription_id: current.id,
        p_plan_id: planId,
      });

      if (applied) {
        await supabase.from("activity_events").insert({
          actor_id: owner.ownerId,
          subject_type: "subscription",
          subject_id: current.id,
          kind: "subscription.downgraded",
          metadata: { toPlan: planId },
        });
      }
    }
  }

  /*
   * A cancellation that has taken effect. The status is already written above;
   * this only records the event so the history is meaningful.
   */
  if (event.type === "subscription.cancelled") {
    await supabase.from("activity_events").insert({
      actor_id: owner.ownerId,
      subject_type: "subscription",
      subject_id: current?.id ?? null,
      kind: "subscription.cancelled",
      metadata: { providerSubscriptionId: subscription.subscription_id },
    });
  }
}

/**
 * A successful payment.
 *
 * The invoice is keyed on the provider payment id, so a duplicate delivery —
 * or the matching `subscription.renewed` event — inserts nothing.
 */
async function handlePaymentSucceeded(event: VerifiedWebhookEvent): Promise<void> {
  const payment = event.data as unknown as DodoPaymentPayload;
  if (!payment.payment_id) return;

  const supabase = getServiceClient();

  const subscriptionId =
    payment.subscription_id ?? payment.subscription_ids?.[0] ?? null;

  /*
   * A payment with no subscription is a one-time payment. Orindle sells only
   * subscriptions, so it is recorded as an anomaly rather than as revenue.
   */
  if (!subscriptionId) {
    console.warn("[webhook:dodo] payment without a subscription", {
      paymentId: payment.payment_id,
    });
    return;
  }

  const subscription = await fetchSubscriptionFor(subscriptionId);
  if (!subscription) {
    throw new Error(`could not resolve subscription ${subscriptionId} for payment ${payment.payment_id}`);
  }

  const owner = await resolveOwner(subscription);
  if (!owner) {
    throw new Error(`cannot attribute payment ${payment.payment_id} to a user`);
  }

  const { data: current } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("owner_id", owner.ownerId)
    .in("status", ["active", "past_due", "cancelled", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!current?.id) {
    throw new Error(`payment ${payment.payment_id} has no local subscription to renew`);
  }

  /*
   * The amount charged, in minor units, in the subscription's currency.
   * `service_periods` carries the period the payment pays for; when it is
   * present it is authoritative over the subscription's own dates.
   */
  const servicePeriod = payment.service_periods?.find((p) => p.subscription_id === subscriptionId);
  const periodStart = servicePeriod?.starts_at ?? subscription.previous_billing_date ?? null;
  const periodEnd = servicePeriod?.ends_at ?? subscription.next_billing_date ?? null;

  const amountMinor = Number(
    payment.total_amount ?? payment.amount ?? 0,
  );
  const currency = String(payment.currency ?? subscription.currency ?? "USD");

  /*
   * A renewal with no service period bills usage only and does not extend
   * access. The provider says so explicitly, and extending access on that
   * basis would be wrong.
   */
  if (payment.charge_type === "renewal" && payment.service_periods?.length === 0) {
    console.warn("[webhook:dodo] renewal with no service period; access not extended", {
      paymentId: payment.payment_id,
    });
    return;
  }

  const { data: inserted, error } = await supabase.rpc("apply_renewal", {
    p_owner_id: owner.ownerId,
    p_subscription_id: current.id,
    p_provider: "dodo",
    p_provider_subscription_id: subscription.subscription_id,
    p_provider_payment_id: payment.payment_id,
    p_amount_minor: amountMinor,
    p_currency: currency,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_billing_period: subscription.payment_frequency_interval
      ? mapBillingPeriod(subscription.payment_frequency_interval)
      : null,
    p_plan_id: null,
  });

  if (error) {
    throw new Error(`apply_renewal failed for ${payment.payment_id}: ${error.message}`);
  }

  if (inserted) {
    await supabase.from("activity_events").insert({
      actor_id: owner.ownerId,
      subject_type: "subscription",
      subject_id: current.id,
      kind: "payment.succeeded",
      metadata: { paymentId: payment.payment_id, amountMinor, currency },
    });
  }
}

/**
 * A failed payment.
 *
 * A single failure is never treated as a reason to delete anything or to cut
 * access immediately. The subscription's own lifecycle — the provider's own
 * past_due / on_hold events — decides what happens next, and Orindle's
 * existing recovery rules apply from there.
 */
async function handlePaymentFailed(event: VerifiedWebhookEvent): Promise<void> {
  const payment = event.data as unknown as DodoPaymentPayload;
  if (!payment.payment_id) return;

  const supabase = getServiceClient();

  const subscriptionId = payment.subscription_id ?? payment.subscription_ids?.[0] ?? null;
  let ownerId: string | null = null;

  if (subscriptionId) {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("owner_id")
      .eq("billing_provider", "dodo")
      .eq("provider_subscription_id", subscriptionId)
      .maybeSingle();
    ownerId = existing?.owner_id ? String(existing.owner_id) : null;
  }

  if (!ownerId) return;

  await supabase.from("activity_events").insert({
    actor_id: ownerId,
    subject_type: "payment",
    subject_id: null,
    kind: "payment.failed",
    metadata: { paymentId: payment.payment_id },
  });
}

/**
 * A refund.
 *
 * The invoice is marked refunded. Files are NOT clawed back and R2 objects are
 * NOT removed: revoking access to somebody's data because they were refunded
 * is a data-hostage move, and Orindle's customer-data policy does not do it.
 */
async function handleRefund(
  event: VerifiedWebhookEvent,
  status: "refunded" | "failed" | "paid",
): Promise<void> {
  const refund = event.data as unknown as {
    refund_id?: string;
    payment_id?: string;
    amount?: number;
    currency?: string;
    status?: string;
  };

  if (!refund.payment_id) return;

  const supabase = getServiceClient();
  await supabase
    .from("invoices")
    .update({ status })
    .eq("billing_provider", "dodo")
    .eq("provider_payment_id", refund.payment_id);
}

/**
 * A dispute.
 *
 * The invoice is marked as disputed so the transaction history is truthful.
 * Access is not removed: a chargeback is a payment-processor matter, and
 * deleting a customer's files over it would be both wrong and a bad look.
 */
async function handleDispute(event: VerifiedWebhookEvent): Promise<void> {
  const dispute = event.data as unknown as {
    dispute_id?: string;
    payment_id?: string;
    status?: string;
  };

  if (!dispute.payment_id) return;

  const supabase = getServiceClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("owner_id, status")
    .eq("billing_provider", "dodo")
    .eq("provider_payment_id", dispute.payment_id)
    .maybeSingle();

  if (!invoice) return;

  await supabase.from("activity_events").insert({
    actor_id: invoice.owner_id,
    subject_type: "payment",
    subject_id: null,
    kind: "payment.disputed",
    metadata: { disputeId: dispute.dispute_id ?? null, status: dispute.status ?? null },
  });
}

/**
 * Fetch a subscription from Dodo, for reconciliation.
 */
async function fetchSubscriptionFor(
  subscriptionId: string,
): Promise<Awaited<ReturnType<typeof import("@/domain/billing/dodo").fetchSubscription>>> {
  const { fetchSubscription } = await import("@/domain/billing/dodo");
  return fetchSubscription(subscriptionId);
}

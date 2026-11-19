/**
 * Pending checkout sessions.
 *
 * The server writes one of these *before* it talks to the payment provider.
 * It exists for three reasons:
 *
 *   1. **Attribution.** The provider's webhook arrives with no session. The
 *      reference in the server-authored metadata resolves back to this row, and
 *      this row knows who the money is for, which plan was bought, in which
 *      currency, at which approved price. A user id in provider metadata is
 *      never trusted on its own.
 *   2. **Duplicate suppression.** A repeated click, a browser refresh or two
 *      parallel requests must not produce two live subscriptions. The row is
 *      unique per owner while pending.
 *   3. **Abandonment.** A pending row that is never completed expires. It
 *      grants nothing, and it is safe to leave behind.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";
import type { BillingPeriod, CurrencyCode } from "@/config/pricing";

/** How long a pending checkout row stays valid. */
const CHECKOUT_TTL_MINUTES = 60;

/**
 * A checkout reference that is not guessable and not derived from the user id.
 *
 * It appears in provider metadata, which the customer can see, so it must
 * carry no information about the account.
 */
export function checkoutReference(): string {
  return `orindle_cs_${randomBytes(16).toString("hex")}`;
}

export interface PendingCheckout {
  reference: string;
  ownerId: string;
  planId: string;
  currency: CurrencyCode;
  period: BillingPeriod;
  amountMinor: number;
  productId: string;
}

/**
 * Create the pending checkout row.
 *
 * The unique constraint on `(owner_id)` for pending rows means a second
 * request while one is already pending cannot create another checkout. The
 * caller catches the conflict and reuses the existing row.
 */
export async function createPendingCheckout(input: PendingCheckout): Promise<{
  reference: string;
  reused: boolean;
}> {
  const supabase = getServiceClient();
  const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabase.from("billing_checkout_sessions").insert({
    reference: input.reference,
    owner_id: input.ownerId,
    provider: "dodo",
    plan_id: input.planId,
    currency: input.currency,
    period: input.period,
    amount_minor: input.amountMinor,
    product_id: input.productId,
    status: "pending",
    expires_at: expiresAt,
  });

  if (!error) return { reference: input.reference, reused: false };

  /*
   * A live pending row for this owner means a checkout is already in flight.
   * Rather than refusing the customer — they may have abandoned the first
   * attempt — the existing reference is returned so the caller can decide.
   */
  const { data: existing } = await supabase
    .from("billing_checkout_sessions")
    .select("reference, expires_at, status")
    .eq("owner_id", input.ownerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { reference: String(existing.reference), reused: true };
  }

  throw error;
}

/**
 * Attach the provider's checkout session id to the pending row.
 */
export async function attachProviderSession(reference: string, sessionId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("billing_checkout_sessions")
    .update({ provider_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq("reference", reference);
}

/**
 * Resolve a checkout reference back to the pending row.
 *
 * This is the only way a webhook learns who a payment is for. If the reference
 * is unknown, the payment is not attributable and nothing is activated.
 */
export async function resolvePendingCheckout(reference: string): Promise<{
  ownerId: string;
  planId: string;
  currency: string;
  period: BillingPeriod;
  amountMinor: number;
  productId: string;
  providerSessionId: string | null;
  status: string;
} | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("billing_checkout_sessions")
    .select("owner_id, plan_id, currency, period, amount_minor, product_id, provider_session_id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!data) return null;

  return {
    ownerId: String(data.owner_id),
    planId: String(data.plan_id),
    currency: String(data.currency),
    period: data.period as BillingPeriod,
    amountMinor: Number(data.amount_minor),
    productId: String(data.product_id),
    providerSessionId: data.provider_session_id ? String(data.provider_session_id) : null,
    status: String(data.status),
  };
}

/**
 * Mark a pending checkout as completed.
 */
export async function completePendingCheckout(reference: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("billing_checkout_sessions")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("reference", reference);
}

/**
 * Expire abandoned pending checkouts.
 *
 * Called by the subscription sweep. An expired row grants nothing: it is a
 * record that a checkout was started and not finished.
 */
export async function expirePendingCheckouts(): Promise<number> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("billing_checkout_sessions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[billing] could not expire pending checkouts", { message: error.message });
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Store a provider customer id for an Orindle user.
 *
 * The customer id is only ever read from here — the browser never supplies
 * one, and a portal session is only created for a customer id this table
 * already attributes to the caller.
 */
export async function rememberProviderCustomer(
  ownerId: string,
  customerId: string,
  email?: string | null,
): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from("billing_customers")
    .upsert(
      {
        owner_id: ownerId,
        provider: "dodo",
        customer_id: customerId,
        email: email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,owner_id" },
    );
}

/**
 * The provider customer id belonging to an Orindle user.
 *
 * Returns null rather than throwing when there is none: a customer without a
 * provider customer simply has no portal to open, which is a state the UI
 * renders honestly rather than an error.
 */
export async function findProviderCustomer(
  ownerId: string,
): Promise<{ customerId: string; email: string | null } | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("billing_customers")
    .select("customer_id, email")
    .eq("provider", "dodo")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!data) return null;
  return { customerId: String(data.customer_id), email: data.email ?? null };
}

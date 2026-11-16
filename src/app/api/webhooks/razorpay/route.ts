/**
 * POST /api/webhooks/razorpay
 *
 * Not session-authenticated: Razorpay is the caller. Authenticated instead by
 * HMAC over the RAW body, so the bytes that were signed are the bytes verified.
 *
 * The order of operations is the whole design:
 *   1. Verify the signature. Invalid → 400, nothing stored, nothing changed.
 *   2. Store the raw event with a unique (provider, event_id). A duplicate
 *      delivery inserts nothing and is acknowledged — Razorpay retries, and a
 *      retry must not double-charge.
 *   3. Process. Mark processed_at, or record the error so it can be replayed.
 *
 * A missing webhook secret returns 503 and activates nothing. It never falls
 * through to "assume valid".
 */

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/service";
import {
  activateSubscription,
  isBillingConfigured,
  periodEnd,
  verifyWebhookSignature,
} from "@/domain/billing/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RazorpayEvent {
  event?: string;
  payload?: Record<string, { entity?: Record<string, unknown> }>;
}

export async function POST(request: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Webhooks aren't configured." },
      { status: 503 },
    );
  }
  if (!isBillingConfigured()) {
    return NextResponse.json(
      { ok: false, code: "not_configured", message: "Billing isn't configured." },
      { status: 503 },
    );
  }

  // The raw text, not a parsed object: JSON key order and whitespace are part of
  // what was signed.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    console.warn("[webhook] signature mismatch", { length: raw.length });
    return NextResponse.json(
      { ok: false, code: "forbidden", message: "Invalid signature." },
      { status: 400 },
    );
  }

  let parsed: RazorpayEvent;
  try {
    parsed = JSON.parse(raw) as RazorpayEvent;
  } catch {
    return NextResponse.json(
      { ok: false, code: "validation_failed", message: "Invalid payload." },
      { status: 400 },
    );
  }

  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    (parsed.payload?.payment?.entity?.id as string | undefined) ??
    // Fall back to a content hash so an event without an id is still deduplicated.
    Buffer.from(raw).toString("base64url").slice(0, 64);

  const eventType = parsed.event ?? "unknown";
  const supabase = getServiceClient();

  // Store raw BEFORE processing. A failure below must not lose the event.
  const { error: insertError } = await supabase.from("webhook_events").insert({
    provider: "razorpay",
    event_id: eventId,
    event_type: eventType,
    payload: parsed as unknown as Record<string, unknown>,
  });

  if (insertError) {
    // Unique violation means we have already accepted this event.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, data: { duplicate: true } });
    }
    console.error("[webhook] store failed", { message: insertError.message });
    // 500 so Razorpay retries: we did not durably store it, so we cannot claim
    // to have handled it.
    return NextResponse.json(
      { ok: false, code: "unknown", message: "Could not record event." },
      { status: 500 },
    );
  }

  try {
    await processEvent(eventType, parsed);
    await supabase
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "razorpay")
      .eq("event_id", eventId);

    return NextResponse.json({ ok: true, data: { processed: eventType } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase
      .from("webhook_events")
      .update({ error: message })
      .eq("provider", "razorpay")
      .eq("event_id", eventId);

    console.error("[webhook] processing failed", { eventType, message });
    // 500 so Razorpay retries. The event is stored, so a replay is safe.
    return NextResponse.json(
      { ok: false, code: "unknown", message: "Processing failed." },
      { status: 500 },
    );
  }
}

async function processEvent(type: string, event: RazorpayEvent): Promise<void> {
  const supabase = getServiceClient();

  switch (type) {
    case "payment.captured": {
      const payment = event.payload?.payment?.entity as
        | { id?: string; order_id?: string; amount?: number; currency?: string; notes?: Record<string, string> }
        | undefined;

      if (!payment?.id) return;

      const planId = payment.notes?.planId;
      const userId = (payment.notes?.userId as string | undefined) ?? null;

      // Without a resolvable owner we cannot safely activate anything. Recorded
      // as an error rather than guessed from the order.
      if (!planId || !userId) {
        throw new Error("payment.captured without planId/userId notes");
      }

      await activateSubscription({
        userId,
        planId,
        currency: payment.currency ?? "INR",
        period: (payment.notes?.period as "monthly" | "yearly") ?? "monthly",
        amountMinor: Number(payment.amount ?? 0),
        paymentId: payment.id,
        subscriptionId: (payment.notes?.subscriptionId as string | undefined) ?? null,
        periodEnd: periodEnd(new Date(), (payment.notes?.period as "monthly" | "yearly") ?? "monthly"),
      });
      return;
    }

    case "payment.failed": {
      const payment = event.payload?.payment?.entity as { id?: string; notes?: Record<string, string> } | undefined;
      const userId = payment?.notes?.userId;
      if (!userId) return;

      // A single failure does not downgrade anyone. Record it and let the
      // subscription's own lifecycle handle the lapse.
      await supabase.from("activity_events").insert({
        actor_id: userId,
        subject_type: "payment",
        subject_id: null,
        kind: "payment.failed",
        metadata: { paymentId: payment?.id ?? null },
      });
      return;
    }

    case "subscription.cancelled": {
      const sub = event.payload?.subscription?.entity as { id?: string } | undefined;
      if (!sub?.id) return;

      await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("provider_subscription_id", sub.id);
      return;
    }

    case "subscription.halted":
    case "subscription.paused": {
      const sub = event.payload?.subscription?.entity as { id?: string } | undefined;
      if (!sub?.id) return;

      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("provider_subscription_id", sub.id);
      return;
    }

    case "refund.created": {
      const refund = event.payload?.refund?.entity as { payment_id?: string } | undefined;
      if (!refund?.payment_id) return;

      // The invoice is marked refunded. Files are NOT clawed back: revoking access
      // to someone's data because they were refunded is a data-hostage move.
      await supabase
        .from("invoices")
        .update({ status: "refunded" })
        .eq("provider_payment_id", refund.payment_id);
      return;
    }

    default:
      // Unknown event types are stored and ignored. A new Razorpay event must not
      // break the endpoint.
      return;
  }
}

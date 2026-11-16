/**
 * POST /api/billing/verify
 *
 * Why this endpoint has to exist: the repository contract returns a redirect URL,
 * but Razorpay's overlay flow hands the browser a payment id and signature
 * instead of redirecting. Without a verification step an overlay payment could be
 * "completed" entirely client-side.
 *
 * So: no path activates a plan from a client claim. Either the webhook has already
 * done it (the authoritative route), or this endpoint verifies the signature and
 * then activates.
 */

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import {
  activateSubscription,
  fetchOrder,
  isBillingConfigured,
  periodEnd,
  verifyPaymentSignature,
} from "@/domain/billing/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    if (!isBillingConfigured()) {
      throw new AppError(
        "not_configured",
        "Payments aren't connected on this deployment yet. Nothing was charged.",
      );
    }

    const limited = await enforceRateLimit(
      userBucket("billing.verify", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const orderId = requireString(body, "razorpayOrderId", { max: 64 });
    const paymentId = requireString(body, "razorpayPaymentId", { max: 64 });
    const signature = requireString(body, "razorpaySignature", { max: 256 });

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      // The one thing that must never happen: an unverified payment activating a
      // plan. Nothing is written.
      throw new AppError(
        "forbidden",
        "We couldn't verify that payment, so nothing was changed. If you were charged, contact us.",
      );
    }

    // The signature proves the payment is real. It does not prove it belongs to
    // the caller. The order's notes — written by this server at checkout time —
    // carry the owner, and Razorpay's copy is authoritative, so the lookup does not
    // depend on our own database write having landed.
    const order = await fetchOrder(orderId);
    const notes = order?.notes ?? {};

    if (notes.userId !== auth.actor.userId) {
      // Someone signed in as a different account than the order belongs to. The
      // payment is real, so do not throw away the information: log it and refuse.
      console.error("[billing] verify: order belongs to a different user", {
        orderId,
        paymentId,
      });
      throw new AppError(
        "forbidden",
        "That payment belongs to a different account. Nothing was changed; if you were charged, contact us.",
      );
    }

    if (!notes.planId) {
      throw new AppError(
        "not_found",
        "We couldn't match that payment to an order. Nothing was changed; if you were charged, contact us.",
      );
    }

    const period = notes.period === "yearly" ? "yearly" : "monthly";
    const currency = notes.currency === "USD" ? "USD" : (order?.currency ?? "INR");

    await activateSubscription({
      userId: auth.actor.userId,
      planId: notes.planId,
      currency: currency === "USD" ? "USD" : "INR",
      period,
      amountMinor: order?.amountMinor ?? 0,
      paymentId,
      subscriptionId: null,
      periodEnd: periodEnd(new Date(), period),
    });

    // Idempotent by construction: activation keys on the unique
    // provider_payment_id, so if the webhook already handled this payment the
    // second call changes nothing and this still returns success.
    return ok({ active: true, planId: notes.planId });
  });
}

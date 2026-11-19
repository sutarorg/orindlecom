/**
 * POST /api/billing/verify
 *
 * **Legacy Razorpay only.** New checkouts go through Dodo's hosted checkout
 * (`POST /api/billing/checkout`) and are confirmed by a verified Dodo webhook
 * (`POST /api/webhooks/dodo`). There is no browser callback in that flow,
 * because a browser callback is not evidence of payment.
 *
 * This route remains mounted for the historical Razorpay flow: an order that
 * was created before the migration may still have a payment in flight, and
 * its HMAC signature is the only thing that proves it was paid. It does not
 * create Razorpay orders any more — `POST /api/billing/checkout` no longer
 * does — so it can only ever complete an order that already exists.
 *
 * It refuses outright when the Razorpay credentials are absent, rather than
 * degrading into "assume valid".
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
import { isSupportedCurrency } from "@/config/pricing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    if (!isBillingConfigured()) {
      throw new AppError(
        "not_configured",
        "Legacy Razorpay payments aren't configured on this deployment.",
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
      throw new AppError(
        "forbidden",
        "We couldn't verify that payment, so nothing was changed. If you were charged, contact us.",
      );
    }

    const order = await fetchOrder(orderId);
    const notes = order?.notes ?? {};

    if (notes.userId !== auth.actor.userId) {
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
    const candidateCurrency = (order?.currency ?? notes.currency ?? "USD").toUpperCase();
    const currency = isSupportedCurrency(candidateCurrency) ? candidateCurrency : "USD";

    await activateSubscription({
      userId: auth.actor.userId,
      planId: notes.planId,
      currency,
      period,
      amountMinor: order?.amountMinor ?? 0,
      paymentId,
      subscriptionId: null,
      periodEnd: periodEnd(new Date(), period),
    });

    return ok({ active: true, planId: notes.planId, period, currency });
  });
}

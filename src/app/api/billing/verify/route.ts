/**
 * POST /api/billing/verify
 *
 * Why this endpoint has to exist: the repository contract returns a redirect URL,
 * but Razorpay's overlay flow hands the browser a payment id and signature
 * instead of redirecting. Without a verification step, an overlay payment could
 * be "completed" entirely client-side.
 *
 * So: no path activates a plan from a client claim. Either the webhook has
 * already done it (the authoritative route), or this endpoint verifies the
 * signature itself and then activates.
 */

import { handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { AppError } from "@/domain/auth/errors";
import {
  activateSubscription,
  isBillingConfigured,
  periodEnd,
  verifyPaymentSignature,
} from "@/domain/billing/razorpay";
import { getServiceClient } from "@/lib/supabase/service";

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

    // The order's notes carry the plan and owner. They were written by us at
    // checkout time, so they are trustworthy in a way a request body never is.
    const supabase = getServiceClient();
    const { data: intent } = await supabase
      .from("activity_events")
      .select("metadata")
      .eq("kind", "billing.order_created")
      .eq("actor_id", auth.actor.userId)
      .contains("metadata", { orderId })
      .maybeSingle();

    const meta = (intent?.metadata ?? {}) as {
      planId?: string;
      period?: "monthly" | "yearly";
      currency?: string;
      amountMinor?: number;
    };

    if (!meta.planId) {
      throw new AppError(
        "not_found",
        "We couldn't match that payment to an order. Nothing was changed; if you were charged, contact us.",
      );
    }

    await activateSubscription({
      userId: auth.actor.userId,
      planId: meta.planId,
      currency: meta.currency ?? "INR",
      period: meta.period ?? "monthly",
      amountMinor: Number(meta.amountMinor ?? 0),
      paymentId,
      subscriptionId: null,
      periodEnd: periodEnd(new Date(), meta.period ?? "monthly"),
    });

    return ok({ active: true, planId: meta.planId });
  });
}

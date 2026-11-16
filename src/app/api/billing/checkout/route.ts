/**
 * POST /api/billing/checkout
 *
 * Takes a plan id and a period. It does NOT take an amount: the price is
 * resolved from an approved row in the database. A tampered request can choose
 * no price at all — it can only choose a plan, and either that plan has an
 * approved price in that currency or the request is refused.
 */

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import { createOrder, createOrderGuard, resolveApprovedPrice, receiptRef } from "@/domain/billing/razorpay";
import { getServiceClient } from "@/lib/supabase/service";
import { isBillingConfigured } from "@/domain/billing/razorpay";

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
      userBucket("billing.checkout", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const planId = requireString(body, "planId", { max: 32 });
    const periodRaw = requireString(body, "period", { max: 8 });

    if (periodRaw !== "monthly" && periodRaw !== "yearly") {
      throw new AppError("validation_failed", "Choose monthly or yearly.");
    }

    // The billing currency is stored on the subscription at creation and never
    // follows the visitor's region afterwards, so a new subscription picks it up
    // once, here.
    const currency = (body.currency === "USD" ? "USD" : "INR") as "INR" | "USD";

    const price = await resolveApprovedPrice(planId, currency, periodRaw);
    createOrderGuard(price);

    const order = await createOrder(price, receiptRef(), auth.actor.userId);

    // Remember which user an order belongs to. The webhook arrives with no
    // session, so the owner has to be recorded at order time — otherwise
    // activation would have to guess, and guessing is how a payment credits the
    // wrong account.
    const supabase = getServiceClient();
    await supabase.from("activity_events").insert({
      actor_id: auth.actor.userId,
      subject_type: "order",
      subject_id: null,
      kind: "billing.order_created",
      metadata: {
        orderId: order.orderId,
        planId: price.planId,
        period: price.period,
        currency: price.currency,
        amountMinor: price.amountMinor,
      },
    });

    return ok({
      orderId: order.orderId,
      amountMinor: order.amountMinor,
      currency: order.currency,
      keyId: order.keyId,
      planId: price.planId,
      period: price.period,
    });
  });
}

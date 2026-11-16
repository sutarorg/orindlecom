/**
 * POST /api/billing/checkout
 *
 * Takes a plan id, period (monthly | yearly) and currency (any of the 8
 * approved currencies). It does NOT take an amount: the price is resolved from
 * an `approved` row in `public.plan_prices`.
 */

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import {
  createOrder,
  createOrderGuard,
  isBillingConfigured,
  receiptRef,
  resolveApprovedPrice,
} from "@/domain/billing/razorpay";
import { isSupportedCurrency } from "@/config/pricing";
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

    const currencyRaw =
      typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "INR";
    if (!isSupportedCurrency(currencyRaw)) {
      throw new AppError(
        "unsupported",
        "Choose one of our eight published currencies: INR, USD, GBP, EUR, AED, SGD, AUD or CAD.",
      );
    }

    const price = await resolveApprovedPrice(planId, currencyRaw, periodRaw);
    createOrderGuard(price);

    const order = await createOrder(price, receiptRef(), auth.actor.userId);

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

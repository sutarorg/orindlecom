/**
 * POST /api/billing/checkout
 *
 * Takes a plan id and period (monthly | yearly). It does NOT accept an amount
 * OR a currency from the client: the billing currency is resolved strictly on
 * the server from the actor's active paid subscription (if any) or from
 * trusted edge geolocation headers (defaulting to USD when the country does
 * not match one of our 8 supported currency regions), and the price is resolved
 * from an `approved` row in `public.plan_prices`.
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
import { isSupportedCurrency, type CurrencyCode } from "@/config/pricing";
import { resolveCurrencyFromHeaders } from "@/lib/geo/currency";
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

    // Authoritative server-side currency resolution: never trust client input.
    // Keep an existing active/past_due paid subscriber's locked currency;
    // otherwise resolve strictly from request geolocation headers (default USD).
    const supabase = getServiceClient();
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("plan_id, status, currency")
      .eq("owner_id", auth.actor.userId)
      .in("status", ["active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lockedCurrency =
      existingSub &&
      existingSub.plan_id !== "free" &&
      typeof existingSub.currency === "string" &&
      isSupportedCurrency(existingSub.currency)
        ? (existingSub.currency as CurrencyCode)
        : null;

    const currency: CurrencyCode = lockedCurrency ?? resolveCurrencyFromHeaders(request.headers);

    const price = await resolveApprovedPrice(planId, currency, periodRaw);
    createOrderGuard(price);

    const order = await createOrder(price, receiptRef(), auth.actor.userId);

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

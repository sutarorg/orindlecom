/**
 * POST /api/billing/checkout
 *
 * Takes a plan id and a period (monthly | yearly). It does NOT accept an
 * amount, a currency, a product id or a user id from the client.
 *
 * The order of operations is the whole design:
 *
 *   1. Authenticate the caller and rate-limit them.
 *   2. Resolve the billing currency strictly on the server: an existing paid
 *      subscriber's currency is locked; otherwise it comes from trusted edge
 *      geolocation headers.
 *   3. Resolve the approved price from `public.plan_prices`.
 *   4. Resolve the Dodo product from `public.billing_provider_prices`.
 *   5. Re-validate that product against Dodo's own catalog: it must be
 *      recurring, on the right interval, in the approved currency, at the
 *      approved amount. Any difference refuses the checkout.
 *   6. Write a pending checkout row and create the Dodo checkout session.
 *   7. Return the hosted checkout URL and an internal reference.
 *
 * The browser then redirects to Dodo. Nothing about that redirect activates
 * anything — only a verified webhook does.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import {
  assertMappingMatchesPrice,
  createCheckoutGuard,
  createCheckoutSession,
  isBillingConfigured,
  resolveApprovedPrice,
  resolveProductMapping,
  validateProduct,
} from "@/domain/billing/dodo";
import {
  attachProviderSession,
  createPendingCheckout,
  checkoutReference,
} from "@/domain/billing/checkout-session";
import { isSupportedCurrency, type CurrencyCode } from "@/config/pricing";
import { resolveCurrencyFromHeaders } from "@/lib/geo/currency";
import { getServiceClient } from "@/lib/supabase/service";
import { SITE } from "@/config/site";

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

    // The Free plan is not a purchase. It must never create a paid checkout
    // session, however the request was phrased.
    if (planId === "free") {
      throw new AppError("unsupported", "The Free plan doesn't need a checkout.");
    }

    /*
     * A customer who already has a live subscription must not be able to open
     * a second one. The unique index on live subscriptions backs this up, but
     * checking here turns a confusing duplicate-charge risk into a clear
     * message.
     */
    const supabase = getServiceClient();

    const { data: liveSubscription } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, currency, billing_provider")
      .eq("owner_id", auth.actor.userId)
      .in("status", ["active", "past_due"])
      .limit(1)
      .maybeSingle();

    if (liveSubscription) {
      throw new AppError(
        "conflict",
        "You already have an active subscription. Change or cancel it before starting another.",
      );
    }

    /*
     * Authoritative server-side currency resolution: never trust client input.
     *
     * An existing paid subscriber's currency stays locked to the currency their
     * subscription was created in — moving country does not silently re-price
     * someone mid-term. Everyone else is priced from trusted edge geolocation
     * headers.
     */
    const { data: lockedSubscription } = await supabase
      .from("subscriptions")
      .select("plan_id, currency")
      .eq("owner_id", auth.actor.userId)
      .neq("plan_id", "free")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lockedCurrency =
      lockedSubscription &&
      typeof lockedSubscription.currency === "string" &&
      isSupportedCurrency(lockedSubscription.currency)
        ? (lockedSubscription.currency as CurrencyCode)
        : null;

    const currency: CurrencyCode = lockedCurrency ?? resolveCurrencyFromHeaders(request.headers);

    // 1. The approved price.
    const price = await resolveApprovedPrice(planId, currency, periodRaw);
    createCheckoutGuard(price);

    // 2. The provider product for that exact combination.
    const mapping = await resolveProductMapping(price.planId, price.currency, price.period);

    // 3. The mapping must agree with the approved price before any network call.
    assertMappingMatchesPrice(mapping, price);

    // 4. And the provider's own catalog must agree with it.
    await validateProduct(mapping, price);

    // 5. The pending checkout record. Written before the provider is called so
    //    a webhook can always be attributed.
    const reference = checkoutReference();
    const pending = await createPendingCheckout({
      reference,
      ownerId: auth.actor.userId,
      planId: price.planId,
      currency: price.currency,
      period: price.period,
      amountMinor: price.amountMinor,
      productId: mapping.productId,
    });

    // 6. The hosted checkout session.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", auth.actor.userId)
      .limit(1)
      .maybeSingle();

    const base = SITE.url;
    const session = await createCheckoutSession({
      price,
      mapping,
      userId: auth.actor.userId,
      email: auth.actor.email ?? null,
      name: (profile?.full_name as string | null) ?? null,
      reference: pending.reference,
      returnUrl: `${base}/dashboard/billing?checkout=returned`,
      cancelUrl: `${base}/dashboard/billing?checkout=cancelled`,
    });

    await attachProviderSession(pending.reference, session.sessionId);

    await supabase.from("activity_events").insert({
      actor_id: auth.actor.userId,
      subject_type: "order",
      subject_id: null,
      kind: "billing.order_created",
      metadata: {
        provider: "dodo",
        sessionId: session.sessionId,
        planId: price.planId,
        period: price.period,
        currency: price.currency,
        amountMinor: price.amountMinor,
      },
    });

    return ok({
      checkoutUrl: session.checkoutUrl,
      reference: pending.reference,
      planId: price.planId,
      period: price.period,
      currency: price.currency,
      amountMinor: price.amountMinor,
    });
  });
}

/**
 * GET /api/billing/status
 *
 * The authenticated status of the caller's checkout and subscription.
 *
 * This is what the billing page polls after the customer returns from the
 * hosted checkout. It exists because the return itself proves nothing: the
 * page has to be able to say "we're confirming your payment" honestly, and
 * only the server knows whether the provider has confirmed it.
 *
 * The states it can report:
 *
 *   - `checkout_pending`  A checkout was started and the provider has not
 *                         confirmed a payment yet.
 *   - `processing`         A payment is being processed by the provider.
 *   - `active`            The subscription is live.
 *   - `past_due`           A renewal failed and the grace period is running.
 *   - `cancelling`         Cancellation is scheduled for the period end.
 *   - `cancelled`          The subscription has ended.
 *   - `expired`            The subscription expired; the recovery window applies.
 *   - `none`               No paid subscription.
 */

import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getServiceClient } from "@/lib/supabase/service";
import { planById } from "@/config/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type BillingState =
  | "none"
  | "checkout_pending"
  | "processing"
  | "active"
  | "past_due"
  | "cancelling"
  | "cancelled"
  | "expired";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const supabase = getServiceClient();

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select(
        "plan_id, status, currency, billing_period, current_period_end, cancel_at_period_end, billing_provider",
      )
      .eq("owner_id", auth.actor.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: pending } = await supabase
      .from("billing_checkout_sessions")
      .select("plan_id, currency, period, amount_minor, status, created_at")
      .eq("owner_id", auth.actor.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const subscriptionStatus = subscription?.status ?? null;
    const planId = subscription?.plan_id ?? (pending?.plan_id as string | undefined) ?? "free";
    const plan = planById(planId as Parameters<typeof planById>[0]);

    let state: BillingState;
    if (subscriptionStatus === "active") {
      state = subscription?.cancel_at_period_end ? "cancelling" : "active";
    } else if (subscriptionStatus === "past_due") {
      state = "past_due";
    } else if (subscriptionStatus === "cancelled") {
      state = "cancelled";
    } else if (subscriptionStatus === "expired") {
      state = "expired";
    } else if (pending) {
      /*
       * A pending checkout with no active subscription. The provider may not
       * have confirmed anything yet, which is exactly what "pending" means.
       */
      state = "checkout_pending";
    } else {
      state = "none";
    }

    return ok({
      state,
      planId: plan.id,
      planName: plan.name,
      currency: String(subscription?.currency ?? pending?.currency ?? "USD"),
      period: String(subscription?.billing_period ?? pending?.period ?? "monthly"),
      currentPeriodEnd: subscription?.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      provider: String(subscription?.billing_provider ?? "dodo"),
      pendingCheckout: pending
        ? {
            planId: String(pending.plan_id),
            currency: String(pending.currency),
            period: String(pending.period),
            amountMinor: Number(pending.amount_minor),
            startedAt: String(pending.created_at),
          }
        : null,
    });
  });
}

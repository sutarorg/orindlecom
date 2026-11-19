/**
 * POST /api/billing/cancel — stop the subscription at the end of the paid period.
 *
 * Cancelling never removes access immediately and never deletes a file. The plan
 * stays active until the period ends, then the sweep downgrades the allowance while
 * keeping every file readable. The response says exactly that, because "cancelled"
 * meaning "you have nothing until tomorrow" and "cancelled" meaning "works until the
 * 12th" are very different things to the person clicking it.
 *
 * For a Dodo subscription, the cancellation is made *at the provider* first, with
 * `cancel_at_next_billing_date`. The local row is only written once the provider
 * has accepted it, so the two cannot drift. A local-only flag would leave Dodo
 * charging the customer for a plan they had cancelled.
 *
 * A legacy Razorpay subscription has no provider-side cancel endpoint here, so
 * its local flag is set directly. That is the honest behaviour: the legacy
 * arrangement keeps collecting until it lapses, and the administrator guide
 * explains how those subscriptions are retired.
 */

import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";
import { AppError } from "@/domain/auth/errors";
import { scheduleCancellation } from "@/domain/billing/dodo";
import { planById } from "@/config/pricing";

export const runtime = "nodejs";

export async function POST() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("billing.cancel", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const supabase = getServiceClient();

    const { data: current, error: readError } = await supabase
      .from("subscriptions")
      .select(
        "id, plan_id, status, currency, current_period_end, cancel_at_period_end, provider_subscription_id, billing_provider",
      )
      .eq("owner_id", auth.actor.userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();

    if (readError) {
      throw new AppError("unknown", "We couldn't read your subscription. Nothing was changed.");
    }
    if (!current) {
      throw new AppError("not_found", "There's no active subscription to cancel.");
    }

    /*
     * The provider has to accept the cancellation before the local row is
     * written. If the provider call fails, the local subscription stays
     * untouched — which means the customer is still going to be charged, and
     * saying "cancelled" would be a lie.
     */
    if (current.billing_provider === "dodo" && current.provider_subscription_id) {
      try {
        await scheduleCancellation(current.provider_subscription_id);
      } catch (error) {
        console.error("[billing] provider cancellation failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw new AppError(
          "network",
          "We couldn't cancel that at our payment provider, so nothing was changed. Please try again.",
        );
      }
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("id", current.id);

    if (error) {
      throw new AppError("unknown", "We couldn't cancel that. Nothing was changed.");
    }

    await supabase.from("activity_events").insert({
      actor_id: auth.actor.userId,
      subject_type: "subscription",
      subject_id: current.id,
      kind: "subscription.cancelled",
      metadata: { provider: current.billing_provider ?? "razorpay" },
    });

    const plan = planById(current.plan_id as Parameters<typeof planById>[0]);

    return ok({
      status: "cancelling" as const,
      planId: current.plan_id,
      planName: plan.name,
      currency: current.currency,
      currentPeriodEnd: current.current_period_end ?? null,
      note: `Your ${plan.name} allowance continues until the end of the paid period. Nothing is deleted — you keep every file, and new uploads pause only if you go over the Free limit.`,
    });
  });
}

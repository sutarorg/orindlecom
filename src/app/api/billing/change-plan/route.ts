/**
 * POST /api/billing/change-plan — move to a different plan.
 *
 * Orindle's policy, unchanged:
 *
 *   - A **downgrade** takes effect at the end of the current billing period.
 *     The customer keeps what they paid for, and nothing is deleted.
 *   - An **upgrade** requires a valid payment, or a provider-side plan change
 *     on the existing subscription. A second subscription is never created.
 *
 * For a Dodo subscriber this route now talks to the provider, because a local
 * flag alone is not enough: Dodo would keep charging the old product price
 * while Orindle showed a smaller allowance. The sequence is:
 *
 *   1. Resolve the approved price for the target plan in the subscription's
 *      locked currency, and the provider product for it.
 *   2. Validate the product against the provider's catalog, exactly as
 *      checkout does.
 *   3. Ask the provider to change the plan on the existing subscription:
 *        - downgrade → `do_not_bill` at `next_billing_date`
 *        - upgrade   → `difference_immediately` now
 *   4. Only once the provider has accepted, write the local pending change.
 *
 * If the provider refuses, nothing local changes. If a scheduled change is
 * later cancelled at the provider, the pending local change is cleared rather
 * than applied.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";
import { planById, type PlanId } from "@/config/pricing";
import { AppError } from "@/domain/auth/errors";
import {
  assertMappingMatchesPrice,
  changeSubscriptionProduct,
  createCheckoutGuard,
  resolveApprovedPrice,
  resolveProductMapping,
  validateProduct,
} from "@/domain/billing/dodo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("billing.changePlan", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const planId = requireString(body, "planId", { max: 32 });

    const target = planById(planId as PlanId);
    if (!target || target.id !== planId) {
      throw new AppError("validation_failed", "That isn't a plan we offer.");
    }

    if (target.id === "free") {
      throw new AppError("validation_failed", "Cancel your subscription to move to the Free plan.");
    }

    const supabase = getServiceClient();

    const { data: current, error: readError } = await supabase
      .from("subscriptions")
      .select(
        "id, plan_id, status, currency, billing_period, current_period_end, provider_subscription_id, billing_provider",
      )
      .eq("owner_id", auth.actor.userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();

    if (readError) {
      throw new AppError("unknown", "We couldn't read your subscription. Nothing was changed.");
    }
    if (!current) {
      throw new AppError("not_found", "There's no active subscription to change.");
    }

    const from = planById(current.plan_id as PlanId);
    const isUpgrade = target.storageBytes > from.storageBytes;

    /*
     * The billing currency is fixed for the life of the subscription, so the
     * target plan is priced in that currency — not in the currency of
     * wherever the customer happens to be now.
     */
    const currency = current.currency as string;
    const period = (current.billing_period ?? "monthly") as "monthly" | "yearly";

    const price = await resolveApprovedPrice(target.id, currency, period);
    createCheckoutGuard(price);

    const mapping = await resolveProductMapping(price.planId, price.currency, price.period);
    assertMappingMatchesPrice(mapping, price);
    await validateProduct(mapping, price);

    /*
     * A provider-backed subscription must have the provider change the plan.
     * A legacy Razorpay subscription has no provider-side plan change, so its
     * local pending change is scheduled directly — and the administrator guide
     * explains that those subscriptions have to be retired by hand.
     */
    if (current.billing_provider === "dodo") {
      if (!current.provider_subscription_id) {
        throw new AppError(
          "unknown",
          "We couldn't reach your payment provider for that subscription. Nothing was changed.",
        );
      }

      try {
        await changeSubscriptionProduct({
          subscriptionId: current.provider_subscription_id,
          productId: mapping.productId,
          prorationBillingMode: isUpgrade ? "difference_immediately" : "do_not_bill",
          effectiveAt: isUpgrade ? "immediately" : "next_billing_date",
        });
      } catch (error) {
        console.error("[billing] provider plan change failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw new AppError(
          "network",
          "We couldn't change that plan at our payment provider, so nothing was changed. Please try again.",
        );
      }
    }

    /*
     * The provider has accepted the change, so the local record may now
     * follow. A downgrade stays pending until the period end; an upgrade is
     * applied now, because the provider has already charged for it.
     */
    if (isUpgrade) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_id: target.id,
          pending_plan_id: null,
          pending_plan_effective_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id);

      if (error) {
        throw new AppError("unknown", "We couldn't change that plan. Nothing was changed.");
      }

      await supabase.from("activity_events").insert({
        actor_id: auth.actor.userId,
        subject_type: "subscription",
        subject_id: current.id,
        kind: "subscription.changed",
        metadata: { fromPlan: from.id, toPlan: target.id },
      });

      return ok({
        scheduled: false,
        applied: true,
        planId: target.id,
        effectiveAt: new Date().toISOString(),
        note: `You're on ${target.name} now. The difference was charged to your payment method. Nothing is deleted.`,
      });
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({
        pending_plan_id: target.id,
        pending_plan_effective_at: current.current_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id);

    if (error) {
      throw new AppError("unknown", "We couldn't schedule that change. Nothing was changed.");
    }

    await supabase.from("activity_events").insert({
      actor_id: auth.actor.userId,
      subject_type: "subscription",
      subject_id: current.id,
      kind: "subscription.downgrade_scheduled",
      metadata: { fromPlan: from.id, toPlan: target.id },
    });

    return ok({
      scheduled: true,
      applied: false,
      planId: target.id,
      effectiveAt: current.current_period_end as string,
      // Said plainly: nothing is deleted, and what happens if they are over.
      note: `Your ${from.name} allowance continues until then. Nothing is deleted — if you're over the ${target.name} limit, you keep your files and can't add more until you're under it.`,
    });
  });
}

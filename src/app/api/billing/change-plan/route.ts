/**
 * POST /api/billing/change-plan — switch to a smaller plan.
 *
 * Only downward moves are handled here, and they are free: the new allowance starts
 * at the current period end, files are never deleted, and going over the smaller
 * limit blocks new uploads rather than removing anything. An upward move is a
 * purchase, so it goes through checkout instead — there is no path here that grants
 * more storage without a verified payment.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";
import { planById } from "@/config/pricing";
import { AppError } from "@/domain/auth/errors";

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

    const target = planById(planId as Parameters<typeof planById>[0]);
    if (!target || target.id !== planId) {
      throw new AppError("validation_failed", "That isn't a plan we offer.");
    }

    const supabase = getServiceClient();

    const { data: current, error: readError } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, current_period_end")
      .eq("owner_id", auth.actor.userId)
      .in("status", ["active", "past_due"])
      .maybeSingle();

    if (readError) {
      throw new AppError("unknown", "We couldn't read your subscription. Nothing was changed.");
    }
    if (!current) {
      throw new AppError("not_found", "There's no active subscription to change.");
    }

    const from = planById(current.plan_id as Parameters<typeof planById>[0]);

    // Moving up is a purchase, not a change. Refusing here is what stops a request
    // from granting a bigger allowance without a payment.
    if (target.storageBytes > from.storageBytes) {
      throw new AppError(
        "unsupported",
        "Upgrading takes a payment. Choose the plan on this page and complete checkout instead.",
      );
    }

    // The downgrade is scheduled for the period end rather than applied now, so the
    // person keeps what they paid for. subscription-sweep applies it.
    const { error } = await supabase
      .from("subscriptions")
      .update({
        pending_plan_id: planId,
        pending_plan_effective_at: current.current_period_end,
      })
      .eq("id", current.id);

    if (error) {
      throw new AppError("unknown", "We couldn't schedule that change. Nothing was changed.");
    }

    return ok({
      scheduled: true,
      planId,
      effectiveAt: current.current_period_end as string,
      // Said plainly: nothing is deleted, and what happens if they are over.
      note: `Your ${from.name} allowance continues until then. Nothing is deleted — if you're over the ${target.name} limit, you keep your files and can't add more until you're under it.`,
    });
  });
}

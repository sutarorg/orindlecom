/**
 * POST /api/billing/cancel — stop the subscription at the end of the paid period.
 *
 * Cancelling never removes access immediately and never deletes a file. The plan
 * stays active until the period ends, then the sweep downgrades the allowance while
 * keeping every file readable. The response says exactly that, because "cancelled"
 * meaning "you have nothing until tomorrow" and "cancelled" meaning "works until the
 * 12th" are very different things to the person clicking it.
 */

import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

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

    const repo = getDriveRepository();
    const result = await repo.cancelSubscription();

    if (!result.ok) {
      throw new AppError(
        result.code === "not_found"
          ? "not_found"
          : result.code === "not_configured"
            ? "not_configured"
            : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

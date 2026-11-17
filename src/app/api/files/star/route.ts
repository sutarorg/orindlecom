/**
 * PATCH /api/files/star — set or clear the star on many items at once.
 *
 * The selection bar needs this: starring a selection used to be one PATCH per
 * item, so a twenty-file selection was twenty round trips. Desired state is sent
 * rather than a toggle, so a double-click cannot leave the row disagreeing with
 * the icon.
 *
 * Ids only — never a user id. The owner comes from the session inside the
 * repository, so a caller cannot star somebody else's file by naming it.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireStringArray, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("files.star", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const ids = requireStringArray(body, "ids", 500);

    if (typeof body.starred !== "boolean") {
      throw new AppError("validation_failed", "Choose whether to star these items.");
    }

    const repo = getDriveRepository();
    const result = await repo.toggleStarMany({ ids, starred: body.starred });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ starred: body.starred, updated: result.data.length, items: result.data });
  });
}

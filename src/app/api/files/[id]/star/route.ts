/**
 * PATCH /api/files/:id/star — set or clear the star.
 *
 * The desired state is sent rather than a toggle, so a double-click cannot flip it
 * twice and leave the row disagreeing with the button.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("files.star", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    if (typeof body.starred !== "boolean") {
      throw new AppError("validation_failed", "Choose whether to star this item.");
    }

    const repo = getDriveRepository();
    const result = await repo.toggleStar({ id, starred: body.starred });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok(result.data);
  });
}

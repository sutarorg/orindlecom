/**
 * PATCH /api/folders/:id/move — move a folder.
 *
 * Moving a folder into its own descendant would detach the subtree from the tree
 * entirely, so it is refused. The check lives in SQL (a recursive ancestry walk), not
 * in this handler, because a handler check races against a concurrent move of the
 * same two folders. The repository surfaces the refusal as a conflict.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireUuid, withActor } from "@/lib/api";
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
      userBucket("folders.move", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    if (!("parentId" in body)) {
      throw new AppError("validation_failed", "Choose where to move this folder.");
    }
    const parentId = requireUuid(body, "parentId", true);

    const repo = getDriveRepository();
    const result = await repo.move({ ids: [id], parentId });

    if (!result.ok) {
      // A cycle is reported as a conflict by the repository's ancestry check.
      throw new AppError(result.code === "conflict" ? "conflict" : "unknown", result.message);
    }

    return ok({ moved: result.data.length, items: result.data });
  });
}

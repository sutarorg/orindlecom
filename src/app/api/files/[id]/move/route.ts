/**
 * PATCH /api/files/:id/move — move an item into a folder, or to the root.
 *
 * `parentId: null` means the root, which is distinct from omitting the key. A
 * missing key is a mistake rather than an instruction to move to the root, so it is
 * rejected.
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
      userBucket("files.move", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    if (!("parentId" in body)) {
      throw new AppError("validation_failed", "Choose where to move this.");
    }
    const parentId = requireUuid(body, "parentId", true);

    const repo = getDriveRepository();
    const result = await repo.move({ ids: [id], parentId });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ moved: result.data.length, items: result.data });
  });
}

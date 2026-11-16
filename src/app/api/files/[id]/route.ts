/**
 * GET /api/files/:id — one item's metadata.
 * PATCH /api/files/:id — rename.
 * DELETE /api/files/:id — move to trash (soft; retention then applies).
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { validateItemName } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.get(id);

    if (!result.ok) {
      throw new AppError(
        result.code === "not_found" ? "not_found" : result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("files.rename", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    // Same validator as upload naming, so a file cannot be renamed to something it
    // could not have been created as.
    const name = validateItemName(requireString(body, "name", { max: 255 }));

    const repo = getDriveRepository();
    const result = await repo.rename({ id, name });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok(result.data);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("files.trash", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.trash({ ids: [id] });

    if (!result.ok) throw new AppError("unknown", result.message);

    // Report what actually moved, and say where it went. A bare 200 would leave the
    // person wondering whether it was deleted for good.
    return ok({ trashed: result.data.length, items: result.data });
  });
}

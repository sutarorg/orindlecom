/**
 * GET /api/folders/:id — the folder (the listing comes from /api/files?parentId=).
 * PATCH /api/folders/:id — rename.
 * DELETE /api/folders/:id — trash it and everything inside.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, validateItemName, withActor } from "@/lib/api";
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
        result.code === "not_found"
          ? "not_found"
          : result.code === "not_configured"
            ? "not_configured"
            : "unknown",
        result.message,
      );
    }

    // A file id passed to an endpoint that promises a folder is a client bug worth
    // naming rather than returning a file object under a folder route.
    if (result.data.kind !== "folder") {
      throw new AppError("not_found", "That folder doesn't exist.");
    }

    return ok(result.data);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("folders.rename", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
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
      userBucket("folders.trash", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.trash({ ids: [id] });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ trashed: result.data.length, items: result.data });
  });
}

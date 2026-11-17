/**
 * GET /api/folders — every folder this user owns, as a flat list for a picker.
 *
 * POST /api/folders — create a folder.
 *
 * Folders need no storage reservation: they hold no bytes. Quota is charged to the
 * files inside them, so creating a folder can never push an account over its
 * allowance.
 *
 * The GET exists for the Move dialog, which has to offer every possible destination
 * — including a folder nested several levels down — without the client walking the
 * tree one request per level. It returns id, name, parent and depth only: enough to
 * render an indented list, and nothing about the files inside.
 */

import "server-only";

import {
  enforceRateLimit,
  handle,
  ok,
  readJson,
  requireString,
  requireUuid,
  validateItemName,
  withActor,
} from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const repo = getDriveRepository();
    const result = await repo.list({ scope: "folders", parentId: undefined });

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    /*
     * Only folders, and only the three fields a picker needs. `list` with
     * `scope: "folders"` already excludes files; the explicit map is what stops this
     * becoming a way to read a whole drive's metadata by asking for a folder picker.
     */
    const folders = result.data.items
      .filter((item) => item.kind === "folder")
      .map((item) => ({ id: item.id, name: item.name, parentId: item.parentId }));

    return ok({ folders });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("folders.create", auth.actor.userId),
      LIMITS.createItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const name = validateItemName(requireString(body, "name", { max: 255 }));
    const parentId = requireUuid(body, "parentId", true);

    const repo = getDriveRepository();
    const result = await repo.createFolder({ name, parentId });

    if (!result.ok) {
      throw new AppError(
        result.code === "conflict"
          ? "conflict"
          : result.code === "quota_exceeded"
            ? "quota_exceeded"
            : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

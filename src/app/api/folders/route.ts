/**
 * POST /api/folders — create a folder.
 *
 * Folders need no storage reservation: they hold no bytes. Quota is charged to the
 * files inside them, so creating a folder can never push an account over its
 * allowance.
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

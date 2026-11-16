/**
 * POST /api/trash/restore — put items back where they were.
 *
 * Restoring is the one trash action that must never fail silently: the person
 * clicked it because they want the file back, and a toast that says "restored"
 * when a quota or permission check refused is worse than an error.
 *
 * The repository reports how many items it actually restored, and that number is
 * what the response carries. Nothing is inferred from the request.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireStringArray, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("trash.restore", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const ids = requireStringArray(body, "ids", 500);

    const repo = getDriveRepository();
    const result = await repo.restore({ ids });

    if (!result.ok) {
      throw new AppError(
        result.code === "not_found" ? "not_found" : "unknown",
        result.message,
      );
    }

    return ok({ restored: result.data.length, items: result.data });
  });
}

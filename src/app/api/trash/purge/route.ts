/**
 * POST /api/trash/purge — delete permanently, now.
 *
 * This is the one genuinely destructive endpoint in the product. Two things make it
 * safe to expose:
 *
 *   - It only acts on rows that are already in the bin. A live file's id passed here
 *     is refused rather than deleted, so a mistyped request cannot skip the trash.
 *   - The R2 object is deleted before the row. A crash between the two leaves an
 *     orphan the sweeper collects, which is recoverable; deleting the row first would
 *     leave bytes nobody can find.
 */

import "server-only";

import {
  enforceRateLimit,
  handle,
  ok,
  readJson,
  requireStringArray,
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

    // Deliberately tighter than other trash actions: emptying the bin in a loop is
    // not a thing a person does.
    const limited = await enforceRateLimit(
      userBucket("trash.purge", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const ids = requireStringArray(body, "ids", 100);

    const repo = getDriveRepository();
    const result = await repo.purge({ ids });

    if (!result.ok) {
      // A refusal here is usually "that item isn't in the bin", which the repository
      // reports as a conflict rather than silently deleting a live file.
      throw new AppError(result.code === "conflict" ? "conflict" : "unknown", result.message);
    }

    return ok({ purged: ids.length });
  });
}

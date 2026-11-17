/**
 * GET /api/trash — items in the bin, each with its remaining days.
 * DELETE /api/trash — empty the bin.
 *
 * `daysRemaining` is computed here, from the same retention constant the cleanup job
 * reads, so the UI never does date arithmetic that could disagree with what actually
 * gets deleted.
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
import { TRASH_RETENTION } from "@/lib/drive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const repo = getDriveRepository();
    const result = await repo.list({ scope: "trash" });

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    const now = Date.now();
    const items = result.data.items.map((item) => {
      /*
       * Days remaining, from the row's own deadline.
       *
       * The repository computes `purgeAt` from the row's `deleted_at` plus the
       * retention period, because `deleted_at` is only readable through the bin's
       * function. This route just converts it to a number of days, so the UI never
       * does date arithmetic that could disagree with what the cleanup job actually
       * deletes.
       *
       * A missing `purgeAt` means the row has no deletion timestamp, which should
       * not happen — falling back to the full window is the least alarming answer,
       * and it is not silently reported as "expired".
       */
      const purgeAt = item.purgeAt ? new Date(item.purgeAt).getTime() : null;
      const daysRemaining =
        purgeAt === null || !Number.isFinite(purgeAt)
          ? TRASH_RETENTION.days
          : Math.max(0, Math.ceil((purgeAt - now) / 86_400_000));
      return { ...item, daysRemaining };
    });

    return ok({ items, total: result.data.total });
  });
}

/**
 * POST /api/trash — move items to the bin.
 *
 * Batch rather than per-id because the selection bar offers one action for a
 * selection, and N sequential requests would let a partial failure leave the list
 * disagreeing with the bar. One call, one result count.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("trash.move", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const ids = requireStringArray(body, "ids", 500);

    const repo = getDriveRepository();
    const result = await repo.trash({ ids });

    if (!result.ok) throw new AppError("unknown", result.message);

    // Report what actually moved. A folder with descendants moves as one entry here;
    // its children travel with it.
    return ok({ trashed: result.data.length, items: result.data });
  });
}

export async function DELETE() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("trash.empty", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const repo = getDriveRepository();
    const result = await repo.emptyTrash();

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ emptied: true });
  });
}

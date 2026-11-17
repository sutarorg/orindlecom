/**
 * POST | DELETE /api/uploads/:taskId/cancel — release the reservation immediately.
 *
 * Idempotent: cancelling twice is harmless, because the reservation status check
 * makes the second release a no-op.
 *
 * ── Why DELETE is also handled ──────────────────────────────────────────────
 *
 * This route only exported POST, but every caller in the browser sends DELETE. Each
 * of those calls was therefore a 405 that nobody looked at, because they are all
 * fired with `void api.delete(...)` — the failure was invisible by construction.
 *
 * The consequence was not cosmetic. `prepare` reserves the declared bytes against
 * the account's quota, and that reservation is only released on complete or cancel.
 * An upload whose browser PUT failed (a blocked request, a closed tab) therefore
 * left its bytes reserved with no file behind them, and `used` counts reservations —
 * so a customer who tried to upload 107 MB watched their storage report 107 MB with
 * nothing in it, until a daily sweep eventually reclaimed it.
 *
 * Both verbs are accepted rather than changing the callers, so a cached bundle
 * still holding the old request shape also works.
 */

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { cancelUpload } from "@/domain/storage/upload-service";

export const runtime = "nodejs";

async function cancel(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("upload.cancel", auth.actor.userId),
      LIMITS.uploadComplete,
    );
    if (limited) return limited;

    const { taskId } = await params;
    await cancelUpload(auth.actor, taskId);
    return ok({ cancelled: true });
  });
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return cancel(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return cancel(request, context);
}

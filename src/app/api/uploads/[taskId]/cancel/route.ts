/**
 * POST /api/uploads/:taskId/cancel — release the reservation immediately.
 *
 * Idempotent: cancelling twice is harmless, because the reservation status check
 * makes the second release a no-op.
 */

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { cancelUpload } from "@/domain/storage/upload-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
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

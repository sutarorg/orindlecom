/**
 * POST /api/uploads/:taskId/cancel — release the reservation immediately.
 *
 * Idempotent: cancelling twice is harmless, because the reservation status check
 * makes the second release a no-op.
 */

import { handle, ok, withActor } from "@/lib/api";
import { cancelUpload } from "@/domain/storage/upload-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { taskId } = await params;
    await cancelUpload(auth.actor, taskId);
    return ok({ cancelled: true });
  });
}

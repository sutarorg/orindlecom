/**
 * POST /api/uploads/:taskId/complete — steps 9–13.
 *
 * The client reports which parts it uploaded; the server does not believe it.
 * Completion is proven by R2's response and a HeadObject, and nothing becomes
 * available until both agree.
 */

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { completeUpload } from "@/domain/storage/upload-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("upload.complete", auth.actor.userId),
      LIMITS.uploadComplete,
    );
    if (limited) return limited;

    const { taskId } = await params;

    // An empty body is legitimate for a single-part upload.
    let parts: { partNumber: number; etag: string }[] | undefined;
    try {
      const body = await readJson(request);
      if (Array.isArray(body.parts)) {
        parts = body.parts
          .filter((p): p is { partNumber: number; etag: string } =>
            Boolean(p) &&
            typeof p === "object" &&
            typeof (p as { partNumber?: unknown }).partNumber === "number" &&
            typeof (p as { etag?: unknown }).etag === "string",
          )
          .map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      }
    } catch {
      // No body: fine for single-part.
    }

    const file = await completeUpload(auth.actor, taskId, { parts });
    return ok({ file });
  });
}

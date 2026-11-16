/**
 * POST /api/download/:id — mint a short-lived signed read URL.
 *
 * POST rather than GET because it is not idempotent from a caching perspective and
 * because a GET URL that returns a download link is the kind of thing a browser
 * prefetches. The signed URL it returns expires in five minutes.
 *
 * Authorisation is not performed here. The repository reads the row through the
 * caller's own client, so RLS decides visibility, and the query additionally
 * requires status = 'available' so a quarantined upload cannot be read around the
 * scan gate.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("download", auth.actor.userId),
      LIMITS.download,
    );
    if (limited) return limited;

    const { id } = await params;

    // The body is optional: a caller that omits it gets an attachment.
    const body = await readJson(request).catch(() => ({}) as Record<string, unknown>);
    const disposition = body.disposition === "inline" ? "inline" : "attachment";

    const repo = getDriveRepository();
    const result = await repo.downloadUrl({ id, disposition });

    if (!result.ok) {
      // Pass the repository's own reason through rather than a generic message:
      // "that person doesn't have an account" and "that file isn't available" mean
      // different things to the person reading it.
      const { AppError } = await import("@/domain/auth/errors");
      throw new AppError(result.code === "not_found" ? "not_found" : "unknown", result.message);
    }

    return ok(result.data);
  });
}

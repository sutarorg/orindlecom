/**
 * GET   /api/users/me — the caller's profile.
 * PATCH /api/users/me — update the display name.
 *
 * There is no `{ userId }` parameter anywhere: identity comes from the session, and
 * the update goes through a client that RLS restricts to the caller's own row.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    return ok({
      userId: auth.actor.userId,
      email: auth.actor.email,
      displayName: auth.actor.fullName,
      emailVerified: auth.actor.emailVerified,
    });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("profile.update", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const fullName = requireString(body, "fullName", { max: 120 }).trim();

    if (fullName.length < 1) {
      throw new AppError("validation_failed", "Enter the name you'd like us to use.");
    }

    const repo = getDriveRepository();
    const result = await repo.updateProfile({ fullName });

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

/**
 * PATCH  /api/grants/:grantId — change permission.
 * DELETE /api/grants/:grantId — revoke.
 *
 * Both act on the grant row through the caller's own client, so RLS decides whether
 * they own the file it belongs to.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import type { PermissionLevel } from "@/lib/drive/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ grantId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("share.update", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { grantId } = await params;
    const body = await readJson(request);

    // `commenter` used to be missing from this list, so changing a grant to "Can
    // comment" failed while "Can edit" was accepted. Both halves are now the other
    // way around: comment is a real level and edit no longer exists.
    if (body.permission !== "viewer" && body.permission !== "commenter") {
      throw new AppError("validation_failed", "Choose whether they can view or comment.");
    }

    const repo = getDriveRepository();
    const result = await repo.updateGrant({
      grantId,
      permission: body.permission as PermissionLevel,
    });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok(result.data);
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("share.revoke", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { grantId } = await params;
    const repo = getDriveRepository();
    const result = await repo.removeGrant({ grantId });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ revoked: true });
  });
}

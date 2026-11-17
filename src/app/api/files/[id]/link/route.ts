/**
 * GET    /api/files/:id/link — the current link, or null when none exists.
 * PUT    /api/files/:id/link — create or re-enable a link.
 * DELETE /api/files/:id/link — revoke it.
 *
 * There is no "never expires" option. A permanent unauthenticated URL to a private
 * file is the thing links exist to avoid, so the longest window offered is bounded.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.shareLink(id);

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("share.link", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    /*
     * Three levels, matching the three public pages. `commenter` was missing here
     * even though the dialog offered it, so choosing "Can comment" made the PUT fail
     * and the link stayed on its previous permission — the select moved and nothing
     * behind it did.
     */
    if (
      body.permission !== "viewer" &&
      body.permission !== "commenter" &&
      body.permission !== "editor"
    ) {
      throw new AppError("validation_failed", "Choose whether the link can view, comment or edit.");
    }

    const repo = getDriveRepository();
    const result = await repo.setShareLink({
      itemId: id,
      enabled: true,
      permission: body.permission,
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
      userBucket("share.link.revoke", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.setShareLink({ itemId: id, enabled: false, permission: "viewer" });

    if (!result.ok) throw new AppError("unknown", result.message);
    return ok({ revoked: true, link: result.data });
  });
}

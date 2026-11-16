import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import { setFolderAccess } from "@/domain/business/service";
import type { FolderAccess } from "@/lib/business/types";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.folder.access", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id, folderId } = await params;
    const body = await readJson(request);

    if (typeof body.openToOrganization !== "boolean") {
      throw new AppError("validation_failed", "Specify whether the folder is open to the organization.");
    }
    if (
      body.defaultAccess !== "viewer" &&
      body.defaultAccess !== "commenter" &&
      body.defaultAccess !== "editor"
    ) {
      throw new AppError("validation_failed", "Choose viewer, commenter, or editor.");
    }

    const rawGrants = Array.isArray(body.grants) ? body.grants : [];
    const grants: Array<{ memberId: string; access: FolderAccess }> = rawGrants
      .filter(
        (entry): entry is { memberId: string; access: FolderAccess } =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as Record<string, unknown>).memberId === "string" &&
          ((entry as Record<string, unknown>).access === "viewer" ||
            (entry as Record<string, unknown>).access === "commenter" ||
            (entry as Record<string, unknown>).access === "editor"),
      )
      .map((entry) => ({ memberId: entry.memberId, access: entry.access }));

    const folder = await setFolderAccess(auth.actor, id, folderId, {
      openToOrganization: body.openToOrganization,
      defaultAccess: body.defaultAccess,
      grants,
    });
    return ok({ folder });
  });
}

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import {
  deleteOrganization,
  getOrganization,
  updateOrganization,
} from "@/domain/business/service";
import type { FolderAccess } from "@/lib/business/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const organization = await getOrganization(auth.actor, id);
    return ok({ organization });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.update", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    const name = typeof body.name === "string" ? body.name : undefined;
    const initials = typeof body.initials === "string" ? body.initials : undefined;
    const defaultFolderAccess =
      typeof body.defaultFolderAccess === "string"
        ? (body.defaultFolderAccess as FolderAccess)
        : undefined;

    const organization = await updateOrganization(auth.actor, id, {
      name,
      initials,
      defaultFolderAccess,
    });
    return ok({ organization });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.delete", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    const confirmation = requireString(body, "confirmation", { max: 120 });

    await deleteOrganization(auth.actor, id, confirmation);
    return ok({ deleted: true });
  });
}

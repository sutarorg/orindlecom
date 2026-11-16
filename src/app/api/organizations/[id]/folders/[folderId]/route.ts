import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { deleteFolder, getFolder, renameFolder } from "@/domain/business/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id, folderId } = await params;
    const folder = await getFolder(auth.actor, id, folderId);
    return ok({ folder });
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.folder.rename", auth.actor.userId),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const { id, folderId } = await params;
    const body = await readJson(request);
    const name = requireString(body, "name", { max: 120 });

    const folder = await renameFolder(auth.actor, id, folderId, name);
    return ok({ folder });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; folderId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.folder.delete", auth.actor.userId),
      LIMITS.trashItem,
    );
    if (limited) return limited;

    const { id, folderId } = await params;
    await deleteFolder(auth.actor, id, folderId);
    return ok({ deleted: true });
  });
}

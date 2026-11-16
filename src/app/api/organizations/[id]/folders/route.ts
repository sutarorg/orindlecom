import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { createFolder, listFolders } from "@/domain/business/service";

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
    const folders = await listFolders(auth.actor, id);
    return ok({ folders });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.folder.create", auth.actor.userId),
      LIMITS.createItem,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    const name = requireString(body, "name", { max: 120 });

    const folder = await createFolder(auth.actor, id, { name });
    return ok({ folder }, { status: 201 });
  });
}

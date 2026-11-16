import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getOrganizationStorage } from "@/domain/business/service";

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
    const storage = await getOrganizationStorage(auth.actor, id);
    return ok(storage);
  });
}

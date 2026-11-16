import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getOrganizationSummary } from "@/domain/business/service";

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
    const summary = await getOrganizationSummary(auth.actor, id);
    return ok(summary);
  });
}

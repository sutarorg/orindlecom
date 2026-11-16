import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { listActivity } from "@/domain/business/service";
import type { BusinessEventKind } from "@/lib/business/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const since = url.searchParams.get("since") ?? undefined;
    const limitParam = Number(url.searchParams.get("limit") ?? 100);
    const kindsParam = url.searchParams.get("kinds");
    const kinds = kindsParam
      ? (kindsParam.split(",").filter(Boolean) as BusinessEventKind[])
      : undefined;

    const events = await listActivity(auth.actor, id, {
      search,
      since,
      kinds,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100,
    });
    return ok({ events });
  });
}

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { createOrganization, listOrganizations } from "@/domain/business/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const organizations = await listOrganizations(auth.actor);
    return ok({ organizations });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.create", auth.actor.userId),
      LIMITS.createItem,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const name = requireString(body, "name", { max: 120 });
    const initials = typeof body.initials === "string" ? body.initials : undefined;

    const organization = await createOrganization(auth.actor, { name, initials });
    return ok({ organization }, { status: 201 });
  });
}

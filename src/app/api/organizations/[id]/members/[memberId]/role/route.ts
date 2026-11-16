import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { changeMemberRole } from "@/domain/business/service";
import type { BusinessRole } from "@/lib/business/types";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.member.role", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id, memberId } = await params;
    const body = await readJson(request);
    const role = requireString(body, "role", { max: 16 }) as BusinessRole;

    const member = await changeMemberRole(auth.actor, id, memberId, role);
    return ok({ member });
  });
}

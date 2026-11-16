import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireUuid, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { transferOwnership } from "@/domain/business/service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.transfer", auth.actor.userId),
      LIMITS.checkout,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    const memberId = requireUuid(body, "memberId");

    const member = await transferOwnership(auth.actor, id, memberId);
    return ok({ member });
  });
}

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { acceptInvitation } from "@/domain/business/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.invite.accept", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const token = requireString(body, "token", { max: 128 });

    const organization = await acceptInvitation(auth.actor, token);
    return ok({ organization });
  });
}

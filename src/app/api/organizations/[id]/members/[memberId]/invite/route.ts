import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { revokeInvitation } from "@/domain/business/service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.invite.revoke", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id, memberId } = await params;
    await revokeInvitation(auth.actor, id, memberId);
    return ok({ revoked: true });
  });
}

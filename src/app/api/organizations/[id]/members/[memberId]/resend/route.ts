import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { resendInvitation } from "@/domain/business/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.invite.resend", auth.actor.userId),
      LIMITS.emailSend,
    );
    if (limited) return limited;

    const { id, memberId } = await params;
    const member = await resendInvitation(auth.actor, id, memberId);
    return ok({ member });
  });
}

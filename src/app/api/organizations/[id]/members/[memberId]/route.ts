import "server-only";

import { enforceRateLimit, handle, ok, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getMember, removeMember } from "@/domain/business/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id, memberId } = await params;
    const member = await getMember(auth.actor, id, memberId);
    return ok({ member });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.member.remove", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id, memberId } = await params;
    await removeMember(auth.actor, id, memberId);
    return ok({ removed: true });
  });
}

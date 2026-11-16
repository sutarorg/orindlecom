import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { inviteMember, listMembers } from "@/domain/business/service";
import type { BusinessRole, FolderAccess, MemberStatus } from "@/lib/business/types";

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
    const status = (url.searchParams.get("status") ?? "all") as MemberStatus | "all";
    const role = (url.searchParams.get("role") ?? "all") as BusinessRole | "all";

    const members = await listMembers(auth.actor, id, { search, status, role });
    return ok({ members });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("org.invite", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);
    const email = requireString(body, "email", { max: 254 });
    const role = requireString(body, "role", { max: 16 }) as Exclude<BusinessRole, "owner">;
    const folderId = typeof body.folderId === "string" && body.folderId ? body.folderId : null;
    const folderAccess =
      typeof body.folderAccess === "string" ? (body.folderAccess as FolderAccess) : undefined;

    const member = await inviteMember(auth.actor, id, {
      email,
      role,
      folderId,
      folderAccess,
    });
    return ok({ member }, { status: 201 });
  });
}

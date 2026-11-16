/**
 * Server-side organization permission checks.
 *
 * Delegates directly to the shared role definitions in `src/lib/business/roles.ts`
 * so the API routes and the UI never disagree about what Owner, Admin, and
 * Member are allowed to do.
 */

import "server-only";

import { AppError } from "@/domain/auth/errors";
import { can, removalBlocker, roleChangeBlocker } from "@/lib/business/roles";
import type { BusinessRole, Capability, Member } from "@/lib/business/types";

export function assertCapability(role: BusinessRole, capability: Capability, message?: string): void {
  if (!can(role, capability)) {
    throw new AppError(
      "forbidden",
      message ?? "Your role in this organization doesn't allow that action.",
    );
  }
}

export function assertCanInviteRole(actorRole: BusinessRole, targetRole: BusinessRole): void {
  assertCapability(actorRole, "members.invite", "Only owners and admins can invite members.");
  if (targetRole === "owner") {
    throw new AppError(
      "forbidden",
      "Invitations cannot be sent with the owner role. Transfer ownership from Settings instead.",
    );
  }
  if (targetRole !== "admin" && targetRole !== "member") {
    throw new AppError("validation_failed", "Choose admin or member for the invitation role.");
  }
}

export function assertCanChangeRole(
  actorRole: BusinessRole,
  target: Pick<Member, "role" | "isViewer">,
  nextRole: BusinessRole,
): void {
  assertCapability(actorRole, "members.changeRole", "Only owners and admins can change roles.");
  const blocker = roleChangeBlocker({
    actorRole,
    targetRole: target.role,
    nextRole,
    isSelf: target.isViewer,
  });
  if (blocker) {
    throw new AppError("forbidden", blocker);
  }
}

export function assertCanRemoveMember(
  actorRole: BusinessRole,
  target: Pick<Member, "role" | "isViewer" | "isLastOwner">,
): void {
  assertCapability(actorRole, "members.remove", "Only owners and admins can remove members.");
  const blocker = removalBlocker({
    actorRole,
    targetRole: target.role,
    isSelf: target.isViewer,
    isLastOwner: target.isLastOwner,
  });
  if (blocker) {
    throw new AppError(target.isLastOwner ? "conflict" : "forbidden", blocker);
  }
}

export function assertCanTransferOwnership(
  actorRole: BusinessRole,
  target: Pick<Member, "status" | "isViewer" | "userId">,
): void {
  assertCapability(
    actorRole,
    "members.transferOwnership",
    "Only the current owner can transfer ownership.",
  );
  if (target.isViewer) {
    throw new AppError("validation_failed", "You are already the owner of this organization.");
  }
  if (target.status !== "active" || !target.userId) {
    throw new AppError(
      "validation_failed",
      "Ownership can only be transferred to an active member who has accepted their invitation.",
    );
  }
}

/**
 * The role ladder and its capabilities.
 *
 * This file is the single source of truth for "who can do what". Every selector,
 * every disabled button and every permissions table reads from here, so a rule
 * changes in one place and every screen follows.
 *
 * The hierarchy is strictly ordered: owner ⊃ admin ⊃ member. A person can never
 * grant or act on a role above their own, and the UI enforces that before the
 * backend has to.
 */

import { ROLE_RANK, type BusinessRole, type Capability, type RoleDefinition } from "./types";

export const ROLES: RoleDefinition[] = [
  {
    id: "owner",
    name: "Owner",
    summary: "Full control, including billing and who else is an owner.",
    detail:
      "The owner is accountable for the organization. They can change anything, including transferring ownership to somebody else. Exactly one owner exists at a time.",
    accent: "violet",
    capabilities: [
      "members.view",
      "members.invite",
      "members.remove",
      "members.changeRole",
      "members.transferOwnership",
      "folders.create",
      "folders.delete",
      "folders.manageAccess",
      "storage.view",
      "activity.view",
      "org.edit",
      "org.delete",
      "billing.manage",
    ],
  },
  {
    id: "admin",
    name: "Admin",
    summary: "Runs the team day to day. Cannot change billing or ownership.",
    detail:
      "Admins manage people and folders: invite, remove, set roles up to admin, and control access on shared folders. Billing and ownership stay with the owner because those are the two decisions that can't be undone by somebody else.",
    accent: "blue",
    capabilities: [
      "members.view",
      "members.invite",
      "members.remove",
      "members.changeRole",
      "folders.create",
      "folders.delete",
      "folders.manageAccess",
      "storage.view",
      "activity.view",
      "org.edit",
    ],
  },
  {
    id: "member",
    name: "Member",
    summary: "Works inside shared folders. Cannot manage people.",
    detail:
      "Members upload, edit and organise inside the folders they've been given access to. They can see who else is on the team and what is happening, which is what makes a shared drive feel shared rather than secretive.",
    accent: "slate",
    capabilities: [
      "members.view",
      "folders.create",
      "storage.view",
      "activity.view",
    ],
  },
];

const BY_ID = new Map(ROLES.map((role) => [role.id, role]));

export function roleDefinition(role: BusinessRole): RoleDefinition {
  const found = BY_ID.get(role);
  if (!found) throw new Error(`Unknown role: ${role}`);
  return found;
}

export function roleName(role: BusinessRole): string {
  return roleDefinition(role).name;
}

/** Capabilities for a role as a Set, for `can()` checks. */
export function capabilitiesOf(role: BusinessRole): Set<Capability> {
  return new Set(roleDefinition(role).capabilities);
}

export function can(role: BusinessRole, capability: Capability): boolean {
  return roleDefinition(role).capabilities.includes(capability);
}

/** True when `actor` outranks `target`. Equal ranks cannot act on each other. */
export function outranks(actor: BusinessRole, target: BusinessRole): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

/** True when `actor` may assign `role`. You cannot promote past your own rank. */
export function canAssignRole(actor: BusinessRole, role: BusinessRole): boolean {
  return ROLE_RANK[actor] >= ROLE_RANK[role] && actor !== "member";
}

/**
 * Why a role change is blocked, phrased for a human, or null when it's allowed.
 *
 * Returning a reason rather than a boolean means the UI can explain the
 * boundary instead of showing a silent disabled control — which is the single
 * most common accessibility failure in permission screens.
 */
export function roleChangeBlocker({
  actorRole,
  targetRole,
  nextRole,
  isSelf,
}: {
  actorRole: BusinessRole;
  targetRole: BusinessRole;
  nextRole: BusinessRole;
  isSelf: boolean;
}): string | null {
  if (isSelf) return "You can't change your own role.";
  if (targetRole === "owner" || nextRole === "owner") {
    return "Ownership is transferred from the ownership card, not from this list.";
  }
  if (!outranks(actorRole, targetRole)) {
    return `A ${roleName(actorRole).toLowerCase()} can't change the role of a ${roleName(targetRole).toLowerCase()}.`;
  }
  if (!canAssignRole(actorRole, nextRole)) {
    return `You can't assign a role above your own.`;
  }
  return null;
}

/**
 * Why a member can't be removed, phrased for a human, or null when they can.
 */
export function removalBlocker({
  actorRole,
  targetRole,
  isSelf,
  isLastOwner,
}: {
  actorRole: BusinessRole;
  targetRole: BusinessRole;
  isSelf: boolean;
  isLastOwner: boolean;
}): string | null {
  if (isSelf) return "You can't remove yourself. Leave the organization instead.";
  if (targetRole === "owner") return "The owner has to transfer ownership before leaving.";
  if (isLastOwner) return "This is the only owner. Transfer ownership first.";
  if (!outranks(actorRole, targetRole)) {
    return "You can only remove people below your own role.";
  }
  return null;
}

/** Roles the viewer is allowed to assign, for populating a selector. */
export function assignableRoles(actor: BusinessRole): BusinessRole[] {
  if (actor === "owner") return ["admin", "member"];
  if (actor === "admin") return ["admin", "member"];
  return [];
}

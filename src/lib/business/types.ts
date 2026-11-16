/**
 * Business workspace data contract.
 *
 * The organization, its members, its invitations and its shared folders are
 * separate from the personal drive — a person can own files and belong to a
 * team, and the two must never be confused about which one a query is scoped
 * to. Everything here is organization-scoped: no type in this file can express
 * "some file somewhere".
 *
 * Two rules encoded here rather than documented elsewhere:
 *   1. Only roles the backend actually enforces appear. There are three, and
 *      `ROLES` is the only list the UI reads.
 *   2. An invitation carries the role assigned at invite time. The invitee
 *      never chooses it — that decision belongs to whoever is accountable.
 */

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */

/**
 * Owner · Admin · Member.
 *
 * Deliberately not four or five. Every extra tier is a tier somebody has to
 * explain in a support ticket, and a three-tier ladder covers "runs the
 * business", "runs the team" and "does the work" for the size of organization
 * this product is for.
 */
export type BusinessRole = "owner" | "admin" | "member";

/** Higher rank = more authority. Used for every comparison in the UI. */
export const ROLE_RANK: Record<BusinessRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export interface RoleDefinition {
  id: BusinessRole;
  name: string;
  /** One line, plain language. Shown in selectors and on the permissions page. */
  summary: string;
  /** Longer explanation for the permissions page. */
  detail: string;
  /** Capabilities this role grants. The authoritative list is in `roles.ts`. */
  capabilities: Capability[];
  /** Distinct from the other two at a glance. */
  accent: "violet" | "blue" | "slate";
}

/**
 * Everything a role can be granted.
 *
 * Named as `area.action` because that is how they're described to a human in
 * the permissions table: "Members — invite" reads better than `canInvite`.
 */
export type Capability =
  | "members.view"
  | "members.invite"
  | "members.remove"
  | "members.changeRole"
  | "members.transferOwnership"
  | "folders.create"
  | "folders.delete"
  | "folders.manageAccess"
  | "storage.view"
  | "activity.view"
  | "org.edit"
  | "org.delete"
  | "billing.manage";

/** Invitations expire. Read from config, never hard-coded in a component. */
export const INVITATION_EXPIRY_DAYS = 7;

/* ------------------------------------------------------------------ */
/*  Organization                                                       */
/* ------------------------------------------------------------------ */

export interface Organization {
  id: string;
  name: string;
  /** Short display name for the sidebar switcher when the full name is long. */
  shortName: string;
  /** Two-letter mark for the org badge. Derived by the backend, not the client. */
  initials: string;
  /** ISO 8601, or null when the backend hasn't recorded it. */
  createdAt: string | null;
  /** The viewer's own role in this organization. */
  viewerRole: BusinessRole;
  /** Plan the organization is billed on. Mirrors `StorageAllocation.planName`. */
  planName: string;
  /** True when the organization has finished first-run setup. */
  onboarded: boolean;
}

export interface BusinessStorage {
  planId: string;
  planName: string;
  /** Bytes. */
  used: number;
  /** Bytes — the organization's allowance, not the viewer's personal plan. */
  total: number;
  byCategory: Record<string, number>;
  fileCount: number;
  folderCount: number;
  /** False when the figures are the allowance only, not measured usage. */
  authoritative: boolean;
  /**
   * Per-member usage, when the backend can attribute bytes to people. Absent
   * rather than zero-filled — a member list showing "0 B" for everyone when
   * attribution hasn't run would read as fact.
   */
  byMember?: Array<{ memberId: string; name: string; used: number }>;
}

/* ------------------------------------------------------------------ */
/*  Members                                                            */
/* ------------------------------------------------------------------ */

export type MemberStatus =
  | "active"
  /** Invitation sent, not yet accepted. */
  | "invited"
  /** Invitation expired before acceptance. A fresh invite is required. */
  | "expired"
  /** Invitation bounced or was rejected by the mail provider. */
  | "failed"
  /** Access suspended by an admin; the account still exists. */
  | "suspended";

export interface Member {
  id: string;
  /** Null for a pending invitation — there is no account yet. */
  userId: string | null;
  email: string;
  /** Null until the invitee accepts and sets a name. */
  name: string | null;
  role: BusinessRole;
  status: MemberStatus;
  /** ISO 8601. */
  joinedAt: string | null;
  /** ISO 8601 of the most recent invitation, for invited/expired/failed. */
  invitedAt: string | null;
  /** ISO 8601 expiry of the live invitation. Null when accepted or absent. */
  invitationExpiresAt: string | null;
  /** ISO 8601, or null when never signed in. */
  lastActiveAt: string | null;
  /** True for the viewer's own row, so the UI can mark it and guard it. */
  isViewer: boolean;
  /** True when this is the organization's only remaining owner. */
  isLastOwner: boolean;
}

/* ------------------------------------------------------------------ */
/*  Shared folders                                                     */
/* ------------------------------------------------------------------ */

/** Access level on a shared folder. Mirrors the personal drive's levels. */
export type FolderAccess = "viewer" | "commenter" | "editor";

export const FOLDER_ACCESS_LABEL: Record<FolderAccess, string> = {
  viewer: "Can view",
  commenter: "Can comment",
  editor: "Can edit",
};

export const FOLDER_ACCESS_DESCRIPTION: Record<FolderAccess, string> = {
  viewer: "Open and download. Cannot change anything inside.",
  commenter: "Open, download, and leave comments on files.",
  editor: "Add, rename and remove files inside this folder.",
};

export interface BusinessFolder {
  id: string;
  name: string;
  /** Files and folders directly inside. */
  itemCount: number;
  /** Bytes. */
  size: number;
  /** ISO 8601. */
  modifiedAt: string;
  /** Member id of whoever created it. */
  createdBy: string;
  /** Display name of the creator, resolved by the backend. */
  createdByName: string;
  /** Explicit per-member grants on this folder. */
  access: Array<{
    memberId: string;
    name: string;
    email: string;
    access: FolderAccess;
  }>;
  /**
   * When true the folder is visible to every member at `defaultAccess`.
   * When false only the grants above apply.
   */
  openToOrganization: boolean;
  defaultAccess: FolderAccess;
  /** True when the viewer may change access on this folder. */
  canManage: boolean;
}

/* ------------------------------------------------------------------ */
/*  Activity                                                           */
/* ------------------------------------------------------------------ */

export type BusinessEventKind =
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.roleChanged"
  | "invitation.resent"
  | "invitation.revoked"
  | "folder.created"
  | "folder.accessChanged"
  | "folder.deleted"
  | "file.uploaded"
  | "file.deleted"
  | "settings.changed";

export interface BusinessActivityEvent {
  id: string;
  kind: BusinessEventKind;
  /** ISO 8601. */
  at: string;
  /** Who did it. Null for system events. */
  actorName: string | null;
  actorEmail: string | null;
  /** What it was done to — a member, a folder, a file. */
  targetName: string;
  /** Stable id for linking to the resource, when it still exists. */
  targetId: string | null;
  targetKind: "member" | "folder" | "file" | "organization";
  /** Optional structured detail, e.g. "member → admin". Rendered after the verb. */
  detail?: string;
}

/* ------------------------------------------------------------------ */
/*  Summary (overview)                                                 */
/* ------------------------------------------------------------------ */

export interface BusinessSummary {
  organization: Organization;
  storage: BusinessStorage;
  memberCount: number;
  /** Members with an accepted invitation. */
  activeMemberCount: number;
  /** Invitations awaiting acceptance. */
  pendingInvitationCount: number;
  folderCount: number;
  /** Most recent events, newest first. Empty on a new organization. */
  recentActivity: BusinessActivityEvent[];
}

/* ------------------------------------------------------------------ */
/*  Display copy                                                       */
/* ------------------------------------------------------------------ */

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Active",
  invited: "Invited",
  expired: "Expired",
  failed: "Failed",
  suspended: "Suspended",
};

/**
 * Why a member is in this state, in one short sentence. Rendered under the
 * status pill on a member card and as a tooltip in the table.
 */
export const MEMBER_STATUS_HINT: Record<MemberStatus, string> = {
  active: "Has accepted and can sign in.",
  invited: "Invitation sent, waiting to be accepted.",
  expired: "The invitation ran out before it was accepted.",
  failed: "The invitation couldn't be delivered.",
  suspended: "Access paused. The account still exists.",
};

export const BUSINESS_EVENT_LABEL: Record<BusinessEventKind, string> = {
  "member.invited": "Invited",
  "member.joined": "Joined",
  "member.removed": "Removed",
  "member.roleChanged": "Changed role",
  "invitation.resent": "Resent invitation",
  "invitation.revoked": "Revoked invitation",
  "folder.created": "Created folder",
  "folder.accessChanged": "Changed access",
  "folder.deleted": "Deleted folder",
  "file.uploaded": "Uploaded",
  "file.deleted": "Deleted",
  "settings.changed": "Updated settings",
};

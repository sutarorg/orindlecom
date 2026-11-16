/**
 * The business workspace service contract.
 *
 * Same shape as `DriveRepository`: every method returns a result object, nothing
 * throws, and success is only reported after the backend confirmed it.
 *
 * Every method is organization-scoped. There is no method that reads "the
 * current organization" implicitly, because an account can belong to more than
 * one and an implicit lookup is how a request ends up reading the wrong team's
 * members.
 */

import type {
  BusinessActivityEvent,
  BusinessFolder,
  BusinessRole,
  BusinessStorage,
  BusinessSummary,
  FolderAccess,
  Member,
  MemberStatus,
  Organization,
} from "./types";

export type BusinessErrorCode =
  | "not_configured"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "seat_limit"
  | "last_owner"
  | "already_member"
  | "invalid_email"
  | "rate_limited"
  | "network"
  | "unknown";

export interface BusinessFailure {
  ok: false;
  code: BusinessErrorCode;
  /** Safe to render as-is. */
  message: string;
  fieldErrors?: Record<string, string>;
}

export type BusinessResult<T> = { ok: true; data: T } | BusinessFailure;

export interface InviteInput {
  email: string;
  role: Exclude<BusinessRole, "owner">;
  /** Optional folder to grant on acceptance. Null when no folder is attached. */
  folderId?: string | null;
  folderAccess?: FolderAccess;
}

export interface MemberFilter {
  search?: string;
  status?: MemberStatus | "all";
  role?: BusinessRole | "all";
}

export interface ActivityFilter {
  /** Empty means every kind. */
  kinds?: BusinessActivityEvent["kind"][];
  /** ISO 8601 lower bound. */
  since?: string;
  search?: string;
  limit?: number;
}

export interface BusinessRepository {
  /** True when the organization service is connected and calls can succeed. */
  readonly configured: boolean;

  /** Organizations the viewer belongs to, for the workspace switcher. */
  organizations(): Promise<BusinessResult<Organization[]>>;
  organization(id: string): Promise<BusinessResult<Organization>>;
  summary(id: string): Promise<BusinessResult<BusinessSummary>>;
  storage(id: string): Promise<BusinessResult<BusinessStorage>>;

  members(orgId: string, filter?: MemberFilter): Promise<BusinessResult<Member[]>>;
  member(orgId: string, memberId: string): Promise<BusinessResult<Member>>;
  invite(orgId: string, input: InviteInput): Promise<BusinessResult<Member>>;
  resendInvitation(orgId: string, memberId: string): Promise<BusinessResult<Member>>;
  revokeInvitation(orgId: string, memberId: string): Promise<BusinessResult<null>>;
  changeRole(orgId: string, memberId: string, role: BusinessRole): Promise<BusinessResult<Member>>;
  removeMember(orgId: string, memberId: string): Promise<BusinessResult<null>>;
  transferOwnership(orgId: string, memberId: string): Promise<BusinessResult<Member>>;

  folders(orgId: string): Promise<BusinessResult<BusinessFolder[]>>;
  folder(orgId: string, folderId: string): Promise<BusinessResult<BusinessFolder>>;
  createFolder(orgId: string, input: { name: string }): Promise<BusinessResult<BusinessFolder>>;
  renameFolder(orgId: string, folderId: string, name: string): Promise<BusinessResult<BusinessFolder>>;
  deleteFolder(orgId: string, folderId: string): Promise<BusinessResult<null>>;
  setFolderAccess(
    orgId: string,
    folderId: string,
    input: {
      openToOrganization: boolean;
      defaultAccess: FolderAccess;
      grants: Array<{ memberId: string; access: FolderAccess }>;
    },
  ): Promise<BusinessResult<BusinessFolder>>;

  activity(orgId: string, filter?: ActivityFilter): Promise<BusinessResult<BusinessActivityEvent[]>>;

  updateOrganization(
    orgId: string,
    input: { name: string; initials?: string },
  ): Promise<BusinessResult<Organization>>;
  deleteOrganization(orgId: string, confirmation: string): Promise<BusinessResult<null>>;
}

/**
 * The one message every unbacked business write reports.
 *
 * Written for the person using the product: what didn't happen, and that
 * nothing was lost. The engineering detail belongs in docs.
 */
export const BUSINESS_NOT_CONNECTED =
  "Team management isn't connected yet, so no changes were saved. Nothing was invited, changed or removed.";

export function businessNotConnected(): BusinessFailure {
  return { ok: false, code: "not_configured", message: BUSINESS_NOT_CONNECTED };
}

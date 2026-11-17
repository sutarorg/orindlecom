/**
 * Business Workspace domain service.
 *
 * Pure server-side orchestration for organizations, members, invitations,
 * shared folders, team storage (inheriting the owner's active plan), and
 * activity logs. Contains no Next.js request/header imports so it can be
 * invoked from route handlers, Server Components, and unit tests alike.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { AppError } from "@/domain/auth/errors";
import type { Actor } from "@/domain/auth/actor";
import { planById, type PlanId } from "@/config/pricing";
import { SITE } from "@/config/site";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend/client";
import { can } from "@/lib/business/roles";
import type { ActivityFilter, InviteInput, MemberFilter } from "@/lib/business/repository";
import {
  INVITATION_EXPIRY_DAYS,
  type BusinessActivityEvent,
  type BusinessEventKind,
  type BusinessFolder,
  type BusinessRole,
  type BusinessStorage,
  type BusinessSummary,
  type FolderAccess,
  type Member,
  type MemberStatus,
  type Organization,
} from "@/lib/business/types";
import {
  assertCanChangeRole,
  assertCanInviteRole,
  assertCanRemoveMember,
  assertCanTransferOwnership,
  assertCapability,
} from "./permissions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCESS_LEVELS = new Set<FolderAccess>(["viewer", "commenter", "editor"]);
const INVALID_FOLDER_CHARS = /[\\/:*?"<>|]/;

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  initials: string | null;
  default_folder_access: FolderAccess | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
  role: BusinessRole;
  status: string;
  invited_by: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  invited_folder_id: string | null;
  invited_folder_access: FolderAccess | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FolderRow {
  id: string;
  owner_id: string;
  organization_id: string;
  parent_id: string | null;
  name: string;
  open_to_organization: boolean | null;
  default_access: FolderAccess | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function deriveInitials(name: string, explicit?: string | null): string {
  const custom = explicit?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
  if (custom && custom.length > 0) return custom;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || "OR").toUpperCase();
}

function deriveShortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length <= 22 ? trimmed : `${trimmed.slice(0, 21).trimEnd()}…`;
}

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(3).toString("hex");
  const candidate = base ? `${base}-${suffix}` : `org-${suffix}`;
  return candidate.slice(0, 62);
}

function validateFolderName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new AppError("validation_failed", "Enter a folder name.");
  if (INVALID_FOLDER_CHARS.test(trimmed)) {
    throw new AppError("validation_failed", `A folder name can't contain \\ / : * ? " < > |`);
  }
  if (trimmed.startsWith(".")) {
    throw new AppError("validation_failed", "A folder name can't start with a dot.");
  }
  if (trimmed.length > 120) {
    throw new AppError("validation_failed", "Keep the folder name under 120 characters.");
  }
  return trimmed;
}

function mapMemberStatus(row: MemberRow): MemberStatus {
  if (row.status === "invited") {
    if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) {
      return "expired";
    }
    return "invited";
  }
  if (row.status === "suspended") return "suspended";
  return "active";
}

async function resolveOwnerPlan(ownerId: string) {
  const db = getServiceClient();
  const { data } = await db
    .from("subscriptions")
    .select("plan_id, status")
    .eq("owner_id", ownerId)
    .in("status", ["active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planId = (data?.plan_id ?? "free") as PlanId;
  return planById(planId);
}

async function loadProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const db = getServiceClient();
  const { data } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);

  for (const row of data ?? []) {
    if (row.full_name) map.set(String(row.id), String(row.full_name));
  }
  return map;
}

interface OrgContext {
  org: OrgRow;
  viewerRole: BusinessRole;
  viewerMemberId: string;
}

/**
 * Resolve an organization ID (or the `"workspace"` sentinel) and verify that
 * the caller is an active member. Throws `not_found` if absent or unauthorized.
 */
async function resolveOrgContext(actor: Actor, orgIdOrWorkspace: string): Promise<OrgContext> {
  const db = getServiceClient();

  if (orgIdOrWorkspace === "workspace") {
    const { data: memberships, error } = await db
      .from("members")
      .select("id, organization_id, role, created_at")
      .eq("user_id", actor.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) throw new AppError("unknown", "We couldn't load your organization.");
    if (!memberships || memberships.length === 0) {
      throw new AppError("not_found", "You don't belong to an organization yet.");
    }

    // Prefer an organization the caller owns, else the earliest joined.
    const preferred = memberships.find((m) => m.role === "owner") ?? memberships[0];
    const { data: org, error: orgError } = await db
      .from("organizations")
      .select("*")
      .eq("id", preferred.organization_id)
      .maybeSingle();

    if (orgError || !org) {
      throw new AppError("not_found", "That organization doesn't exist any more.");
    }

    return {
      org: org as OrgRow,
      viewerRole: preferred.role as BusinessRole,
      viewerMemberId: String(preferred.id),
    };
  }

  if (!UUID_RE.test(orgIdOrWorkspace)) {
    throw new AppError("not_found", "That organization wasn't found.");
  }

  const [{ data: org }, { data: membership }] = await Promise.all([
    db.from("organizations").select("*").eq("id", orgIdOrWorkspace).maybeSingle(),
    db
      .from("members")
      .select("id, role, status")
      .eq("organization_id", orgIdOrWorkspace)
      .eq("user_id", actor.userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (!org || !membership) {
    throw new AppError("not_found", "That organization wasn't found.");
  }

  return {
    org: org as OrgRow,
    viewerRole: membership.role as BusinessRole,
    viewerMemberId: String(membership.id),
  };
}

async function toOrganization(
  org: OrgRow,
  viewerRole: BusinessRole,
  onboarded?: boolean,
): Promise<Organization> {
  const plan = await resolveOwnerPlan(org.owner_id);
  return {
    id: org.id,
    name: org.name,
    shortName: deriveShortName(org.name),
    initials: deriveInitials(org.name, org.initials),
    createdAt: org.created_at ?? null,
    viewerRole,
    planName: plan.name,
    onboarded: onboarded ?? true,
  };
}

async function logOrgEvent(
  orgId: string,
  actorId: string,
  kind: BusinessEventKind,
  subjectType: "member" | "folder" | "file" | "organization",
  subjectId: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const db = getServiceClient();
  await db.from("activity_events").insert({
    actor_id: actorId,
    organization_id: orgId,
    subject_type: subjectType,
    subject_id: subjectId,
    kind,
    metadata,
  });
}

/* ------------------------------------------------------------------ */
/*  Organizations                                                      */
/* ------------------------------------------------------------------ */

export async function listOrganizations(actor: Actor): Promise<Organization[]> {
  const db = getServiceClient();
  const { data: memberships, error } = await db
    .from("members")
    .select("organization_id, role, created_at")
    .eq("user_id", actor.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new AppError("unknown", "We couldn't load your organizations.");
  if (!memberships || memberships.length === 0) return [];

  const orgIds = memberships.map((m) => String(m.organization_id));
  const { data: orgRows, error: orgError } = await db
    .from("organizations")
    .select("*")
    .in("id", orgIds);

  if (orgError) throw new AppError("unknown", "We couldn't load your organizations.");

  const roleByOrg = new Map(memberships.map((m) => [String(m.organization_id), m.role as BusinessRole]));
  const ordered = (orgRows ?? []) as OrgRow[];
  ordered.sort((a, b) => {
    const ra = roleByOrg.get(a.id) === "owner" ? 0 : 1;
    const rb = roleByOrg.get(b.id) === "owner" ? 0 : 1;
    return ra - rb || a.created_at.localeCompare(b.created_at);
  });

  return Promise.all(
    ordered.map((org) => toOrganization(org, roleByOrg.get(org.id) ?? "member", true)),
  );
}

export async function createOrganization(
  actor: Actor,
  input: { name: string; initials?: string },
): Promise<Organization> {
  const name = input.name.trim();
  if (!name || name.length > 120) {
    throw new AppError("validation_failed", "Enter an organization name (up to 120 characters).");
  }

  const initials = deriveInitials(name, input.initials);
  const slug = slugifyName(name);
  const db = getServiceClient();

  const { data: org, error } = await db
    .from("organizations")
    .insert({
      name,
      slug,
      owner_id: actor.userId,
      initials,
      default_folder_access: "viewer",
    })
    .select("*")
    .single();

  if (error || !org) {
    throw new AppError("unknown", "We couldn't create that organization.");
  }

  const { error: memberError } = await db.from("members").insert({
    organization_id: org.id,
    user_id: actor.userId,
    email: actor.email.toLowerCase(),
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    await db.from("organizations").delete().eq("id", org.id);
    throw new AppError("unknown", "We couldn't finish setting up that organization.");
  }

  await logOrgEvent(org.id, actor.userId, "settings.changed", "organization", org.id, {
    targetName: name,
    detail: "Created organization",
  });

  return toOrganization(org as OrgRow, "owner", false);
}

export async function getOrganization(actor: Actor, orgId: string): Promise<Organization> {
  const ctx = await resolveOrgContext(actor, orgId);
  return toOrganization(ctx.org, ctx.viewerRole);
}

export async function updateOrganization(
  actor: Actor,
  orgId: string,
  input: { name?: string; initials?: string; defaultFolderAccess?: FolderAccess },
): Promise<Organization> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "org.edit", "Only owners and admins can edit organization settings.");

  const patch: Record<string, unknown> = {};
  const changes: string[] = [];

  if (typeof input.name === "string") {
    const trimmed = input.name.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new AppError("validation_failed", "Organization name must be between 1 and 120 characters.");
    }
    patch.name = trimmed;
    if (trimmed !== ctx.org.name) changes.push(`renamed to ${trimmed}`);
  }

  if (typeof input.initials === "string") {
    const clean = input.initials.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 2);
    if (clean.length > 0) {
      patch.initials = clean;
      if (clean !== (ctx.org.initials ?? "")) changes.push(`mark set to ${clean}`);
    }
  }

  if (input.defaultFolderAccess !== undefined) {
    if (!ACCESS_LEVELS.has(input.defaultFolderAccess)) {
      throw new AppError("validation_failed", "Choose viewer, commenter, or editor.");
    }
    patch.default_folder_access = input.defaultFolderAccess;
    changes.push(`default folder access set to ${input.defaultFolderAccess}`);
  }

  if (Object.keys(patch).length === 0) {
    return toOrganization(ctx.org, ctx.viewerRole);
  }

  const db = getServiceClient();
  const { data: updated, error } = await db
    .from("organizations")
    .update(patch)
    .eq("id", ctx.org.id)
    .select("*")
    .single();

  if (error || !updated) {
    throw new AppError("unknown", "We couldn't save those organization settings.");
  }

  await logOrgEvent(ctx.org.id, actor.userId, "settings.changed", "organization", ctx.org.id, {
    targetName: (updated as OrgRow).name,
    detail: changes.join(", ") || "Updated organization settings",
  });

  return toOrganization(updated as OrgRow, ctx.viewerRole);
}

export async function deleteOrganization(
  actor: Actor,
  orgId: string,
  confirmation: string,
): Promise<null> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "org.delete", "Only the organization owner can delete it.");

  if (confirmation.trim() !== ctx.org.name.trim()) {
    throw new AppError("validation_failed", "Type the exact organization name to confirm deletion.");
  }

  const db = getServiceClient();
  const { error } = await db.from("organizations").delete().eq("id", ctx.org.id);
  if (error) {
    throw new AppError("unknown", "We couldn't delete the organization.");
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Storage & Summary                                                  */
/* ------------------------------------------------------------------ */

export async function getOrganizationStorage(actor: Actor, orgId: string): Promise<BusinessStorage> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "storage.view");

  const db = getServiceClient();
  const [plan, filesRes, foldersRes, membersRes] = await Promise.all([
    resolveOwnerPlan(ctx.org.owner_id),
    db
      .from("files")
      .select("owner_id, category, size_bytes")
      .eq("organization_id", ctx.org.id)
      .eq("status", "available")
      .is("deleted_at", null),
    db
      .from("folders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.org.id)
      .is("deleted_at", null),
    db
      .from("members")
      .select("id, user_id, email")
      .eq("organization_id", ctx.org.id)
      .eq("status", "active"),
  ]);

  const files = (filesRes.data ?? []) as Array<{
    owner_id: string;
    category: string;
    size_bytes: number;
  }>;

  let used = 0;
  const byCategory: Record<string, number> = {};
  const bytesByUser = new Map<string, number>();

  for (const file of files) {
    const size = Number(file.size_bytes ?? 0);
    used += size;
    byCategory[file.category] = (byCategory[file.category] ?? 0) + size;
    bytesByUser.set(file.owner_id, (bytesByUser.get(file.owner_id) ?? 0) + size);
  }

  const memberRows = (membersRes.data ?? []) as Array<{
    id: string;
    user_id: string | null;
    email: string;
  }>;
  const names = await loadProfileNames(memberRows.map((m) => m.user_id ?? ""));

  const byMember =
    used > 0
      ? memberRows
          .filter((m) => m.user_id && (bytesByUser.get(m.user_id) ?? 0) > 0)
          .map((m) => ({
            memberId: m.id,
            name: (m.user_id ? names.get(m.user_id) : null) ?? m.email,
            used: bytesByUser.get(m.user_id!) ?? 0,
          }))
          .sort((a, b) => b.used - a.used)
      : undefined;

  return {
    planId: plan.id,
    planName: plan.name,
    used,
    total: plan.storageBytes,
    byCategory,
    fileCount: files.length,
    folderCount: foldersRes.count ?? 0,
    authoritative: true,
    byMember,
  };
}

export async function getOrganizationSummary(actor: Actor, orgId: string): Promise<BusinessSummary> {
  const ctx = await resolveOrgContext(actor, orgId);
  const [storage, members, folders, recentActivity] = await Promise.all([
    getOrganizationStorage(actor, ctx.org.id),
    listMembers(actor, ctx.org.id),
    listFolders(actor, ctx.org.id),
    can(ctx.viewerRole, "activity.view")
      ? listActivity(actor, ctx.org.id, { limit: 10 })
      : Promise.resolve([]),
  ]);

  const activeMemberCount = members.filter((m) => m.status === "active").length;
  const pendingInvitationCount = members.filter((m) => m.status === "invited").length;
  const organization = await toOrganization(
    ctx.org,
    ctx.viewerRole,
    activeMemberCount > 1 || folders.length > 0,
  );

  return {
    organization,
    storage,
    memberCount: members.length,
    activeMemberCount,
    pendingInvitationCount,
    folderCount: folders.length,
    recentActivity,
  };
}

/* ------------------------------------------------------------------ */
/*  Members & Invitations                                              */
/* ------------------------------------------------------------------ */

export async function listMembers(
  actor: Actor,
  orgId: string,
  filter?: MemberFilter,
): Promise<Member[]> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "members.view");

  const db = getServiceClient();
  const { data, error } = await db
    .from("members")
    .select("*")
    .eq("organization_id", ctx.org.id)
    .neq("status", "removed")
    .order("created_at", { ascending: true });

  if (error) throw new AppError("unknown", "We couldn't load the member list.");

  const rows = (data ?? []) as MemberRow[];
  const names = await loadProfileNames(rows.map((r) => r.user_id ?? ""));
  const activeOwnerCount = rows.filter((r) => r.role === "owner" && r.status === "active").length;

  let members: Member[] = rows.map((row) => {
    const status = mapMemberStatus(row);
    const isViewer = row.user_id === actor.userId;
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.user_id ? (names.get(row.user_id) ?? null) : null,
      role: row.role,
      status,
      joinedAt: row.joined_at,
      invitedAt: row.status === "active" ? null : row.created_at,
      invitationExpiresAt: status === "invited" ? row.invite_expires_at : null,
      lastActiveAt: row.updated_at,
      isViewer,
      isLastOwner: row.role === "owner" && status === "active" && activeOwnerCount <= 1,
    };
  });

  if (filter?.status && filter.status !== "all") {
    members = members.filter((m) => m.status === filter.status);
  }
  if (filter?.role && filter.role !== "all") {
    members = members.filter((m) => m.role === filter.role);
  }
  if (filter?.search?.trim()) {
    const needle = filter.search.trim().toLowerCase();
    members = members.filter(
      (m) => (m.name ?? "").toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle),
    );
  }

  return members;
}

export async function getMember(actor: Actor, orgId: string, memberId: string): Promise<Member> {
  if (!UUID_RE.test(memberId)) {
    throw new AppError("not_found", "That member wasn't found.");
  }
  const members = await listMembers(actor, orgId);
  const match = members.find((m) => m.id === memberId);
  if (!match) throw new AppError("not_found", "That member wasn't found.");
  return match;
}

export async function inviteMember(
  actor: Actor,
  orgId: string,
  input: InviteInput,
): Promise<Member> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCanInviteRole(ctx.viewerRole, input.role);

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new AppError("validation_failed", "Enter a valid email address.");
  }

  const db = getServiceClient();

  let folderId: string | null = null;
  let folderAccess: FolderAccess | null = null;
  if (input.folderId) {
    if (!UUID_RE.test(input.folderId)) {
      throw new AppError("validation_failed", "Selected folder wasn't found.");
    }
    const { data: folder } = await db
      .from("folders")
      .select("id")
      .eq("id", input.folderId)
      .eq("organization_id", ctx.org.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!folder) throw new AppError("not_found", "Selected folder wasn't found.");
    folderId = folder.id as string;
    folderAccess =
      input.folderAccess && ACCESS_LEVELS.has(input.folderAccess) ? input.folderAccess : "viewer";
  }

  const { data: existing } = await db
    .from("members")
    .select("*")
    .eq("organization_id", ctx.org.id)
    .ilike("email", email)
    .maybeSingle();

  if (existing && existing.status === "active") {
    throw new AppError("conflict", "That person is already an active member of this organization.");
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000).toISOString();

  let savedId: string;
  if (existing) {
    const { data, error } = await db
      .from("members")
      .update({
        role: input.role,
        status: "invited",
        invited_by: actor.userId,
        invite_token: token,
        invite_expires_at: expiresAt,
        invited_folder_id: folderId,
        invited_folder_access: folderAccess,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) {
      logBusinessWriteFailure("updateInvitation", error);
      throw new AppError("unknown", "We couldn't update that invitation.");
    }
    savedId = String(data.id);
  } else {
    const { data, error } = await db
      .from("members")
      .insert({
        organization_id: ctx.org.id,
        email,
        role: input.role,
        status: "invited",
        invited_by: actor.userId,
        invite_token: token,
        invite_expires_at: expiresAt,
        invited_folder_id: folderId,
        invited_folder_access: folderAccess,
      })
      .select("id")
      .single();
    if (error || !data) {
      logBusinessWriteFailure("inviteMember", error);
      throw new AppError("unknown", "We couldn't create that invitation.");
    }
    savedId = String(data.id);
  }

  const inviteUrl = `${SITE.url}/business?invite=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    template: "org-invite",
    data: {
      inviter: actor.fullName || actor.email,
      organization: ctx.org.name,
      role: input.role,
      url: inviteUrl,
    },
  }).catch(() => {});

  await logOrgEvent(ctx.org.id, actor.userId, "member.invited", "member", savedId, {
    targetName: email,
    detail: `as ${input.role}`,
  });

  return getMember(actor, ctx.org.id, savedId);
}

export async function resendInvitation(
  actor: Actor,
  orgId: string,
  memberId: string,
): Promise<Member> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "members.invite", "Only owners and admins can resend invitations.");

  if (!UUID_RE.test(memberId)) {
    throw new AppError("not_found", "That invitation wasn't found.");
  }

  const db = getServiceClient();
  const { data: row } = await db
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!row) throw new AppError("not_found", "That invitation wasn't found.");
  if (row.status === "active") {
    throw new AppError("conflict", "That person has already accepted their invitation.");
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 86_400_000).toISOString();

  const { error } = await db
    .from("members")
    .update({
      status: "invited",
      invited_by: actor.userId,
      invite_token: token,
      invite_expires_at: expiresAt,
    })
    .eq("id", memberId);

  if (error) throw new AppError("unknown", "We couldn't resend that invitation.");

  const inviteUrl = `${SITE.url}/business?invite=${encodeURIComponent(token)}`;
  await sendEmail({
    to: String(row.email),
    template: "org-invite",
    data: {
      inviter: actor.fullName || actor.email,
      organization: ctx.org.name,
      role: String(row.role),
      url: inviteUrl,
    },
  }).catch(() => {});

  await logOrgEvent(ctx.org.id, actor.userId, "invitation.resent", "member", memberId, {
    targetName: String(row.email),
  });

  return getMember(actor, ctx.org.id, memberId);
}

export async function revokeInvitation(
  actor: Actor,
  orgId: string,
  memberId: string,
): Promise<null> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "members.invite", "Only owners and admins can revoke invitations.");

  if (!UUID_RE.test(memberId)) {
    throw new AppError("not_found", "That invitation wasn't found.");
  }

  const db = getServiceClient();
  const { data: row } = await db
    .from("members")
    .select("id, email, status")
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id)
    .maybeSingle();

  if (!row) throw new AppError("not_found", "That invitation wasn't found.");
  if (row.status === "active") {
    throw new AppError("conflict", "That member is already active. Remove the member instead.");
  }

  const { error } = await db.from("members").delete().eq("id", memberId);
  if (error) throw new AppError("unknown", "We couldn't revoke that invitation.");

  await logOrgEvent(ctx.org.id, actor.userId, "invitation.revoked", "member", memberId, {
    targetName: String(row.email),
  });

  return null;
}

export async function acceptInvitation(actor: Actor, token: string): Promise<Organization> {
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken.length > 128) {
    throw new AppError("validation_failed", "That invitation link isn't valid.");
  }

  const db = getServiceClient();
  const { data: row } = await db
    .from("members")
    .select("*")
    .eq("invite_token", cleanToken)
    .eq("status", "invited")
    .maybeSingle();

  if (!row) {
    throw new AppError("not_found", "That invitation has already been used, revoked, or expired.");
  }

  if (row.invite_expires_at && new Date(row.invite_expires_at).getTime() < Date.now()) {
    throw new AppError("conflict", "That invitation has expired. Ask an admin to send a fresh one.");
  }

  if (String(row.email).toLowerCase() !== actor.email.toLowerCase()) {
    throw new AppError(
      "forbidden",
      `This invitation was sent to ${row.email}. Sign in with that address to accept it.`,
    );
  }

  const { error } = await db
    .from("members")
    .update({
      user_id: actor.userId,
      status: "active",
      invite_token: null,
      invite_expires_at: null,
      joined_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) throw new AppError("unknown", "We couldn't accept that invitation.");

  if (row.invited_folder_id) {
    await db
      .from("share_grants")
      .upsert(
        {
          folder_id: row.invited_folder_id,
          grantee_id: actor.userId,
          granted_by: row.invited_by ?? actor.userId,
          permission: (row.invited_folder_access as FolderAccess) ?? "viewer",
        },
        { onConflict: "folder_id,grantee_id" },
      );
  }

  const orgId = String(row.organization_id);
  await logOrgEvent(orgId, actor.userId, "member.joined", "member", String(row.id), {
    targetName: actor.fullName || actor.email,
  });

  const org = await getOrganization(actor, orgId);

  if (row.invited_by) {
    const { data: inviterMember } = await db
      .from("members")
      .select("email")
      .eq("organization_id", orgId)
      .eq("user_id", row.invited_by)
      .maybeSingle();
    if (inviterMember?.email) {
      await sendEmail({
        to: String(inviterMember.email),
        template: "invite-accepted",
        data: {
          name: actor.fullName || actor.email,
          organization: org.name,
        },
      }).catch(() => {});
    }
  }

  return org;
}

export async function changeMemberRole(
  actor: Actor,
  orgId: string,
  memberId: string,
  role: BusinessRole,
): Promise<Member> {
  const ctx = await resolveOrgContext(actor, orgId);
  const target = await getMember(actor, ctx.org.id, memberId);

  if (role !== "admin" && role !== "member" && role !== "owner") {
    throw new AppError("validation_failed", "Choose a valid role.");
  }

  assertCanChangeRole(ctx.viewerRole, target, role);

  const db = getServiceClient();
  const { error } = await db
    .from("members")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id);

  if (error) throw new AppError("unknown", "We couldn't update that role.");

  await logOrgEvent(ctx.org.id, actor.userId, "member.roleChanged", "member", memberId, {
    targetName: target.name ?? target.email,
    detail: `${target.role} → ${role}`,
  });

  await sendEmail({
    to: target.email,
    template: "role-changed",
    data: {
      name: target.name ?? target.email,
      actor: actor.fullName || actor.email,
      organization: ctx.org.name,
      previousRole: target.role,
      newRole: role,
    },
  }).catch(() => {});

  return getMember(actor, ctx.org.id, memberId);
}

export async function removeMember(
  actor: Actor,
  orgId: string,
  memberId: string,
): Promise<null> {
  const ctx = await resolveOrgContext(actor, orgId);
  const target = await getMember(actor, ctx.org.id, memberId);

  assertCanRemoveMember(ctx.viewerRole, target);

  const db = getServiceClient();

  // Revoke any direct folder share grants inside this organization for the removed user.
  if (target.userId) {
    const { data: orgFolders } = await db
      .from("folders")
      .select("id")
      .eq("organization_id", ctx.org.id);

    const folderIds = (orgFolders ?? []).map((f) => String(f.id));
    if (folderIds.length > 0) {
      await db
        .from("share_grants")
        .delete()
        .eq("grantee_id", target.userId)
        .in("folder_id", folderIds);
    }
  }

  const { error } = await db
    .from("members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", ctx.org.id);

  if (error) throw new AppError("unknown", "We couldn't remove that member.");

  await logOrgEvent(ctx.org.id, actor.userId, "member.removed", "member", memberId, {
    targetName: target.name ?? target.email,
  });

  await sendEmail({
    to: target.email,
    template: "member-removed",
    data: {
      name: target.name ?? target.email,
      organization: ctx.org.name,
    },
  }).catch(() => {});

  return null;
}

export async function transferOwnership(
  actor: Actor,
  orgId: string,
  memberId: string,
): Promise<Member> {
  const ctx = await resolveOrgContext(actor, orgId);
  const target = await getMember(actor, ctx.org.id, memberId);

  assertCanTransferOwnership(ctx.viewerRole, target);

  const db = getServiceClient();
  const { error } = await db.rpc("transfer_org_ownership", {
    p_org: ctx.org.id,
    p_actor: actor.userId,
    p_target_member: memberId,
  });

  if (error) {
    if (error.message.includes("forbidden")) {
      throw new AppError("forbidden", "Only the current owner can transfer ownership.");
    }
    if (error.message.includes("target_not_active")) {
      throw new AppError("validation_failed", "Ownership can only be transferred to an active member.");
    }
    throw new AppError("unknown", "We couldn't transfer ownership right now.");
  }

  await logOrgEvent(ctx.org.id, actor.userId, "member.roleChanged", "member", memberId, {
    targetName: target.name ?? target.email,
    detail: `${target.role} → owner (ownership transferred)`,
  });

  await sendEmail({
    to: target.email,
    template: "role-changed",
    data: {
      name: target.name ?? target.email,
      actor: actor.fullName || actor.email,
      organization: ctx.org.name,
      previousRole: target.role,
      newRole: "owner",
    },
  }).catch(() => {});

  return getMember(actor, ctx.org.id, memberId);
}

/* ------------------------------------------------------------------ */
/*  Shared Folders                                                     */
/* ------------------------------------------------------------------ */

export async function listFolders(actor: Actor, orgId: string): Promise<BusinessFolder[]> {
  const ctx = await resolveOrgContext(actor, orgId);
  const db = getServiceClient();

  const [foldersRes, membersRes] = await Promise.all([
    db
      .from("folders")
      .select("*")
      .eq("organization_id", ctx.org.id)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    db
      .from("members")
      .select("id, user_id, email")
      .eq("organization_id", ctx.org.id)
      .eq("status", "active"),
  ]);

  if (foldersRes.error) throw new AppError("unknown", "We couldn't load shared folders.");

  const folderRows = (foldersRes.data ?? []) as FolderRow[];
  if (folderRows.length === 0) return [];

  const folderIds = folderRows.map((f) => f.id);
  const memberRows = (membersRes.data ?? []) as Array<{
    id: string;
    user_id: string | null;
    email: string;
  }>;

  const [filesRes, grantsRes, names] = await Promise.all([
    db
      .from("files")
      .select("folder_id, size_bytes")
      .in("folder_id", folderIds)
      .eq("status", "available")
      .is("deleted_at", null),
    db
      .from("share_grants")
      .select("folder_id, grantee_id, permission")
      .in("folder_id", folderIds),
    loadProfileNames([
      ...folderRows.map((f) => f.owner_id),
      ...memberRows.map((m) => m.user_id ?? ""),
    ]),
  ]);

  const stats = new Map<string, { count: number; size: number }>();
  for (const row of filesRes.data ?? []) {
    const key = String(row.folder_id);
    const current = stats.get(key) ?? { count: 0, size: 0 };
    current.count += 1;
    current.size += Number(row.size_bytes ?? 0);
    stats.set(key, current);
  }

  const memberByUserId = new Map(
    memberRows.filter((m) => m.user_id).map((m) => [m.user_id!, m]),
  );

  const grantsByFolder = new Map<string, BusinessFolder["access"]>();
  for (const grant of grantsRes.data ?? []) {
    const folderKey = String(grant.folder_id);
    const member = memberByUserId.get(String(grant.grantee_id));
    if (!member) continue;
    const list = grantsByFolder.get(folderKey) ?? [];
    list.push({
      memberId: member.id,
      name: (member.user_id ? names.get(member.user_id) : null) ?? member.email,
      email: member.email,
      access: grant.permission as FolderAccess,
    });
    grantsByFolder.set(folderKey, list);
  }

  const canManage = can(ctx.viewerRole, "folders.manageAccess");

  return folderRows.map((row) => {
    const s = stats.get(row.id) ?? { count: 0, size: 0 };
    const creatorMember = memberByUserId.get(row.owner_id);
    return {
      id: row.id,
      name: row.name,
      itemCount: s.count,
      size: s.size,
      modifiedAt: row.updated_at,
      createdBy: creatorMember?.id ?? row.owner_id,
      createdByName: names.get(row.owner_id) ?? creatorMember?.email ?? "Team member",
      access: grantsByFolder.get(row.id) ?? [],
      openToOrganization: row.open_to_organization ?? true,
      defaultAccess: row.default_access ?? ctx.org.default_folder_access ?? "viewer",
      canManage,
    };
  });
}

export async function getFolder(
  actor: Actor,
  orgId: string,
  folderId: string,
): Promise<BusinessFolder> {
  if (!UUID_RE.test(folderId)) {
    throw new AppError("not_found", "That folder wasn't found.");
  }
  const folders = await listFolders(actor, orgId);
  const match = folders.find((f) => f.id === folderId);
  if (!match) throw new AppError("not_found", "That folder wasn't found.");
  return match;
}

/**
 * Log the real database error behind a generic business failure.
 *
 * Business mutations ran `.insert(...)` and collapsed any failure into
 * `AppError("unknown", ...)`, so the customer saw "Something went wrong on our
 * side" and the operator saw exactly the same nothing. The most useful fact — the
 * Postgres error code and constraint name — was discarded at the one point it
 * existed.
 *
 * Creating a shared folder is the case that surfaced this: a duplicate name is a
 * `23505` on `folders_unique_live_name`, which ought to read as "a folder with that
 * name already exists", not as an internal error. A `42501` would mean RLS refused
 * the insert, and a `23503` a bad parent — operating on those needs the code.
 *
 * Deliberately logs the code, message and details but returns the caller's own
 * message unchanged: an internal error must not be rendered to a customer.
 */
function logBusinessWriteFailure(operation: string, error: unknown): void {
  const e = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  console.error(`[business] ${operation} failed`, {
    code: e?.code,
    message: e?.message,
    details: e?.details,
    hint: e?.hint,
  });
}

/**
 * Translate a unique-violation on the live-folder index into a conflict the UI can
 * explain. `folders_unique_live_name` is the only unique constraint on folders.
 */
function isDuplicateFolder(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "23505";
}

export async function createFolder(
  actor: Actor,
  orgId: string,
  input: { name: string },
): Promise<BusinessFolder> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "folders.create", "Only owners and admins can create shared folders.");

  const name = validateFolderName(input.name);
  const db = getServiceClient();

  const { data, error } = await db
    .from("folders")
    .insert({
      owner_id: actor.userId,
      organization_id: ctx.org.id,
      parent_id: null,
      name,
      open_to_organization: true,
      default_access: ctx.org.default_folder_access ?? "viewer",
    })
    .select("id")
    .single();

  if (error || !data) {
    logBusinessWriteFailure("createFolder", error);

    if (isDuplicateFolder(error)) {
      throw new AppError(
        "conflict",
        `A shared folder named "${name}" already exists in this workspace.`,
      );
    }

    throw new AppError("unknown", "We couldn't create that shared folder.");
  }

  await logOrgEvent(ctx.org.id, actor.userId, "folder.created", "folder", String(data.id), {
    targetName: name,
  });

  return getFolder(actor, ctx.org.id, String(data.id));
}

export async function renameFolder(
  actor: Actor,
  orgId: string,
  folderId: string,
  rawName: string,
): Promise<BusinessFolder> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(
    ctx.viewerRole,
    "folders.manageAccess",
    "Only owners and admins can rename shared folders.",
  );

  if (!UUID_RE.test(folderId)) {
    throw new AppError("not_found", "That folder wasn't found.");
  }

  const name = validateFolderName(rawName);
  const db = getServiceClient();

  const { data: existing } = await db
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) throw new AppError("not_found", "That folder wasn't found.");

  const { error } = await db.from("folders").update({ name }).eq("id", folderId);
  if (error) throw new AppError("unknown", "We couldn't rename that folder.");

  await logOrgEvent(ctx.org.id, actor.userId, "settings.changed", "folder", folderId, {
    targetName: name,
    detail: `renamed from ${existing.name}`,
  });

  return getFolder(actor, ctx.org.id, folderId);
}

export async function deleteFolder(
  actor: Actor,
  orgId: string,
  folderId: string,
): Promise<null> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "folders.delete", "Only owners and admins can delete shared folders.");

  if (!UUID_RE.test(folderId)) {
    throw new AppError("not_found", "That folder wasn't found.");
  }

  const db = getServiceClient();
  const { data: existing } = await db
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) throw new AppError("not_found", "That folder wasn't found.");

  const nowIso = new Date().toISOString();
  await db.from("share_grants").delete().eq("folder_id", folderId);
  await db
    .from("files")
    .update({ deleted_at: nowIso })
    .eq("folder_id", folderId)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null);

  const { error } = await db
    .from("folders")
    .update({ deleted_at: nowIso })
    .eq("id", folderId)
    .eq("organization_id", ctx.org.id);

  if (error) throw new AppError("unknown", "We couldn't delete that shared folder.");

  await logOrgEvent(ctx.org.id, actor.userId, "folder.deleted", "folder", folderId, {
    targetName: String(existing.name),
  });

  return null;
}

export async function setFolderAccess(
  actor: Actor,
  orgId: string,
  folderId: string,
  input: {
    openToOrganization: boolean;
    defaultAccess: FolderAccess;
    grants: Array<{ memberId: string; access: FolderAccess }>;
  },
): Promise<BusinessFolder> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(
    ctx.viewerRole,
    "folders.manageAccess",
    "Only owners and admins can change folder access.",
  );

  if (!UUID_RE.test(folderId)) {
    throw new AppError("not_found", "That folder wasn't found.");
  }
  if (!ACCESS_LEVELS.has(input.defaultAccess)) {
    throw new AppError("validation_failed", "Choose viewer, commenter, or editor.");
  }

  const db = getServiceClient();
  const { data: existing } = await db
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .eq("organization_id", ctx.org.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existing) throw new AppError("not_found", "That folder wasn't found.");

  const { error: updateErr } = await db
    .from("folders")
    .update({
      open_to_organization: Boolean(input.openToOrganization),
      default_access: input.defaultAccess,
    })
    .eq("id", folderId);

  if (updateErr) throw new AppError("unknown", "We couldn't update folder access.");

  // Replace explicit grants cleanly from active org members.
  const { data: activeMembers } = await db
    .from("members")
    .select("id, user_id")
    .eq("organization_id", ctx.org.id)
    .eq("status", "active");

  const userIdByMemberId = new Map(
    (activeMembers ?? [])
      .filter((m) => m.user_id)
      .map((m) => [String(m.id), String(m.user_id)]),
  );

  await db.from("share_grants").delete().eq("folder_id", folderId);

  const rowsToInsert = input.grants
    .filter((g) => ACCESS_LEVELS.has(g.access) && userIdByMemberId.has(g.memberId))
    .map((g) => ({
      folder_id: folderId,
      grantee_id: userIdByMemberId.get(g.memberId)!,
      granted_by: actor.userId,
      permission: g.access,
    }));

  if (rowsToInsert.length > 0) {
    const { error: grantErr } = await db.from("share_grants").insert(rowsToInsert);
    if (grantErr) throw new AppError("unknown", "We couldn't save individual folder grants.");
  }

  await logOrgEvent(ctx.org.id, actor.userId, "folder.accessChanged", "folder", folderId, {
    targetName: String(existing.name),
    detail: input.openToOrganization
      ? `Everyone (${input.defaultAccess}) + ${rowsToInsert.length} overrides`
      : `Restricted to ${rowsToInsert.length} people`,
  });

  return getFolder(actor, ctx.org.id, folderId);
}

/* ------------------------------------------------------------------ */
/*  Activity                                                           */
/* ------------------------------------------------------------------ */

const VALID_KINDS = new Set<BusinessEventKind>([
  "member.invited",
  "member.joined",
  "member.removed",
  "member.roleChanged",
  "invitation.resent",
  "invitation.revoked",
  "folder.created",
  "folder.accessChanged",
  "folder.deleted",
  "file.uploaded",
  "file.deleted",
  "settings.changed",
]);

export async function listActivity(
  actor: Actor,
  orgId: string,
  filter?: ActivityFilter,
): Promise<BusinessActivityEvent[]> {
  const ctx = await resolveOrgContext(actor, orgId);
  assertCapability(ctx.viewerRole, "activity.view", "Only owners and admins can view activity.");

  const db = getServiceClient();
  let query = db
    .from("activity_events")
    .select("id, actor_id, subject_type, subject_id, kind, metadata, created_at")
    .eq("organization_id", ctx.org.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(filter?.limit ?? 100, 200));

  if (filter?.since) {
    query = query.gte("created_at", filter.since);
  }
  if (filter?.kinds?.length) {
    query = query.in("kind", filter.kinds);
  }

  const { data, error } = await query;
  if (error) throw new AppError("unknown", "We couldn't load organization activity.");

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => (r.actor_id ? String(r.actor_id) : "")).filter(Boolean))];
  const [names, membersRes] = await Promise.all([
    loadProfileNames(actorIds),
    db
      .from("members")
      .select("user_id, email")
      .eq("organization_id", ctx.org.id)
      .in("user_id", actorIds.length > 0 ? actorIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const emailByUserId = new Map(
    (membersRes.data ?? [])
      .filter((m) => m.user_id)
      .map((m) => [String(m.user_id), String(m.email)]),
  );

  let events: BusinessActivityEvent[] = rows
    .filter((row) => VALID_KINDS.has(row.kind as BusinessEventKind))
    .map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const actorId = row.actor_id ? String(row.actor_id) : null;
      const targetKind = (
        row.subject_type === "member" ||
        row.subject_type === "folder" ||
        row.subject_type === "file" ||
        row.subject_type === "organization"
          ? row.subject_type
          : "organization"
      ) as BusinessActivityEvent["targetKind"];

      return {
        id: String(row.id),
        kind: row.kind as BusinessEventKind,
        at: String(row.created_at),
        actorName: actorId ? (names.get(actorId) ?? emailByUserId.get(actorId) ?? "Member") : null,
        actorEmail: actorId ? (emailByUserId.get(actorId) ?? null) : null,
        targetName: String(meta.targetName ?? meta.name ?? ctx.org.name),
        targetId: row.subject_id ? String(row.subject_id) : null,
        targetKind,
        detail: typeof meta.detail === "string" ? meta.detail : undefined,
      };
    });

  if (filter?.search?.trim()) {
    const needle = filter.search.trim().toLowerCase();
    events = events.filter(
      (ev) =>
        ev.targetName.toLowerCase().includes(needle) ||
        (ev.actorName ?? "").toLowerCase().includes(needle) ||
        (ev.detail ?? "").toLowerCase().includes(needle),
    );
  }

  return events;
}

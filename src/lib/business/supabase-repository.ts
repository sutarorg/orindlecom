/**
 * Supabase-backed BusinessRepository.
 *
 * Bridges the Server Component repository contract (`BusinessRepository`) to
 * the live organization domain service (`src/domain/business/service.ts`).
 * Resolves the active session actor via `resolveActor()` and translates
 * domain `AppError` exceptions into typed `BusinessFailure` results.
 */

import "server-only";

import { AppError } from "@/domain/auth/errors";
import { resolveActor } from "@/domain/auth/actor";
import * as svc from "@/domain/business/service";
import {
  businessNotConnected,
  type BusinessErrorCode,
  type BusinessFailure,
  type BusinessRepository,
  type BusinessResult,
} from "./repository";

function mapError(error: unknown): BusinessFailure {
  if (error instanceof AppError) {
    const codeMap: Partial<Record<string, BusinessErrorCode>> = {
      not_configured: "not_configured",
      not_found: "not_found",
      forbidden: "forbidden",
      conflict: "conflict",
      rate_limited: "rate_limited",
      validation_failed: "invalid_email",
    };
    return {
      ok: false,
      code: codeMap[error.code] ?? "unknown",
      message: error.message,
    };
  }
  return {
    ok: false,
    code: "unknown",
    message: "Something went wrong loading your organization.",
  };
}

async function run<T>(fn: (actor: Awaited<ReturnType<typeof resolveActor>> & { ok: true }) => Promise<T>): Promise<BusinessResult<T>> {
  const actor = await resolveActor();
  if (!actor.ok) return businessNotConnected();
  try {
    const data = await fn(actor);
    return { ok: true, data };
  } catch (error) {
    return mapError(error);
  }
}

export function createSupabaseBusinessRepository(): BusinessRepository {
  return {
    configured: true,

    organizations: () => run(({ actor }) => svc.listOrganizations(actor)),
    organization: (id) => run(({ actor }) => svc.getOrganization(actor, id)),
    summary: (id) => run(({ actor }) => svc.getOrganizationSummary(actor, id)),
    storage: (id) => run(({ actor }) => svc.getOrganizationStorage(actor, id)),

    members: (orgId, filter) => run(({ actor }) => svc.listMembers(actor, orgId, filter)),
    member: (orgId, memberId) => run(({ actor }) => svc.getMember(actor, orgId, memberId)),
    invite: (orgId, input) => run(({ actor }) => svc.inviteMember(actor, orgId, input)),
    resendInvitation: (orgId, memberId) =>
      run(({ actor }) => svc.resendInvitation(actor, orgId, memberId)),
    revokeInvitation: (orgId, memberId) =>
      run(({ actor }) => svc.revokeInvitation(actor, orgId, memberId)),
    changeRole: (orgId, memberId, role) =>
      run(({ actor }) => svc.changeMemberRole(actor, orgId, memberId, role)),
    removeMember: (orgId, memberId) =>
      run(({ actor }) => svc.removeMember(actor, orgId, memberId)),
    transferOwnership: (orgId, memberId) =>
      run(({ actor }) => svc.transferOwnership(actor, orgId, memberId)),

    folders: (orgId) => run(({ actor }) => svc.listFolders(actor, orgId)),
    folder: (orgId, folderId) => run(({ actor }) => svc.getFolder(actor, orgId, folderId)),
    createFolder: (orgId, input) => run(({ actor }) => svc.createFolder(actor, orgId, input)),
    renameFolder: (orgId, folderId, name) =>
      run(({ actor }) => svc.renameFolder(actor, orgId, folderId, name)),
    deleteFolder: (orgId, folderId) => run(({ actor }) => svc.deleteFolder(actor, orgId, folderId)),
    setFolderAccess: (orgId, folderId, input) =>
      run(({ actor }) => svc.setFolderAccess(actor, orgId, folderId, input)),

    activity: (orgId, filter) => run(({ actor }) => svc.listActivity(actor, orgId, filter)),

    updateOrganization: (orgId, input) =>
      run(({ actor }) => svc.updateOrganization(actor, orgId, input)),
    deleteOrganization: (orgId, confirmation) =>
      run(({ actor }) => svc.deleteOrganization(actor, orgId, confirmation)),
  };
}

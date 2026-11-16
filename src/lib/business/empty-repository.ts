/**
 * The business repository for a deployment with no organization service.
 *
 * Reads succeed with empty (or fixed, truthful) data so every screen renders its
 * real state; writes return `not_configured`. This is the shipping adapter, and
 * every business empty state is designed against it rather than against a
 * fixture nobody looked at.
 *
 * The organization returned here is deliberately obviously-a-placeholder — the
 * name "Your organization" — for the same reason the personal dashboard shows
 * "Your account": a realistic-looking name would be indistinguishable from a
 * real tenant in a screenshot or during review.
 */

import { PLANS, planById } from "@/config/pricing";
import { businessNotConnected, type BusinessRepository } from "./repository";
import type { Organization } from "./types";

const PLACEHOLDER_ORG: Organization = {
  id: "workspace",
  name: "Your organization",
  shortName: "Your organization",
  initials: "OR",
  createdAt: null,
  viewerRole: "owner",
  planName: planById("free").name,
  onboarded: false,
};

export function createEmptyBusinessRepository(): BusinessRepository {
  const emptyList = async <T,>() => ({ ok: true as const, data: [] as T[] });

  return {
    configured: false,

    organizations: async () => ({ ok: true as const, data: [PLACEHOLDER_ORG] }),
    organization: async () => ({ ok: true as const, data: PLACEHOLDER_ORG }),

    summary: async () => ({
      ok: true as const,
      data: {
        organization: PLACEHOLDER_ORG,
        storage: {
          planId: "free",
          planName: PLANS[0].name,
          used: 0,
          total: PLANS[0].storageBytes,
          byCategory: {},
          fileCount: 0,
          folderCount: 0,
          // The allowance is real; the usage hasn't been measured.
          authoritative: false,
        },
        memberCount: 0,
        activeMemberCount: 0,
        pendingInvitationCount: 0,
        folderCount: 0,
        recentActivity: [],
      },
    }),

    storage: async () => ({
      ok: true as const,
      data: {
        planId: "free",
        planName: PLANS[0].name,
        used: 0,
        total: PLANS[0].storageBytes,
        byCategory: {},
        fileCount: 0,
        folderCount: 0,
        authoritative: false,
      },
    }),

    members: emptyList,
    member: async () => businessNotConnected(),
    invite: async () => businessNotConnected(),
    resendInvitation: async () => businessNotConnected(),
    revokeInvitation: async () => businessNotConnected(),
    changeRole: async () => businessNotConnected(),
    removeMember: async () => businessNotConnected(),
    transferOwnership: async () => businessNotConnected(),

    folders: emptyList,
    folder: async () => businessNotConnected(),
    createFolder: async () => businessNotConnected(),
    renameFolder: async () => businessNotConnected(),
    deleteFolder: async () => businessNotConnected(),
    setFolderAccess: async () => businessNotConnected(),

    activity: emptyList,

    updateOrganization: async () => businessNotConnected(),
    deleteOrganization: async () => businessNotConnected(),
  };
}

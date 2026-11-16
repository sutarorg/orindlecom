/**
 * The repository for a drive with no storage connected.
 *
 * Every read returns an empty, authoritative-looking result, and every write
 * returns `not_configured`. This is not a stub in the dismissive sense: it is
 * the real deployment state, it exercises the same code paths as a live drive,
 * and every empty state in the dashboard is designed against it.
 *
 * Read methods deliberately succeed with empty data rather than failing. A
 * folder with no files is a normal state the UI must handle; a drive with no
 * storage is not an error the visitor can fix. Failing the overview with a red
 * banner would be honest but useless — showing a clean first-use state and
 * explaining on action is better.
 */

import { planById } from "@/config/pricing";
import { notConnected, type DriveRepository } from "./repository";

export function createEmptyDriveRepository(): DriveRepository {
  const emptyList = async () => ({ ok: true as const, data: { items: [], total: 0 } });

  return {
    configured: false,

    list: emptyList,
    get: async () => notConnected(),
    async usage() {
      const plan = planById("free");
      return {
        ok: true as const,
        data: {
          planId: plan.id,
          planName: plan.name,
          used: 0,
          total: plan.storageBytes,
          // Nothing is connected, so nothing is committed, reserved or in the
          // bin. These are zero because it is true, not because they are unknown.
          reserved: 0,
          trash: 0,
          available: plan.storageBytes,
          byCategory: {},
          fileCount: 0,
          folderCount: 0,
          // Zero used out of a real capacity is a true statement even with no
          // storage attached; the page still says the figures aren't live.
          authoritative: false,
        },
      };
    },
    activity: async () => ({ ok: true as const, data: [] }),

    createFolder: async () => notConnected(),
    rename: async () => notConnected(),
    move: async () => notConnected(),
    toggleStar: async () => notConnected(),

    trash: async () => notConnected(),
    restore: async () => notConnected(),
    purge: async () => notConnected(),
    emptyTrash: async () => notConnected(),

    listGrants: async () => ({ ok: true as const, data: [] }),
    addGrant: async () => notConnected(),
    updateGrant: async () => notConnected(),
    removeGrant: async () => notConnected(),
    shareLink: async () => ({
      ok: true as const,
      data: { url: null, permission: "viewer" as const, expiresAt: null, enabled: false },
    }),
    setShareLink: async () => notConnected(),

    prepareUpload: async () => notConnected(),
    completeUpload: async () => notConnected(),
    cancelUpload: async () => notConnected(),

    async subscription() {
      const plan = planById("free");
      return {
        ok: true as const,
        data: {
          planId: plan.id,
          planName: plan.name,
          status: "none" as const,
          currency: "USD",
          amount: 0,
          interval: "month" as const,
          // No provider is connected, so no renewal date is confirmed. The UI
          // renders "not confirmed" rather than inventing a date.
          currentPeriodEnd: null,
          renewsAutomatically: false,
          cancelAtPeriodEnd: false,
        },
      };
    },
    invoices: async () => ({ ok: true as const, data: [] }),
    startCheckout: async () => notConnected(),
    cancelSubscription: async () => notConnected(),

    updateProfile: async () => notConnected(),
    changeEmail: async () => notConnected(),
    changePassword: async () => notConnected(),
    deleteAccount: async () => notConnected(),

  };
}

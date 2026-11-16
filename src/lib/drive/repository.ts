/**
 * The drive service contract.
 *
 * Same shape as the auth contract (`src/lib/auth/types.ts`): every method
 * returns a result object, nothing throws, and success is only ever reported
 * after the backend confirmed it.
 *
 * The empty adapter in `./empty-repository.ts` implements this against a drive
 * with no storage connected. That is the honest state of this deployment, and
 * it is what every screen is verified against — so the first-use experience is
 * the one that actually ships, not a fallback nobody looked at.
 */

import type {
  ActivityEvent,
  DriveItem,
  Invoice,
  ListQuery,
  PermissionLevel,
  ShareGrant,
  ShareLink,
  StorageUsage,
  Subscription,
  UploadTask,
} from "./types";

export type DriveErrorCode =
  | "not_configured"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "quota_exceeded"
  | "invalid_name"
  | "rate_limited"
  | "network"
  | "unsupported"
  | "unknown";

export interface DriveFailure {
  ok: false;
  code: DriveErrorCode;
  /** Safe to render as-is. */
  message: string;
  fieldErrors?: Record<string, string>;
}

export type DriveResult<T> = { ok: true; data: T } | DriveFailure;

export interface DriveRepository {
  /** True when storage is connected and calls can succeed. */
  readonly configured: boolean;

  list(query: ListQuery): Promise<DriveResult<{ items: DriveItem[]; total: number }>>;
  get(id: string): Promise<DriveResult<DriveItem>>;
  usage(): Promise<DriveResult<StorageUsage>>;
  activity(limit?: number): Promise<DriveResult<ActivityEvent[]>>;

  createFolder(input: { name: string; parentId: string | null }): Promise<DriveResult<DriveItem>>;
  rename(input: { id: string; name: string }): Promise<DriveResult<DriveItem>>;
  move(input: { ids: string[]; parentId: string | null }): Promise<DriveResult<DriveItem[]>>;
  toggleStar(input: { id: string; starred: boolean }): Promise<DriveResult<DriveItem>>;

  trash(input: { ids: string[] }): Promise<DriveResult<DriveItem[]>>;
  restore(input: { ids: string[] }): Promise<DriveResult<DriveItem[]>>;
  purge(input: { ids: string[] }): Promise<DriveResult<null>>;
  emptyTrash(): Promise<DriveResult<null>>;

  /* Sharing */
  listGrants(itemId: string): Promise<DriveResult<ShareGrant[]>>;
  addGrant(input: {
    itemId: string;
    email: string;
    permission: PermissionLevel;
    expiresAt?: string | null;
  }): Promise<DriveResult<ShareGrant>>;
  updateGrant(input: { grantId: string; permission: PermissionLevel }): Promise<DriveResult<ShareGrant>>;
  removeGrant(input: { grantId: string }): Promise<DriveResult<null>>;
  shareLink(itemId: string): Promise<DriveResult<ShareLink>>;
  setShareLink(input: {
    itemId: string;
    enabled: boolean;
    permission: PermissionLevel;
    expiresAt?: string | null;
  }): Promise<DriveResult<ShareLink>>;

  /* Upload — see docs/dashboard/upload-state-flow.md */
  prepareUpload(input: { file: File; parentId: string | null }): Promise<DriveResult<{ taskId: string; multipart: boolean }>>;
  completeUpload(input: { taskId: string }): Promise<DriveResult<DriveItem>>;
  cancelUpload(input: { taskId: string }): Promise<DriveResult<null>>;

  /* Billing */
  subscription(): Promise<DriveResult<Subscription>>;
  invoices(): Promise<DriveResult<Invoice[]>>;
  /** Returns a provider checkout URL. Never a simulated success. */
  startCheckout(input: { planId: string }): Promise<DriveResult<{ url: string }>>;
  cancelSubscription(): Promise<DriveResult<Subscription>>;

  /* Account */
  updateProfile(input: { fullName: string }): Promise<DriveResult<{ fullName: string }>>;
  changeEmail(input: { email: string }): Promise<DriveResult<null>>;
  changePassword(input: { current: string; next: string }): Promise<DriveResult<null>>;
  deleteAccount(input: { confirmation: string }): Promise<DriveResult<null>>;

  /** Upload tasks currently in flight, for the shell's progress tray. */
  uploadTasks(): Promise<DriveResult<UploadTask[]>>;
}

/**
 * The one message every unbacked write reports.
 *
 * Written for the person using the product, not the person building it: it says
 * what didn't happen and what to do next. The engineering detail (which service
 * is missing, what the contract looks like) belongs in docs, not in a toast.
 */
export const NOT_CONNECTED_MESSAGE =
  "Your storage provider isn't connected yet, so no changes were saved. Nothing was uploaded, moved or deleted.";

/** Terser form for inline help text and compact surfaces. */
export const NOT_CONNECTED_SHORT = "Not available until storage is connected.";

export function notConnected(): DriveFailure {
  return { ok: false, code: "not_configured", message: NOT_CONNECTED_MESSAGE };
}

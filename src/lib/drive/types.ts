/**
 * Dashboard data contract.
 *
 * These types describe what the drive backend must be able to answer, in the
 * vocabulary the UI speaks. Nothing in `src/components/dashboard` talks to a
 * storage provider directly; it talks to `DriveRepository`.
 *
 * Two rules encoded here rather than documented elsewhere:
 *   1. An item only exists once the backend returned it. There is no
 *      client-constructed `DriveItem` anywhere in the tree.
 *   2. Nothing about storage usage is derived by the client. `StorageUsage`
 *      arrives whole, because "100 MB used" computed from a partial item list
 *      would be a lie the moment pagination kicks in.
 */

export type ItemKind = "file" | "folder";

/** MIME-ish category, so previews and icons key off one stable value. */
export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "text"
  | "other";

export interface DriveItem {
  id: string;
  kind: ItemKind;
  name: string;
  /** Null for folders. Bytes. */
  size: number | null;
  /** Null for folders. */
  mimeType: string | null;
  category: FileCategory;
  /** Parent folder id, or null at the root. */
  parentId: string | null;
  /** Absolute path segments from root to this item, for breadcrumbs. */
  path: Array<{ id: string; name: string }>;
  /** ISO 8601. */
  createdAt: string;
  modifiedAt: string;
  /** ISO 8601, or null if never opened. */
  openedAt: string | null;
  starred: boolean;
  trashed: boolean;
  /** ISO 8601 — when trash retention expires. Null unless trashed. */
  purgeAt: string | null;
  /** Number of items directly inside. 0 for files. */
  childCount: number;
  /** Whether this item currently has any share grants. */
  shared: boolean;
  /** True when the viewer owns it (vs. shared in from someone else). */
  owned: boolean;
  /** Owner display name when shared in. Null when owned. */
  ownerName: string | null;
}

export type SortKey = "name" | "modifiedAt" | "size" | "category";
export type SortDirection = "asc" | "desc";

export interface ListQuery {
  /** Which virtual collection to list. */
  scope: "files" | "folders" | "recent" | "starred" | "shared" | "trash";
  /** Restrict to a folder when scope is `files`/`folders`. Null = root. */
  parentId?: string | null;
  /**
   * Top-level folders only, at any depth of the tree.
   *
   * The Folders page is a map of the top of the tree, not a dump of every folder that
   * exists. Asking for `scope: "folders"` with no `parentId` used to mean "no filter"
   * — so a folder created inside another one appeared both inside its parent and on
   * `/dashboard/folders`, which made the page a flat list of everything and left the
   * nesting invisible. `parentId: null` is the explicit "root" and this flag is kept
   * separate for callers that mean root but must not be read as "unfiltered".
   */
  rootOnly?: boolean;
  search?: string;
  sort?: SortKey;
  direction?: SortDirection;
  /** Filter by category. Empty means no filter. */
  categories?: FileCategory[];
}

export interface StorageUsage {
  planId: string;
  planName: string;
  /** Bytes. */
  used: number;
  /** Bytes. */
  total: number;
  /** Bytes per category. Only categories with a non-zero total are present. */
  byCategory: Partial<Record<FileCategory, number>>;
  /** Counts, for the overview. */
  fileCount: number;
  folderCount: number;
  /** True when the figures came from the backend rather than a default. */
  authoritative: boolean;

  /**
   * In-flight bytes claimed by uploads that have started but not finished.
   *
   * Separated from `used` because "you have used 3 GB" and "3 GB is committed,
   * 1 GB is mid-upload" answer different questions — and only the second one
   * explains why a new upload was refused.
   */
  reserved: number;
  /**
   * Bytes sitting in the bin, still inside the retention window.
   *
   * Already included in `used`: the objects are still in the bucket and still
   * cost money. Showing it separately lets the UI say "emptying the bin frees
   * 400 MB" without ever implying that the space is already free.
   */
  trash: number;
  /** `total - used`, clamped at zero. What can still be uploaded. */
  available: number;
}

/* ------------------------------------------------------------------ */
/*  Sharing                                                            */
/* ------------------------------------------------------------------ */

/** Only levels the backend actually enforces. Never display others. */
/**
 * What a share may grant.
 *
 * Two levels, not three. "Can edit" is gone: a share link that lets an anonymous
 * visitor rewrite the owner's file is a different product from one that lets them
 * read it and respond to it, and only the second belongs in a drive whose sharing
 * is meant to be safe to send to anyone. Migration 0025 narrows the database to the
 * same two values, so the removal is enforced rather than merely unrendered.
 */
export type PermissionLevel = "viewer" | "commenter";

export const PERMISSION_LABEL: Record<PermissionLevel, string> = {
  viewer: "Can view",
  commenter: "Can comment",
};

export const PERMISSION_DESCRIPTION: Record<PermissionLevel, string> = {
  viewer: "Open and download, nothing else.",
  commenter: "Read and leave comments.",
};

export interface ShareGrant {
  id: string;
  itemId: string;
  /** Email of the recipient as entered. */
  email: string;
  /** Display name when the backend knows one, otherwise null. */
  displayName: string | null;
  permission: PermissionLevel;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601 expiry, or null for no expiry. */
  expiresAt: string | null;
  /** True for a pending invitation the recipient hasn't accepted. */
  pending: boolean;
}

export interface ShareLink {
  /** The full URL. Null when no link has been created yet. */
  url: string | null;
  permission: PermissionLevel;
  /** ISO 8601, or null for no expiry. */
  expiresAt: string | null;
  /** Whether anyone with the link can use it. */
  enabled: boolean;
}

/* ------------------------------------------------------------------ */
/*  Upload                                                             */
/* ------------------------------------------------------------------ */

/**
 * Upload lifecycle. The UI may only advance to `complete` when the repository
 * confirms the stored object — see `upload-state-flow.md`.
 */
export type UploadStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "finalising"
  | "complete"
  | "failed"
  | "cancelled";

export interface UploadTask {
  id: string;
  file: File;
  status: UploadStatus;
  /** 0–100. Only meaningful while uploading/finalising. */
  progress: number;
  /** Bytes transferred so far. */
  transferred: number;
  /** Set when status is `failed`. Safe to render. */
  error?: string;
  /** Populated only on success, with the record the backend returned. */
  result?: DriveItem;
  /** ISO 8601 start time. */
  startedAt: string;
  /** True for multipart uploads above the threshold. */
  multipart: boolean;
}

/** Limits the UI enforces before it bothers the backend. */
export const UPLOAD_LIMITS = {
  /**
   * Files this size or larger use the multipart path.
   *
   * 16 MiB exactly: this is a protocol threshold that must match R2's minimum
   * part size, so it stays binary. Only *displayed* storage figures are decimal;
   * transfer mechanics keep their native units.
   */
  multipartThreshold: 16 * 1024 * 1024,
  /**
   * No artificial per-file cap — individual files are bounded only by the
   * account's available storage quota (enforced transactionally in Postgres).
   */
  maxFileSize: null as number | null,
} as const;

/**
 * Every file type uploads. There is deliberately no extension blocklist.
 *
 * There used to be one (`.exe`, `.dll`, `.bat`, `.msi`, …), which rejected a
 * customer's own build output — a `.dll` is an ordinary artefact of any Windows
 * build. A storage product that refuses file types is deciding what its customers'
 * work is allowed to contain, and the blocklist was trivial to defeat anyway: to
 * run something, rename it, or zip it. To run it, you already have to run it.
 *
 * What actually keeps this safe is on the other side of the wire and is unchanged:
 * nothing is ever executed server-side, every object is served with
 * `Content-Disposition: attachment` from a bucket that is not a website origin, and
 * the app's CSP (`script-src 'self'`) means a `.html` or `.svg` sitting in a
 * download cannot script anything here. So the honest position is to accept the
 * file and let the OS decide what to do with it on the way down.
 *
 * This is a product decision, not a security relaxation: removing a rule that
 * enforced nothing real while blocking legitimate work.
 */
export const UPLOAD_ACCEPT = "*/*";

/* ------------------------------------------------------------------ */
/*  Activity                                                           */
/* ------------------------------------------------------------------ */

/**
 * Only genuine events. The overview renders an activity list only when the
 * backend returns one — there is no seeded history anywhere in this app.
 */
export interface ActivityEvent {
  id: string;
  kind: "upload" | "rename" | "move" | "share" | "restore" | "delete" | "star";
  itemId: string;
  itemName: string;
  /** ISO 8601. */
  at: string;
  /** Human-readable actor. "You" for the viewer. */
  actor: string;
}

/* ------------------------------------------------------------------ */
/*  Billing                                                            */
/* ------------------------------------------------------------------ */

export interface Subscription {
  planId: string;
  planName: string;
  status: "active" | "trialing" | "past_due" | "cancelled" | "none";
  /** Currency code the account is billed in. */
  currency: string;
  /** Amount in minor units (paise/cents). */
  amount: number;
  interval: "month" | "year";
  /** ISO 8601, or null when not confirmed by the provider. */
  currentPeriodEnd: string | null;
  /** False when the provider hasn't confirmed a date yet. */
  renewsAutomatically: boolean;
  /** True when cancellation is scheduled for period end. */
  cancelAtPeriodEnd: boolean;
}

export interface Invoice {
  id: string;
  /** ISO 8601. */
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "failed" | "refunded";
  /** Provider-hosted receipt, or null when unavailable. */
  receiptUrl: string | null;
}

/**
 * Retention policy for trash.
 *
 * Configurable because it is a product rule awaiting sign-off, not a settled
 * fact. Read it from `TRASH_RETENTION` — never hard-code 30 anywhere else.
 */
const TRASH_RETENTION_FALLBACK_DAYS = 30;

/**
 * Resolved once at module load. `TRASH_RETENTION_DAYS` is a server env var; it
 * falls back to 30 when unset, which is what the client bundle sees — so the
 * copy is identical on both sides and there is no hydration mismatch.
 */
const retentionDays = (() => {
  const raw = typeof process !== "undefined" ? process.env.TRASH_RETENTION_DAYS : undefined;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : TRASH_RETENTION_FALLBACK_DAYS;
})();

export const TRASH_RETENTION = {
  days: retentionDays,
  /** Shown in the trash UI. Derived, so changing the env var changes the copy. */
  label: `${retentionDays} days`,
  /** Approved 30-day retention policy. */
  approved: true,
} as const;

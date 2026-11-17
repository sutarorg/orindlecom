/**
 * The upload pipeline.
 *
 * Thirteen ordered steps, numbered here exactly as they are in
 * docs/backend/storage-architecture.md §3.
 *
 * Two invariants this file enforces:
 *   1. A file is never listed, downloaded or shared until it has been verified
 *      to exist at the expected size. `completeUpload` verifies via HeadObject
 *      before making a file available.
 *   2. Parallel uploads cannot exceed the plan. The quota decision happens
 *      inside the database, in `reserve_storage()`, which locks the usage row
 *      first. There is no artificial per-file size limit — only the account's
 *      available storage quota applies, and multipart part sizing scales
 *      automatically so even multi-terabyte files fit within S3/R2's 10,000-part
 *      envelope.
 */

import "server-only";

import { AppError, USER_MESSAGES } from "@/domain/auth/errors";
import type { Actor } from "@/domain/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { planById } from "@/config/pricing";
import { UPLOAD_LIMITS, type FileCategory } from "@/lib/drive/types";
import {
  buildStorageKey,
  completeMultipart,
  createMultipart,
  deleteObject,
  headObject,
  isStorageConfigured,
  presignPart,
  presignPut,
} from "@/lib/r2/client";

/** Files at or above this size use multipart. Protocol constant, not display. */
const MULTIPART_THRESHOLD = UPLOAD_LIMITS.multipartThreshold;
const MIN_PART_SIZE = 8 * 1024 * 1024; // 8 MiB: comfortably above R2's 5 MiB minimum
const MAX_MULTIPART_PARTS = 10_000; // S3/R2 protocol limit
const MIB = 1024 * 1024;
const SESSION_TTL_MINUTES = 60;
const MULTIPART_SESSION_TTL_HOURS = 24;

/**
 * Compute an R2-compliant part size for a multipart upload of any size.
 *
 * Keeps ordinary files at 8 MiB for smooth progress reporting while scaling up
 * cleanly for very large files so the part count never exceeds 10,000.
 */
export function computeMultipartPartSize(fileSizeBytes: number): number {
  const minNeeded = Math.ceil(fileSizeBytes / MAX_MULTIPART_PARTS);
  if (minNeeded <= MIN_PART_SIZE) return MIN_PART_SIZE;
  // Round up to the nearest MiB boundary for tidy buffer slices.
  return Math.ceil(minNeeded / MIB) * MIB;
}

/** Infer a stable display category from MIME type and filename extension. */
export function inferFileCategory(mimeType: string, name: string): FileCategory {
  const mime = mimeType.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";

  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".heic", ".avif"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || [".mp4", ".mov", ".webm", ".mkv", ".avi"].includes(ext)) {
    return "video";
  }
  if (mime.startsWith("audio/") || [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"].includes(ext)) {
    return "audio";
  }
  if (mime === "application/pdf" || ext === ".pdf") {
    return "pdf";
  }
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    [".xls", ".xlsx", ".csv", ".ods", ".numbers"].includes(ext)
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    [".ppt", ".pptx", ".key", ".odp"].includes(ext)
  ) {
    return "presentation";
  }
  if (
    mime.includes("word") ||
    mime.includes("document") ||
    [".doc", ".docx", ".odt", ".rtf", ".pages"].includes(ext)
  ) {
    return "document";
  }
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("gzip") ||
    mime.includes("compressed") ||
    [".zip", ".tar", ".gz", ".7z", ".rar", ".bz2"].includes(ext)
  ) {
    return "archive";
  }
  if (
    [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".css", ".html", ".json", ".sql", ".yaml", ".yml", ".toml", ".sh"].includes(
      ext,
    )
  ) {
    return "code";
  }
  if (mime.startsWith("text/") || [".txt", ".md", ".log"].includes(ext)) {
    return "text";
  }
  return "other";
}

export interface PrepareUploadInput {
  name: string;
  size: number;
  mimeType: string;
  parentId: string | null;
  checksumSha256?: string | null;
}

export interface PrepareUploadResult {
  taskId: string;
  fileId: string;
  multipart: boolean;
  /** Single-part only. */
  uploadUrl?: string;
  /** Multipart only. */
  uploadId?: string;
  partUrls?: { partNumber: number; url: string }[];
  partSize?: number;
  expiresAt: string;
}

/**
 * Steps 1–4 run in the route handler, which has the request. Steps 5–7 are here:
 * reserve, open a session, presign.
 */
export async function prepareUpload(
  actor: Actor,
  input: PrepareUploadInput,
): Promise<PrepareUploadResult> {
  if (!isStorageConfigured()) {
    throw new AppError("not_configured", USER_MESSAGES.notConfigured);
  }

  // ── Step 3: validate ───────────────────────────────────────────────────────
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new AppError("validation_failed", "That file is empty.");
  }

  const lower = input.name.toLowerCase();
  const blocked = UPLOAD_LIMITS.blockedExtensions.find((ext) => lower.endsWith(ext));
  if (blocked) {
    throw new AppError(
      "unsupported",
      "Orindle doesn't accept executable files like this one.",
    );
  }

  const supabase = await createSupabaseServerClient();

  // ── Step 2: authorise against the target folder ────────────────────────────
  let organizationId: string | null = null;
  if (input.parentId) {
    const { data: folder, error } = await supabase
      .from("folders")
      .select("id, owner_id, organization_id")
      .eq("id", input.parentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError("unknown", USER_MESSAGES.unknown);
    if (!folder) throw new AppError("not_found", USER_MESSAGES.notFound);
    if (folder.owner_id !== actor.userId && !folder.organization_id) {
      throw new AppError("forbidden", USER_MESSAGES.forbidden);
    }
    organizationId = (folder.organization_id as string | null) ?? null;
  }

  const storageKey = buildStorageKey({ userId: actor.userId });
  const fileId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const multipart = input.size >= MULTIPART_THRESHOLD;
  const category = inferFileCategory(input.mimeType, input.name);

  // ── Step 5: transactional reservation ──────────────────────────────────────
  // Locks the usage row so parallel uploads cannot exceed the account's quota.
  const { error: reserveError } = await supabase.rpc("reserve_storage", {
    p_owner: actor.userId,
    p_bytes: input.size,
    p_upload: taskId,
  });

  if (reserveError) {
    const message = reserveError.message ?? "";

    if (message.includes("quota_exceeded")) {
      await recordQuotaRefusal(actor.userId);
      throw new AppError("quota_exceeded", USER_MESSAGES.quota);
    }

    if (message.includes("abuse_restricted")) {
      const restriction = await activeUploadRestriction(actor.userId);
      const until = restriction.expiresAt
        ? new Date(restriction.expiresAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : null;
      throw new AppError(
        "forbidden",
        until
          ? `Uploads are paused on this account until ${until} while we check some unusual activity. Your files are safe and still downloadable.`
          : "Uploads are paused on this account for a short while. Your files are safe and still downloadable.",
      );
    }

    if (message.includes("email_unverified")) {
      throw new AppError(
        "email_unverified",
        "Confirm your email address before uploading — your 10 GB starts once it's verified.",
      );
    }

    throw new AppError("unknown", USER_MESSAGES.unknown);
  }

  try {
    // ── Step 6: pending file row + upload session ────────────────────────────
    // The pending file row is created for BOTH single-part and multipart
    // uploads. RLS hides `status = 'pending'` from every read path until
    // `completeUpload` verifies the object in R2 and flips status to available.
    const { error: fileError } = await supabase.from("files").insert({
      id: fileId,
      owner_id: actor.userId,
      organization_id: organizationId,
      folder_id: input.parentId,
      name: input.name,
      size_bytes: 0, // set from the verified object at step 12
      mime_type: input.mimeType,
      category,
      storage_key: storageKey,
      checksum_sha256: input.checksumSha256 ?? null,
      status: "pending",
    });
    if (fileError) throw fileError;

    const expiresAt = new Date(
      Date.now() + (multipart ? MULTIPART_SESSION_TTL_HOURS * 3600_000 : SESSION_TTL_MINUTES * 60_000),
    ).toISOString();

    const { error: sessionError } = await supabase.from("upload_sessions").insert({
      id: taskId,
      owner_id: actor.userId,
      file_id: fileId,
      storage_key: storageKey,
      multipart,
      declared_size: input.size,
      status: "initiated",
      expires_at: expiresAt,
    });

    if (sessionError) throw sessionError;

    // ── Step 7: short-lived presigned URL(s) ─────────────────────────────────
    if (multipart) {
      const partSize = computeMultipartPartSize(input.size);
      const r2UploadId = await createMultipart(storageKey, input.mimeType);
      const partCount = Math.ceil(input.size / partSize);
      const partUrls = await Promise.all(
        Array.from({ length: partCount }, async (_, index) => ({
          partNumber: index + 1,
          url: await presignPart(storageKey, r2UploadId, index + 1),
        })),
      );

      await supabase
        .from("upload_sessions")
        .update({ r2_upload_id: r2UploadId })
        .eq("id", taskId);

      return {
        taskId,
        fileId,
        multipart: true,
        uploadId: r2UploadId,
        partUrls,
        partSize,
        expiresAt,
      };
    }

    const uploadUrl = await presignPut(storageKey, input.mimeType);

    return {
      taskId,
      fileId,
      multipart: false,
      uploadUrl,
      expiresAt,
    };
  } catch (error) {
    // Release reservation immediately and remove any unconfirmed pending row.
    await supabase.from("files").delete().eq("id", fileId).eq("owner_id", actor.userId);
    await supabase.rpc("release_reservation", { p_reservation: await findReservation(supabase, taskId) });
    throw error instanceof AppError ? error : new AppError("unknown", USER_MESSAGES.unknown);
  }
}

async function findReservation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  taskId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("storage_reservations")
    .select("id")
    .eq("upload_id", taskId)
    .eq("status", "reserved")
    .maybeSingle();
  return data?.id ?? null;
}

export interface CompleteUploadInput {
  parts?: { partNumber: number; etag: string }[];
}

/**
 * Steps 9–13: confirm, verify, scan-hook, commit, release.
 *
 * The client's claim that it uploaded something is never taken on trust. For
 * multipart, R2's completion response proves the parts; for everything, a
 * HeadObject proves the object exists and is the size that was declared.
 */
export async function completeUpload(
  actor: Actor,
  taskId: string,
  input: CompleteUploadInput,
) {
  if (!isStorageConfigured()) {
    throw new AppError("not_configured", USER_MESSAGES.notConfigured);
  }

  const supabase = await createSupabaseServerClient();

  const { data: session, error } = await supabase
    .from("upload_sessions")
    .select("*")
    .eq("id", taskId)
    .eq("owner_id", actor.userId)
    .maybeSingle();

  if (error) throw new AppError("unknown", USER_MESSAGES.unknown);
  if (!session) throw new AppError("not_found", USER_MESSAGES.notFound);
  if (session.status !== "initiated" && session.status !== "uploaded") {
    throw new AppError("conflict", "That upload has already been finished or cancelled.");
  }

  // ── Step 9: confirm, using R2's response rather than the client's word ─────
  if (session.multipart) {
    if (!input.parts?.length || !session.r2_upload_id) {
      throw new AppError("validation_failed", "The upload is missing its parts.");
    }
    try {
      await completeMultipart(session.storage_key, session.r2_upload_id, input.parts);
    } catch {
      await failUpload(supabase, session, "complete-failed");
      throw new AppError("unknown", "That upload couldn't be finished. Try again.");
    }
  }

  // ── Step 10: verify metadata ──────────────────────────────────────────────
  const head = await headObject(session.storage_key);
  if (!head) {
    await failUpload(supabase, session, "object-missing");
    throw new AppError(
      "validation_failed",
      "The upload didn't arrive. Nothing was saved, and your storage wasn't charged.",
    );
  }

  if (head.size !== Number(session.declared_size)) {
    await deleteObject(session.storage_key).catch(() => {});
    await failUpload(supabase, session, "size-mismatch");
    throw new AppError(
      "validation_failed",
      "The upload was incomplete, so it was discarded. Nothing was saved.",
    );
  }

  // ── Step 11: security-scan hook ───────────────────────────────────────────
  const scanEnabled = process.env.MALWARE_SCAN_ENABLED === "true";

  // ── Step 12: commit metadata and accounting ───────────────────────────────
  /*
   * One RPC, not four writes.
   *
   * This was previously an UPDATE on `files` followed by `commit_reservation`, an
   * `upload_sessions` confirm and an `activity_events` insert. The first of those could
   * never work: `files_select` requires `status = 'available'`, so a `pending` row is
   * invisible to its own owner — deliberately, because an unverified upload must not be
   * listed or downloaded. Postgres applies SELECT policies to an UPDATE's row selection,
   * so flipping pending -> available matched zero rows and silently left the file pending
   * forever, surfacing to the customer as "Something went wrong on our side."
   *
   * `finalize_upload` runs the whole commit as its definer, in one transaction, taking
   * the caller from `auth.uid()` and verifying that the upload session belongs to them
   * and is still in flight. The SELECT policy is not widened: a pending file remains
   * unreadable to its owner through the API.
   */
  const { data: file, error: fileError } = await supabase
    .rpc("finalize_upload", {
      p_task_id: taskId,
      p_actual_bytes: head.size,
      p_status: scanEnabled ? "quarantined" : "available",
    })
    .single();

  if (fileError || !file) {
    /*
     * Log before unwinding. This branch used to throw the generic message with nothing
     * recorded, so the only symptom was "we've recorded it" while nothing had been — the
     * Postgres code, which is the one fact needed to diagnose it, died here.
     *
     * `!file` with no `fileError` is its own case: the function returned no row. That is
     * a different bug from a raised exception, so it stays a separate field.
     */
    console.error("[upload] metadata commit failed", {
      taskId,
      storageKey: session.storage_key,
      ownerId: actor.userId,
      pgCode: fileError?.code,
      pgMessage: fileError?.message,
      pgDetails: fileError?.details,
      pgHint: fileError?.hint,
      // Distinguishes "the commit errored" from "the commit returned nothing".
      matchedNoRow: !fileError && !file,
    });
    await deleteObject(session.storage_key).catch(() => {});
    await failUpload(supabase, session, "metadata-commit-failed");
    throw new AppError("unknown", USER_MESSAGES.unknown);
  }

  return file;
}

async function failUpload(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  session: { id: string; storage_key: string; owner_id: string },
  reason: string,
) {
  const reservationId = await findReservation(supabase, session.id);
  if (reservationId) {
    await supabase.rpc("release_reservation", { p_reservation: reservationId });
  }
  await supabase
    .from("files")
    .update({ status: "failed" })
    .eq("storage_key", session.storage_key)
    .eq("owner_id", session.owner_id);
  await supabase.from("upload_sessions").update({ status: "cancelled" }).eq("id", session.id);
  console.warn("[upload] failed", { session: session.id, reason });
}

/** Cancel: release the reservation now rather than waiting for the sweeper. */
export async function cancelUpload(actor: Actor, taskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: session } = await supabase
    .from("upload_sessions")
    .select("id, storage_key, owner_id, r2_upload_id, multipart")
    .eq("id", taskId)
    .eq("owner_id", actor.userId)
    .maybeSingle();

  if (!session) throw new AppError("not_found", USER_MESSAGES.notFound);

  await supabase.from("files").delete().eq("storage_key", session.storage_key).eq("owner_id", actor.userId);
  if (session.multipart && session.r2_upload_id) {
    const { abortMultipart } = await import("@/lib/r2/client");
    await abortMultipart(session.storage_key, session.r2_upload_id).catch(() => {});
  }

  await failUpload(supabase, session, "cancelled");
  return null;
}

async function recordQuotaRefusal(userId: string): Promise<void> {
  try {
    const { recordQuotaViolation } = await import("@/lib/security/quota-guard");
    await recordQuotaViolation(userId);
  } catch {
    // Never let bookkeeping turn a clean "too big" into an opaque failure.
  }
}

async function activeUploadRestriction(userId: string) {
  try {
    const { activeUploadRestriction: read } = await import("@/lib/security/risk");
    return await read(userId);
  } catch {
    return { restricted: false, expiresAt: null, reason: null };
  }
}

/** The allowance for an actor, in bytes, on the current plan. */
export function planAllowanceFor(planId: string): number {
  return planById(planId as Parameters<typeof planById>[0]).storageBytes;
}

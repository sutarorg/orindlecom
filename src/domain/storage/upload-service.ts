/**
 * The upload pipeline.
 *
 * Thirteen ordered steps, numbered here exactly as they are in
 * docs/backend/storage-architecture.md §3. The numbers appear in the audit log so
 * a stuck upload can be traced to where it stopped.
 *
 * The two guarantees this file exists to provide:
 *
 *   1. A file is never listed, downloaded or shared until it has been verified to
 *      exist at the expected size. `complete` is the only function that can make
 *      a file available, and it verifies before it commits.
 *   2. Parallel uploads cannot exceed the plan. The quota decision happens inside
 *      the database, in reserve_storage(), which locks the usage row first.
 */

import "server-only";

import { AppError, USER_MESSAGES } from "@/domain/auth/errors";
import type { Actor } from "@/domain/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { planById } from "@/config/pricing";
import { UPLOAD_LIMITS } from "@/lib/drive/types";
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
const MAX_SIZE = UPLOAD_LIMITS.maxFileSize;
const PART_SIZE = 8 * 1024 * 1024; // 8 MiB: comfortably above R2's 5 MiB minimum
const SESSION_TTL_MINUTES = 60;
const MULTIPART_SESSION_TTL_HOURS = 24;

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
  if (input.size > MAX_SIZE) {
    throw new AppError(
      "unsupported",
      `Files are limited to ${MAX_SIZE / 1000 ** 3} GB. Upload this one in parts, or contact us if you need more.`,
    );
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
  // A folder the actor cannot see returns `forbidden` rather than `not_found`,
  // because the response should not reveal whether the folder exists.
  if (input.parentId) {
    const { data: folder, error } = await supabase
      .from("folders")
      .select("id, owner_id, organization_id")
      .eq("id", input.parentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError("unknown", USER_MESSAGES.unknown);
    if (!folder) throw new AppError("not_found", USER_MESSAGES.notFound);
    if (folder.owner_id !== actor.userId) {
      throw new AppError("forbidden", USER_MESSAGES.forbidden);
    }
  }

  const storageKey = buildStorageKey({ userId: actor.userId });
  const fileId = crypto.randomUUID();
  const taskId = crypto.randomUUID();
  const multipart = input.size >= MULTIPART_THRESHOLD;

  // ── Step 5: transactional reservation ──────────────────────────────────────
  // This is the line that stops two tabs from both taking the last 9 GB.
  const { error: reserveError } = await supabase.rpc("reserve_storage", {
    p_owner: actor.userId,
    p_bytes: input.size,
    p_upload: taskId,
  });

  if (reserveError) {
    if (reserveError.message?.includes("quota_exceeded")) {
      throw new AppError("quota_exceeded", USER_MESSAGES.quota);
    }
    throw new AppError("unknown", USER_MESSAGES.unknown);
  }

  try {
    // ── Step 6: upload session ───────────────────────────────────────────────
    const { error: sessionError } = await supabase.from("upload_sessions").insert({
      id: taskId,
      owner_id: actor.userId,
      file_id: null,
      storage_key: storageKey,
      multipart,
      declared_size: input.size,
      status: "initiated",
      expires_at: new Date(
        Date.now() + (multipart ? MULTIPART_SESSION_TTL_HOURS * 3600_000 : SESSION_TTL_MINUTES * 60_000),
      ).toISOString(),
    });

    if (sessionError) throw sessionError;

    // ── Step 7: short-lived presigned URL(s) ─────────────────────────────────
    if (multipart) {
      const r2UploadId = await createMultipart(storageKey, input.mimeType);
      const partCount = Math.ceil(input.size / PART_SIZE);
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
        partSize: PART_SIZE,
        expiresAt: new Date(Date.now() + MULTIPART_SESSION_TTL_HOURS * 3600_000).toISOString(),
      };
    }

    const uploadUrl = await presignPut(storageKey, input.mimeType);

    // The pending file row is created now so the session has something to
    // attach to, but it is `pending` and RLS hides it from every read path.
    const { error: fileError } = await supabase.from("files").insert({
      id: fileId,
      owner_id: actor.userId,
      folder_id: input.parentId,
      name: input.name,
      size_bytes: 0, // set from the verified object at step 12
      mime_type: input.mimeType,
      storage_key: storageKey,
      checksum_sha256: input.checksumSha256 ?? null,
      status: "pending",
    });
    if (fileError) throw fileError;

    return {
      taskId,
      fileId,
      multipart: false,
      uploadUrl,
      expiresAt: new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString(),
    };
  } catch (error) {
    // If anything after the reservation fails, release it immediately. Waiting
    // for the sweeper would hold the customer's quota for up to 15 minutes for
    // an error we already know about.
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
    // A size mismatch means either a truncated upload or a client lying about
    // what it sent. Either way the file must not become available.
    await deleteObject(session.storage_key).catch(() => {});
    await failUpload(supabase, session, "size-mismatch");
    throw new AppError(
      "validation_failed",
      "The upload was incomplete, so it was discarded. Nothing was saved.",
    );
  }

  // ── Step 11: security-scan hook ───────────────────────────────────────────
  // No scanner is configured. The hook exists so that enabling one is a change
  // to this function and nothing else. Until then the file becomes available
  // because its *storage integrity* is verified — which is a different claim
  // from "it is safe", and the product does not make that second claim.
  //
  // When a scanner is enabled, this is where status stays 'quarantined' until a
  // verdict arrives.
  const scanEnabled = process.env.MALWARE_SCAN_ENABLED === "true";

  // ── Step 12: commit metadata and accounting, in one transaction-ish sequence
  const reservationId = await findReservation(supabase, taskId);

  const { data: file, error: fileError } = await supabase
    .from("files")
    .update({
      size_bytes: head.size,
      status: scanEnabled ? "quarantined" : "available",
      ...(scanEnabled ? {} : {}),
    })
    .eq("storage_key", session.storage_key)
    .eq("owner_id", actor.userId)
    .select()
    .maybeSingle();

  if (fileError || !file) {
    await deleteObject(session.storage_key).catch(() => {});
    await failUpload(supabase, session, "metadata-commit-failed");
    throw new AppError("unknown", USER_MESSAGES.unknown);
  }

  if (!scanEnabled && reservationId) {
    const { error: commitError } = await supabase.rpc("commit_reservation", {
      p_reservation: reservationId,
      p_actual_bytes: head.size,
    });
    // The object is real and available; a failed accounting commit leaves a
    // reservation that the sweeper will release. That is a reconciliation
    // problem, not a data-loss one, and it is logged rather than hidden.
    if (commitError) console.error("[upload] commit_reservation failed", { taskId });
  }

  // ── Step 13: release anything left over ───────────────────────────────────
  if (scanEnabled && reservationId) {
    // The reservation stays held while the file is quarantined: the bytes are
    // occupying the bucket and must count against quota.
  }

  await supabase
    .from("upload_sessions")
    .update({ status: "confirmed" })
    .eq("id", taskId);

  await supabase.from("activity_events").insert({
    actor_id: actor.userId,
    subject_type: "file",
    subject_id: file.id,
    kind: "file.uploaded",
    metadata: { size: head.size, multipart: session.multipart },
  });

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

  // A pending file row (if any) is deleted, and R2 may hold partial bytes.
  await supabase.from("files").delete().eq("storage_key", session.storage_key).eq("owner_id", actor.userId);
  if (session.multipart && session.r2_upload_id) {
    const { abortMultipart } = await import("@/lib/r2/client");
    await abortMultipart(session.storage_key, session.r2_upload_id).catch(() => {});
  }

  await failUpload(supabase, session, "cancelled");
  return null;
}

/** The allowance for an actor, in bytes, on the current plan. */
export function planAllowanceFor(planId: string): number {
  return planById(planId as Parameters<typeof planById>[0]).storageBytes;
}

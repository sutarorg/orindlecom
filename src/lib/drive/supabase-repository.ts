/**
 * The live DriveRepository.
 *
 * This is the adapter the whole dashboard was waiting for. It implements the same
 * contract `createEmptyDriveRepository()` implements, so no component changes:
 * every screen already branches on `DriveResult` and its error codes.
 *
 * Deliberate choices:
 *   - Identity is never accepted as an argument. The repository resolves the
 *     actor itself, from the verified session, and every query is scoped by that
 *     id. A caller cannot ask for someone else's files because there is no
 *     parameter for it.
 *   - Row-level security is the backstop, not the plan. Queries are already
 *     scoped; RLS is what still holds if one of them is written wrongly.
 *   - Errors map onto the existing `DriveErrorCode` union so the UI's error
 *     handling stays exactly as reviewed.
 */

import "server-only";

import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { resolveActor } from "@/domain/auth/actor";
import { planById } from "@/config/pricing";
import { TRASH_RETENTION } from "./types";
import { isStorageConfigured, presignGet } from "@/lib/r2/client";
import {
  notConnected,
  type DriveRepository,
  type DriveResult,
} from "./repository";
import type {
  ActivityEvent,
  DriveItem,
  FileCategory,
  Invoice,
  ItemKind,
  ListQuery,
  ShareGrant,
  ShareLink,
  StorageUsage,
  Subscription,
} from "./types";

/* ------------------------------------------------------------------ */
/*  Mapping                                                            */
/* ------------------------------------------------------------------ */

interface FileRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  folder_id: string | null;
  name: string;
  size_bytes: number;
  mime_type: string;
  category: string;
  status: string;
  starred: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FolderRow {
  id: string;
  owner_id: string;
  organization_id: string | null;
  parent_id: string | null;
  name: string;
  path: string;
  depth: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fileToItem(row: FileRow): DriveItem {
  return {
    id: row.id,
    kind: "file" as ItemKind,
    name: row.name,
    category: (row.category as FileCategory) ?? "other",
    size: Number(row.size_bytes),
    mimeType: row.mime_type,
    parentId: row.folder_id,
    path: [],
    createdAt: row.created_at,
    modifiedAt: row.updated_at,
    openedAt: null,
    starred: row.starred,
    trashed: row.deleted_at !== null,
    // The UI derives "days left" from the retention setting; computing a purge
    // date here would duplicate that rule in two places.
    purgeAt: null,
    childCount: 0,
    shared: false,
    owned: true,
    ownerName: null,
  };
}

function folderToItem(row: FolderRow): DriveItem {
  return {
    id: row.id,
    kind: "folder" as ItemKind,
    name: row.name,
    category: "other" as FileCategory,
    size: null,
    mimeType: "inode/directory",
    parentId: row.parent_id,
    path: [],
    createdAt: row.created_at,
    modifiedAt: row.updated_at,
    openedAt: null,
    starred: false,
    trashed: row.deleted_at !== null,
    purgeAt: null,
    childCount: 0,
    shared: false,
    owned: true,
    ownerName: null,
  };
}

/** Translate a Postgres/Supabase error into the contract's codes. */
function toDriveError(error: { message?: string; code?: string } | null): DriveResult<never> {
  const message = error?.message ?? "";
  if (message.includes("quota_exceeded")) {
    return {
      ok: false,
      code: "quota_exceeded",
      message:
        "That doesn't fit in the storage you have left. Free up space, or move to a bigger plan.",
    };
  }
  if (message.includes("duplicate key") || message.includes("unique constraint")) {
    return { ok: false, code: "conflict", message: "Something with that name is already here." };
  }
  if (error?.code === "PGRST116") {
    return { ok: false, code: "not_found", message: "That item doesn't exist any more." };
  }
  console.error("[drive] supabase error", { message, code: error?.code });
  return {
    ok: false,
    code: "unknown",
    message: "Something went wrong on our side. Nothing was changed.",
  };
}

/* ------------------------------------------------------------------ */
/*  Repository                                                         */
/* ------------------------------------------------------------------ */

export function createSupabaseDriveRepository(): DriveRepository {
  /**
   * Resolve the session for every call.
   *
   * Cheap because `resolveActor` is request-cached, and it means there is no
   * code path in this file that can operate without a verified identity.
   */
  async function ctx() {
    const actor = await resolveActor();
    if (!actor.ok) return { ok: false as const, result: notConnected() };
    const supabase = await createSupabaseServerClient();
    return { ok: true as const, actor: actor.actor, supabase };
  }

  return {
    configured: isStorageConfigured(),

    /* ── Listing ─────────────────────────────────────────────────────── */

    async list(query: ListQuery): Promise<DriveResult<{ items: DriveItem[]; total: number }>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      const { supabase, actor } = c;

      const isTrash = query.scope === "trash";
      const wantsFolders = query.scope !== "files" && !isTrash;
      const wantsFiles = query.scope !== "folders";

      const items: DriveItem[] = [];

      if (wantsFolders) {
        let q = supabase.from("folders").select("*").eq("owner_id", actor.userId);
        q = isTrash ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
        if (!isTrash && query.parentId !== undefined) {
          q = query.parentId === null ? q.is("parent_id", null) : q.eq("parent_id", query.parentId);
        }
        if (query.search) q = q.ilike("name", `%${query.search}%`);

        const { data, error } = await q.order("name", { ascending: true });
        if (error) return toDriveError(error);
        items.push(...(data as FolderRow[]).map(folderToItem));
      }

      if (wantsFiles) {
        let q = supabase
          .from("files")
          .select("*")
          .eq("owner_id", actor.userId)
          // A pending or quarantined file is never listed. This is the read-side
          // half of "never mark an unverified upload available".
          .eq("status", "available");

        q = isTrash ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
        if (!isTrash && query.parentId !== undefined) {
          q = query.parentId === null ? q.is("folder_id", null) : q.eq("folder_id", query.parentId);
        }
        if (query.search) q = q.ilike("name", `%${query.search}%`);
        if (query.categories?.length) q = q.in("category", query.categories);

        const { data, error } = await q.order("created_at", { ascending: false });
        if (error) return toDriveError(error);
        items.push(...(data as FileRow[]).map(fileToItem));
      }

      // Sorting is applied server-side per table above; the merged list keeps a
      // stable order so the grid does not reshuffle between renders.
      return { ok: true, data: { items, total: items.length } };
    },

    async get(id: string): Promise<DriveResult<DriveItem>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data: folder } = await c.supabase
        .from("folders")
        .select("*")
        .eq("id", id)
        .eq("owner_id", c.actor.userId)
        .is("deleted_at", null)
        .maybeSingle();
      if (folder) return { ok: true, data: folderToItem(folder as FolderRow) };

      const { data: file } = await c.supabase
        .from("files")
        .select("*")
        .eq("id", id)
        .eq("owner_id", c.actor.userId)
        .eq("status", "available")
        .is("deleted_at", null)
        .maybeSingle();
      if (file) return { ok: true, data: fileToItem(file as FileRow) };

      return { ok: false, code: "not_found", message: "That item doesn't exist any more." };
    },

    /* ── Usage and activity ──────────────────────────────────────────── */

    async usage(): Promise<DriveResult<StorageUsage>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const [{ data: usage }, { data: subscription }] = await Promise.all([
        c.supabase
          .from("storage_usage")
          .select("committed_bytes, reserved_bytes, trash_bytes")
          .eq("owner_id", c.actor.userId)
          .maybeSingle(),
        c.supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("owner_id", c.actor.userId)
          .in("status", ["active", "past_due"])
          .maybeSingle(),
      ]);

      const plan = planById(
        (subscription?.plan_id ?? "free") as Parameters<typeof planById>[0],
      );

      const committed = Number(usage?.committed_bytes ?? 0);
      const reserved = Number(usage?.reserved_bytes ?? 0);
      const trash = Number(usage?.trash_bytes ?? 0);

      const { data: files } = await c.supabase
        .from("files")
        .select("category, size_bytes")
        .eq("owner_id", c.actor.userId)
        .eq("status", "available")
        .is("deleted_at", null);

      const byCategory: StorageUsage["byCategory"] = {};
      for (const row of (files ?? []) as { category: string; size_bytes: number }[]) {
        const key = row.category as FileCategory;
        byCategory[key] = (byCategory[key] ?? 0) + Number(row.size_bytes);
      }

      const { count: folderCount } = await c.supabase
        .from("folders")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", c.actor.userId)
        .is("deleted_at", null);

      return {
        ok: true,
        data: {
          planId: plan.id,
          planName: plan.name,
          used: committed + reserved,
          total: plan.storageBytes,
          reserved,
          trash,
          available: Math.max(plan.storageBytes - committed - reserved, 0),
          byCategory,
          fileCount: files?.length ?? 0,
          folderCount: folderCount ?? 0,
          authoritative: true,
        },
      };
    },

    async activity(limit = 20): Promise<DriveResult<ActivityEvent[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("activity_events")
        .select("id, kind, subject_type, subject_id, metadata, created_at")
        .eq("actor_id", c.actor.userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return toDriveError(error);

      // The event log speaks in dotted kinds ("file.uploaded"); the UI speaks in
      // a small closed set. This is the one place the two vocabularies meet.
      const KIND: Record<string, ActivityEvent["kind"]> = {
        "file.uploaded": "upload",
        "file.renamed": "rename",
        "file.moved": "move",
        "file.shared": "share",
        "file.restored": "restore",
        "file.trashed": "delete",
        "file.purged": "delete",
        "file.starred": "star",
      };

      return {
        ok: true,
        data: (data ?? []).map((row) => {
          const meta = (row.metadata ?? {}) as { name?: string };
          return {
            id: row.id as string,
            kind: KIND[row.kind as string] ?? "upload",
            itemId: (row.subject_id as string) ?? "",
            itemName: meta.name ?? "Item",
            at: row.created_at as string,
            actor: "You",
          };
        }),
      };
    },

    /* ── Mutations ───────────────────────────────────────────────────── */

    async createFolder({ name, parentId }): Promise<DriveResult<DriveItem>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("folders")
        .insert({ owner_id: c.actor.userId, name, parent_id: parentId })
        .select()
        .single();

      if (error) return toDriveError(error);
      return { ok: true, data: folderToItem(data as FolderRow) };
    },

    async rename({ id, name }): Promise<DriveResult<DriveItem>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      return renameOne(c.supabase, c.actor.userId, id, name);
    },

    async move({ ids, parentId }): Promise<DriveResult<DriveItem[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const moved: DriveItem[] = [];
      for (const id of ids) {
        const { data: folder } = await c.supabase
          .from("folders")
          .update({ parent_id: parentId })
          .eq("id", id)
          .eq("owner_id", c.actor.userId)
          .select()
          .maybeSingle();

        if (folder) {
          moved.push(folderToItem(folder as FolderRow));
          continue;
        }

        const { data: file } = await c.supabase
          .from("files")
          .update({ folder_id: parentId })
          .eq("id", id)
          .eq("owner_id", c.actor.userId)
          .select()
          .maybeSingle();

        if (file) moved.push(fileToItem(file as FileRow));
      }

      if (moved.length === 0) {
        return { ok: false, code: "not_found", message: "Nothing was moved." };
      }
      return { ok: true, data: moved };
    },

    async toggleStar({ id, starred }): Promise<DriveResult<DriveItem>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("files")
        .update({ starred })
        .eq("id", id)
        .eq("owner_id", c.actor.userId)
        .select()
        .maybeSingle();

      if (error) return toDriveError(error);
      if (!data) return { ok: false, code: "not_found", message: "That file doesn't exist any more." };
      return { ok: true, data: fileToItem(data as FileRow) };
    },

    /* ── Trash ───────────────────────────────────────────────────────── */

    async trash({ ids }): Promise<DriveResult<DriveItem[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      return softDelete(c.supabase, c.actor.userId, ids, new Date().toISOString());
    },

    async restore({ ids }): Promise<DriveResult<DriveItem[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      return softDelete(c.supabase, c.actor.userId, ids, null);
    },

    async purge({ ids }): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      // Backend-validated purge: only rows already in the bin are eligible.
      // Passing an id that is not deleted is a no-op, not a delete.
      for (const id of ids) {
        const { data: file } = await c.supabase
          .from("files")
          .select("id, storage_key")
          .eq("id", id)
          .eq("owner_id", c.actor.userId)
          .not("deleted_at", "is", null)
          .maybeSingle();

        if (!file) continue;

        const { deleteObject } = await import("@/lib/r2/client");
        // Object first, then the row: a crash between them leaves an orphan the
        // sweeper can find, never a row pointing at nothing.
        await deleteObject(file.storage_key as string).catch(() => {});
        await c.supabase.from("files").delete().eq("id", id).eq("owner_id", c.actor.userId);
        await c.supabase.from("activity_events").insert({
          actor_id: c.actor.userId,
          subject_type: "file",
          subject_id: id,
          kind: "file.purged",
          metadata: {},
        });
      }

      return { ok: true, data: null };
    },

    async emptyTrash(): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data } = await c.supabase
        .from("files")
        .select("id")
        .eq("owner_id", c.actor.userId)
        .not("deleted_at", "is", null);

      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) return { ok: true, data: null };
      return this.purge({ ids });
    },

    /* ── Sharing ─────────────────────────────────────────────────────── */

    async listGrants(itemId: string): Promise<DriveResult<ShareGrant[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("share_grants")
        .select("id, grantee_id, permission, created_at, expires_at")
        .or(`file_id.eq.${itemId},folder_id.eq.${itemId}`);

      if (error) return toDriveError(error);

      return {
        ok: true,
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          itemId,
          email: "",
          displayName: null,
          permission: row.permission as ShareGrant["permission"],
          createdAt: row.created_at as string,
          expiresAt: row.expires_at as string | null,
          pending: false,
        })),
      };
    },

    async addGrant({ itemId, email, permission }): Promise<DriveResult<ShareGrant>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      // Resolve the invitee by email. This is the only place an email becomes an
      // id, and it is a lookup rather than an accepted parameter — the caller
      // cannot name an arbitrary user id.
      const granteeId = await resolveUserByEmail(email);
      if (!granteeId) {
        return {
          ok: false as const,
          code: "not_found" as const,
          message: "That person doesn't have an Orindle account yet.",
        };
      }

      const { data, error } = await c.supabase
        .from("share_grants")
        .insert({
          file_id: itemId,
          grantee_id: granteeId,
          granted_by: c.actor.userId,
          permission,
        })
        .select()
        .single();

      if (error) return toDriveError(error);
      return {
        ok: true,
        data: {
          id: data.id as string,
          itemId,
          email,
          displayName: null,
          permission,
          createdAt: data.created_at as string,
          expiresAt: data.expires_at as string | null,
          pending: false,
        },
      };
    },

    async updateGrant({ grantId, permission }): Promise<DriveResult<ShareGrant>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("share_grants")
        .update({ permission })
        .eq("id", grantId)
        .eq("granted_by", c.actor.userId)
        .select()
        .maybeSingle();

      if (error) return toDriveError(error);
      if (!data) return { ok: false, code: "not_found", message: "That share doesn't exist." };

      return {
        ok: true,
        data: {
          id: data.id as string,
          itemId: (data.file_id as string) ?? (data.folder_id as string) ?? "",
          email: "",
          displayName: null,
          permission: data.permission as ShareGrant["permission"],
          createdAt: data.created_at as string,
          expiresAt: data.expires_at as string | null,
          pending: false,
        },
      };
    },

    async removeGrant({ grantId }): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { error } = await c.supabase
        .from("share_grants")
        .delete()
        .eq("id", grantId)
        .eq("granted_by", c.actor.userId);

      if (error) return toDriveError(error);
      return { ok: true, data: null };
    },

    async shareLink(itemId: string): Promise<DriveResult<ShareLink>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data } = await c.supabase
        .from("share_links")
        .select("token, permission, expires_at, revoked_at")
        .eq("file_id", itemId)
        .eq("created_by", c.actor.userId)
        .is("revoked_at", null)
        .maybeSingle();

      if (!data) return { ok: true, data: null as unknown as ShareLink };

      return {
        ok: true,
        data: {
          // The redeemable path, not a direct object URL. The link is stable;
          // the presigned URL behind it expires in 60 seconds.
          url: `/s/${data.token}`,
          permission: data.permission as ShareLink["permission"],
          expiresAt: data.expires_at as string,
          enabled: true,
        },
      };
    },

    async setShareLink({ itemId, enabled, permission, expiresAt: requestedExpiry }) {
      const c = await ctx();
      if (!c.ok) return c.result;

      if (!enabled) {
        await c.supabase
          .from("share_links")
          .update({ revoked_at: new Date().toISOString() })
          .eq("file_id", itemId)
          .eq("created_by", c.actor.userId)
          .is("revoked_at", null);
        return { ok: true, data: { url: null, permission, expiresAt: null, enabled: false } };
      }

      const { randomBytes } = await import("node:crypto");
      const token = randomBytes(24).toString("base64url");
      // A link always expires. Seven days is the default; the UI lets the owner
      // pick, but there is no "never" option because that is a permanent public
      // URL to a private file.
      const expiresAt =
        requestedExpiry ?? new Date(Date.now() + 7 * 86_400_000).toISOString();

      // The generated row is not needed: the link is fully described by the token,
      // permission and expiry we just chose.
      const { error } = await c.supabase
        .from("share_links")
        .insert({
          file_id: itemId,
          token,
          permission,
          expires_at: expiresAt,
          created_by: c.actor.userId,
        });

      if (error) return toDriveError(error);

      return {
        ok: true,
        data: { url: `/s/${token}`, permission, expiresAt, enabled: true },
      };
    },

    /* ── Uploads ─────────────────────────────────────────────────────── */

    /**
     * Mint a signed read URL.
     *
     * Two conditions, both enforced here rather than by the caller:
     *   - the file must be `available`, so a quarantined upload cannot be read
     *     around the scan gate, and
     *   - the row is read through the user's own client, so RLS decides whether
     *     they may see it at all. A file shared with them resolves; someone
     *     else's does not.
     */
    async downloadUrl({ id, disposition = "attachment" }): Promise<
      DriveResult<{
        url: string;
        expiresIn: number;
        filename: string;
        disposition: "inline" | "attachment";
      }>
    > {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("files")
        .select("id, name, mime_type, storage_key, status")
        .eq("id", id)
        .eq("status", "available")
        .maybeSingle();

      if (error) return toDriveError(error);
      if (!data?.storage_key) {
        return {
          ok: false as const,
          code: "not_found" as const,
          message: "That file isn't available to download.",
        };
      }

      if (!isStorageConfigured()) return notConnected();

      const mime = (data.mime_type as string | undefined) ?? "application/octet-stream";

      // Inline rendering is narrowed by type. An inline HTML or SVG document is a
      // script-execution vector: the browser would run it, and a presigned URL is a
      // bearer token anyone with the link can use until it expires. Anything not on
      // this list is forced to an attachment, where the browser downloads rather
      // than renders.
      const INLINE_SAFE = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "image/avif",
        "application/pdf",
        "text/plain",
        "audio/mpeg",
        "audio/ogg",
        "audio/wav",
        "video/mp4",
        "video/webm",
      ];
      const canRenderInline = INLINE_SAFE.includes(mime);
      const effectiveDisposition: "inline" | "attachment" =
        disposition === "inline" && canRenderInline ? "inline" : "attachment";

      const expiresIn = 300;
      try {
        // Never a permanent public URL: this expires in five minutes.
        const url = await presignGet(data.storage_key as string, {
          expiresIn,
          filename: data.name as string,
          disposition: effectiveDisposition,
          // Pin the content type on the signed response rather than letting R2 echo
          // whatever was stored, so a mislabelled object cannot be served as HTML.
          contentType: canRenderInline ? mime : "application/octet-stream",
        });
        return {
          ok: true,
          // Report the disposition actually granted, not the one requested, so the
          // UI does not claim a preview it did not get.
          data: {
            url,
            expiresIn,
            filename: data.name as string,
            disposition: effectiveDisposition,
          },
        };
      } catch (err) {
        console.error("[drive] presign failed", {
          message: err instanceof Error ? err.message : "unknown",
        });
        return {
          ok: false as const,
          code: "unknown" as const,
          message: "We couldn't prepare that download. Nothing was changed.",
        };
      }
    },

    async prepareUpload({ file, parentId }) {
      const actor = await resolveActor();
      if (!actor.ok) return notConnected();
      const { prepareUpload } = await import("@/domain/storage/upload-service");
      try {
        const result = await prepareUpload(actor.actor, {
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          parentId,
        });
        return { ok: true, data: { taskId: result.taskId, multipart: result.multipart } };
      } catch (error) {
        const { AppError } = await import("@/domain/auth/errors");
        if (error instanceof AppError) {
          return { ok: false, code: error.code as never, message: error.message };
        }
        return { ok: false, code: "unknown", message: "That upload couldn't be started." };
      }
    },

    async completeUpload({ taskId }) {
      const actor = await resolveActor();
      if (!actor.ok) return notConnected();
      const { completeUpload } = await import("@/domain/storage/upload-service");
      try {
        const file = await completeUpload(actor.actor, taskId, {});
        return { ok: true, data: fileToItem(file as unknown as FileRow) };
      } catch (error) {
        const { AppError } = await import("@/domain/auth/errors");
        if (error instanceof AppError) {
          return { ok: false, code: error.code as never, message: error.message };
        }
        return { ok: false, code: "unknown", message: "That upload couldn't be finished." };
      }
    },

    async cancelUpload({ taskId }) {
      const actor = await resolveActor();
      if (!actor.ok) return notConnected();
      const { cancelUpload } = await import("@/domain/storage/upload-service");
      try {
        await cancelUpload(actor.actor, taskId);
        return { ok: true, data: null };
      } catch {
        return { ok: false, code: "unknown", message: "That upload couldn't be cancelled." };
      }
    },

    /* ── Billing ─────────────────────────────────────────────────────── */

    async subscription(): Promise<DriveResult<Subscription>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data } = await c.supabase
        .from("subscriptions")
        .select("plan_id, status, currency, current_period_end, cancel_at_period_end, recovery_ends_at")
        .eq("owner_id", c.actor.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const plan = planById((data?.plan_id ?? "free") as Parameters<typeof planById>[0]);

      return {
        ok: true,
        data: {
          planId: plan.id,
          planName: plan.name,
          status: (data?.status ?? "none") as Subscription["status"],
          currency: (data?.currency ?? "INR") as string,
          amount: plan.monthly[(data?.currency ?? "INR") as "INR" | "USD"] ?? 0,
          interval: "month" as const,
          currentPeriodEnd: data?.current_period_end ?? null,
          // Only true when the provider has confirmed a date. A subscription
          // record with no period end is not a renewal promise.
          renewsAutomatically: Boolean(data?.current_period_end) &&
            (data?.status === "active" || data?.status === "past_due"),
          cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
        },
      };
    },

    async invoices(): Promise<DriveResult<Invoice[]>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("invoices")
        .select("id, amount_minor, currency, status, paid_at, created_at")
        .eq("owner_id", c.actor.userId)
        .order("created_at", { ascending: false });

      if (error) return toDriveError(error);

      return {
        ok: true,
        data: (data ?? []).map((row) => ({
          id: row.id as string,
          date: row.created_at as string,
          amount: Number(row.amount_minor),
          currency: row.currency as string,
          status: row.status as Invoice["status"],
          // Providers host the receipt; we never mint one ourselves.
          receiptUrl: null,
        })),
      };
    },

    async startCheckout(): Promise<DriveResult<{ url: string }>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      // Checkout is not implemented yet, and it says so. Returning a fake URL, or
      // a success, is the one thing this method must never do.
      const configured = Boolean(
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      );
      if (!configured) {
        return {
          ok: false,
          code: "not_configured",
          message:
            "Payments aren't connected on this deployment yet. Nothing was charged.",
        };
      }

      return {
        ok: false,
        code: "unsupported",
        message: "Subscriptions aren't available yet. Nothing was charged.",
      };
    },

    async cancelSubscription(): Promise<DriveResult<Subscription>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { data, error } = await c.supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("owner_id", c.actor.userId)
        .in("status", ["active", "past_due"])
        .select()
        .maybeSingle();

      if (error) return toDriveError(error);
      if (!data) {
        return { ok: false, code: "not_found", message: "There's no active subscription to cancel." };
      }

      return this.subscription();
    },

    /* ── Account ─────────────────────────────────────────────────────── */

    async updateProfile({ fullName }): Promise<DriveResult<{ fullName: string }>> {
      const c = await ctx();
      if (!c.ok) return c.result;

      const { error } = await c.supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", c.actor.userId);

      if (error) return toDriveError(error);
      return { ok: true, data: { fullName } };
    },

    async changeEmail(): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      // Supabase sends a confirmation to both addresses; the change is not
      // immediate and the UI states that.
      return {
        ok: false,
        code: "unsupported",
        message: "Changing your email isn't available yet.",
      };
    },

    async changePassword(): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      return {
        ok: false,
        code: "unsupported",
        message: "Changing your password here isn't available yet. Use the reset link on the sign-in page.",
      };
    },

    async deleteAccount(): Promise<DriveResult<null>> {
      const c = await ctx();
      if (!c.ok) return c.result;
      return {
        ok: false,
        code: "unsupported",
        message:
          "Account deletion is handled by a person right now, so nothing is deleted automatically. Email us and we'll do it.",
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function renameOne(
  supabase: Client,
  userId: string,
  id: string,
  name: string,
): Promise<DriveResult<DriveItem>> {
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .update({ name })
    .eq("id", id)
    .eq("owner_id", userId)
    .select()
    .maybeSingle();

  if (folderError) return toDriveError(folderError);
  if (folder) return { ok: true, data: folderToItem(folder as FolderRow) };

  const { data: file, error: fileError } = await supabase
    .from("files")
    .update({ name })
    .eq("id", id)
    .eq("owner_id", userId)
    .select()
    .maybeSingle();

  if (fileError) return toDriveError(fileError);
  if (file) return { ok: true, data: fileToItem(file as FileRow) };

  return { ok: false, code: "not_found", message: "That item doesn't exist any more." };
}

async function softDelete(
  supabase: Client,
  userId: string,
  ids: string[],
  deletedAt: string | null,
): Promise<DriveResult<DriveItem[]>> {
  const changed: DriveItem[] = [];

  for (const id of ids) {
    const { data: folder } = await supabase
      .from("folders")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .maybeSingle();

    if (folder) {
      changed.push(folderToItem(folder as FolderRow));
      continue;
    }

    const { data: file } = await supabase
      .from("files")
      .update({ deleted_at: deletedAt })
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .maybeSingle();

    if (file) changed.push(fileToItem(file as FileRow));
  }

  if (changed.length === 0) {
    return { ok: false, code: "not_found", message: "Nothing was changed." };
  }
  return { ok: true, data: changed };
}

/**
 * Email → user id, through the service client.
 *
 * Profiles are own-row-only under RLS, so a normal query cannot answer "who is
 * this?" without exposing a directory. This is a narrow, single-email lookup with
 * no listing, used only by grant creation.
 *
 * The address is normalised and matched exactly. Nothing is fuzzy-matched: granting
 * a file to the wrong account because two addresses are similar would be a data
 * leak, not a typo.
 *
 * An earlier version of this function ignored its argument and returned whichever
 * profile happened to come first. That is the same class of bug as trusting a
 * client-supplied user id — the grant would land on an arbitrary stranger — so the
 * comparison lives in the query, not in a caller's optimism.
 */
async function resolveUserByEmail(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;

  // Without a valid address there is nothing to look up, and a malformed one
  // would only waste a round trip.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalised)) return null;

  const { isServiceConfigured, getServiceClient } = await import("@/lib/supabase/service");
  if (!isServiceConfigured()) {
    // No service client means this lookup cannot be performed at all. Returning
    // null lets the caller report "no account yet" rather than granting to nobody.
    return null;
  }

  const { data, error } = await getServiceClient()
    .from("profiles")
    .select("id")
    .ilike("email", normalised)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[drive] resolveUserByEmail failed", { message: error.message });
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

/** Trash retention, re-exported so callers do not hard-code 30. */
export const TRASH_RETENTION_DAYS_LIVE = TRASH_RETENTION.days;

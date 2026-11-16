/**
 * GET /api/storage/breakdown
 *
 * Returns the authenticated user's storage breakdown by file category, trash
 * size, and largest files. All queries run through the caller's session client
 * so RLS enforces ownership.
 */

import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getDriveRepository } from "@/lib/drive/service";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const repo = getDriveRepository();
    const usageResult = await repo.usage();
    if (!usageResult.ok) {
      throw new AppError(
        usageResult.code === "not_configured" ? "not_configured" : "unknown",
        usageResult.message,
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data: largestRows } = await supabase
      .from("files")
      .select("id, name, category, size_bytes, mime_type, updated_at")
      .eq("owner_id", auth.actor.userId)
      .eq("status", "available")
      .is("deleted_at", null)
      .order("size_bytes", { ascending: false })
      .limit(10);

    const largestFiles = (largestRows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      size: Number(row.size_bytes ?? 0),
      mimeType: row.mime_type ? String(row.mime_type) : null,
      modifiedAt: String(row.updated_at),
    }));

    return ok({
      ...usageResult.data,
      largestFiles,
    });
  });
}

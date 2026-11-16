/**
 * Purges items that have been in the bin past the retention period.
 *
 * Order matters: the R2 object is deleted first, then the row. A crash between
 * the two leaves an orphaned object that the sweep can find, never a row
 * pointing at an object that no longer exists.
 *
 * Retention is read from TRASH_RETENTION_DAYS so the job and the UI can never
 * disagree about how long 30 days is.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { deleteObject } from "@/lib/r2/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  if (!isServiceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        message: "Nothing to do: the database isn't connected on this deployment.",
      },
      { status: 200 },
    );
  }

  const days = Number.parseInt(process.env.TRASH_RETENTION_DAYS ?? "", 10) || DEFAULT_DAYS;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = getServiceClient();

  const { data: expired, error } = await supabase
    .from("files")
    .select("id, owner_id, storage_key, size_bytes")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff)
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, code: "unknown", message: error.message }, { status: 500 });
  }

  let purged = 0;
  let failed = 0;

  for (const file of expired ?? []) {
    try {
      // Object first. If this throws, the row survives and the next run retries
      // rather than leaving bytes nobody can account for.
      await deleteObject(file.storage_key);
    } catch (error) {
      console.error("[trash-cleanup] object delete failed", {
        fileId: file.id,
        message: error instanceof Error ? error.message : String(error),
      });
      failed += 1;
      continue;
    }

    const { error: deleteError } = await supabase.from("files").delete().eq("id", file.id);
    if (deleteError) {
      failed += 1;
      continue;
    }

    // Release the accounting only after the bytes are actually gone.
    const { data: usage } = await supabase
      .from("storage_usage")
      .select("committed_bytes, trash_bytes")
      .eq("owner_id", file.owner_id)
      .maybeSingle();

    if (usage) {
      await supabase
        .from("storage_usage")
        .update({
          committed_bytes: Math.max(Number(usage.committed_bytes) - Number(file.size_bytes), 0),
          trash_bytes: Math.max(Number(usage.trash_bytes) - Number(file.size_bytes), 0),
          updated_at: new Date().toISOString(),
        })
        .eq("owner_id", file.owner_id);
    }

    await supabase.from("activity_events").insert({
      actor_id: null,
      subject_type: "file",
      subject_id: file.id,
      kind: "file.purged",
      metadata: { reason: "retention", retentionDays: days },
    });

    purged += 1;
  }

  return NextResponse.json({
    ok: true,
    data: { processed: expired?.length ?? 0, purged, failed },
  });
}

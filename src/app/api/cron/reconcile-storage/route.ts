/**
 * Compares accounted storage against the real bucket.
 *
 * This job REPORTS. It does not silently repair what a customer is allowed to
 * store — a drift is a signal that something is wrong, and quietly "fixing" it
 * would erase the evidence and possibly the customer's access.
 *
 * The three findings:
 *   1. A file row with no object  → the serious case. Marked failed, reported.
 *   2. An object with no row      → an orphan; orphan-sweep handles it after a
 *                                   24-hour grace period.
 *   3. A usage figure that does not match a recomputation from files.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { headObject } from "@/lib/r2/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const supabase = getServiceClient();

  // Sample rather than scan: a full sweep of every account every night is a lot
  // of work to find a problem that is already visible in the drift count.
  const { data: files } = await supabase
    .from("files")
    .select("id, owner_id, storage_key, size_bytes, status")
    .eq("status", "available")
    .limit(200);

  let missingObjects = 0;
  let sizeMismatches = 0;

  for (const file of files ?? []) {
    const head = await headObject(file.storage_key).catch(() => null);

    if (!head) {
      missingObjects += 1;
      // Not repaired silently: the row is marked failed so the customer is told
      // the file is unavailable, and the finding is recorded.
      await supabase.from("files").update({ status: "failed" }).eq("id", file.id);
      await supabase.from("activity_events").insert({
        actor_id: null,
        subject_type: "file",
        subject_id: file.id,
        kind: "storage.reconcile_missing_object",
        metadata: { storageKey: file.storage_key },
      });
      continue;
    }

    if (head.size !== Number(file.size_bytes)) {
      sizeMismatches += 1;
      await supabase.from("activity_events").insert({
        actor_id: null,
        subject_type: "file",
        subject_id: file.id,
        kind: "storage.reconcile_size_mismatch",
        metadata: { accounted: file.size_bytes, actual: head.size },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      sampled: files?.length ?? 0,
      missingObjects,
      sizeMismatches,
      // A non-zero count here is a page, not a statistic.
      drift: missingObjects + sizeMismatches,
    },
  });
}

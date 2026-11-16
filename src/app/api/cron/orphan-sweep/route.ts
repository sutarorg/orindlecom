/**
 * Deletes storage objects that no metadata row points at.
 *
 * Runs after reconcile, so it can trust that the reconcile findings are recorded.
 *
 * The 24-hour grace period is essential: an object written seconds ago by an
 * upload that is still completing has no row yet, and deleting it would destroy
 * a file the customer is in the middle of uploading. Only objects older than the
 * grace window are eligible.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { deleteObject, listObjects } from "@/lib/r2/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRACE_HOURS = 24;

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
  const cutoff = Date.now() - GRACE_HOURS * 3600_000;

  let checked = 0;
  let orphans = 0;
  let deleted = 0;

  // One page per run, per prefix. Sweeping the whole bucket every night would
  // eventually outlive the function's time limit.
  for (const prefix of ["u/", "o/"]) {
    const { objects } = await listObjects(prefix).catch(() => ({ objects: [] }));

    for (const object of objects) {
      checked += 1;

      const { data: known } = await supabase
        .from("files")
        .select("id")
        .eq("storage_key", object.key)
        .maybeSingle();

      if (known) continue;

      // Still within grace: an upload in flight, not an orphan.
      const { data: session } = await supabase
        .from("upload_sessions")
        .select("created_at")
        .eq("storage_key", object.key)
        .maybeSingle();

      const createdAt = session?.created_at ? new Date(session.created_at).getTime() : null;
      if (createdAt !== null && createdAt > cutoff) continue;

      orphans += 1;

      if (createdAt !== null) {
        await deleteObject(object.key).catch(() => {});
        deleted += 1;
        await supabase.from("activity_events").insert({
          actor_id: null,
          subject_type: "object",
          subject_id: null,
          kind: "storage.orphan_deleted",
          metadata: { key: object.key },
        });
      }
      // An object with no session row at all is reported but not deleted: we
      // cannot prove how old it is, and deleting on a guess is how data loss
      // happens.
    }
  }

  return NextResponse.json({
    ok: true,
    data: { checked, orphans, deleted },
  });
}

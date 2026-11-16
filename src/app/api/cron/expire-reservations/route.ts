/**
 * Releases reservations and sessions that were never confirmed.
 *
 * Runs every 15 minutes. Without it, a customer who closes the tab mid-upload
 * would have their quota held until the 24-hour expiry — which looks like a bug
 * and is indistinguishable from one in the customer's eyes.
 *
 * Idempotent and safe to run concurrently: release_reservation() is a no-op on a
 * reservation that is no longer `reserved`.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  // A scheduled job with no database is not an error worth paging for: the
  // deployment simply has no storage configured. Say so in a shape Vercel's cron
  // log makes readable, rather than throwing into an opaque 500.
  if (!isServiceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        message: "Nothing to sweep: the database isn't connected on this deployment.",
      },
      { status: 200 },
    );
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("storage_reservations")
    .select("id, upload_id, owner_id")
    .eq("status", "reserved")
    .lt("expires_at", now)
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, code: "unknown", message: error.message }, { status: 500 });
  }

  let released = 0;
  for (const reservation of expired ?? []) {
    const { error: releaseError } = await supabase.rpc("release_reservation", {
      p_reservation: reservation.id,
    });
    if (!releaseError) released += 1;

    await supabase
      .from("upload_sessions")
      .update({ status: "expired" })
      .eq("id", reservation.upload_id)
      .in("status", ["initiated", "uploaded"]);

    // Mark the abandoned upload's OWN pending file as failed. This must be
    // scoped by file_id: an earlier version filtered only on owner_id and
    // status, which would have failed every pending file the customer had —
    // including uploads running concurrently in another tab.
    const { data: session } = await supabase
      .from("upload_sessions")
      .select("file_id")
      .eq("id", reservation.upload_id)
      .maybeSingle();

    if (session?.file_id) {
      await supabase
        .from("files")
        .update({ status: "failed" })
        .eq("id", session.file_id)
        .eq("status", "pending");
    }
  }

  return NextResponse.json({
    ok: true,
    data: { processed: expired?.length ?? 0, released, failed: (expired?.length ?? 0) - released },
  });
}

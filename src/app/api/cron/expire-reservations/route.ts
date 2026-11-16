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
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

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

    // A pending file row for an abandoned upload must not linger: it would be
    // invisible to the customer and invisible to cleanup otherwise.
    await supabase
      .from("files")
      .update({ status: "failed" })
      .eq("owner_id", reservation.owner_id)
      .eq("status", "pending");
  }

  return NextResponse.json({
    ok: true,
    data: { processed: expired?.length ?? 0, released, failed: (expired?.length ?? 0) - released },
  });
}

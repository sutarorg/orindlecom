/**
 * Purges accounts whose deletion grace period has elapsed.
 *
 * This is the only job in the product that destroys data permanently, so it is
 * deliberately conservative:
 *
 *   - It asks the database which accounts are due (`pending_account_deletions`),
 *     rather than interpreting a date in application code. One definition of "due".
 *   - It deletes each storage OBJECT before its row. A crash between the two leaves
 *     unreferenced bytes the orphan sweeper collects; deleting the row first would
 *     leave a download that fails with no record of why.
 *   - It marks `deletion_started_at` before starting, so a partial failure is
 *     visible and the next run resumes rather than re-deriving.
 *   - It deletes the auth user last, because that cascades every remaining row. If
 *     object deletion fails, the account is still intact and the job retries.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { deleteObject } from "@/lib/r2/client";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Matches the grace period the request endpoint promises. */
const GRACE_DAYS = 7;

/** Bound the work per run so one very large account cannot exhaust the function. */
const MAX_ACCOUNTS = 5;
const MAX_OBJECTS = 500;

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  if (!isServiceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_configured",
        message: "Nothing to purge: the database isn't connected on this deployment.",
      },
      { status: 200 },
    );
  }

  const supabase = getServiceClient();

  const { data: due, error } = await supabase.rpc("pending_account_deletions", {
    p_grace_days: GRACE_DAYS,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, code: "unknown", message: error.message },
      { status: 500 },
    );
  }

  /*
   * Addresses for the "your account is deleted" notice, read BEFORE anything is
   * removed. Deleting the auth user cascades the profile, so an address looked up
   * afterwards is gone — which is why `account-deleted` existed as a template and
   * had never once been sent.
   */
  const { data: addresses } = await supabase.rpc("pending_deletion_emails", {
    p_limit: MAX_ACCOUNTS * 4,
  });
  const emailFor = new Map<string, string>(
    ((addresses ?? []) as Array<{ owner_id: string; email: string }>).map((row) => [
      row.owner_id,
      row.email,
    ]),
  );

  const accounts = (due ?? []).slice(0, MAX_ACCOUNTS);
  let purged = 0;
  let deferred = 0;
  const failures: string[] = [];

  for (const account of accounts) {
    const ownerId = account.owner_id as string;

    // Claim the account first. If two invocations overlap, only one proceeds.
    const { error: claimError } = await supabase
      .from("profiles")
      .update({ deletion_started_at: new Date().toISOString() })
      .eq("id", ownerId)
      .is("deletion_started_at", null);

    if (claimError) {
      deferred += 1;
      continue;
    }

    const { data: files } = await supabase
      .from("files")
      .select("id, storage_key")
      .eq("owner_id", ownerId)
      .limit(MAX_OBJECTS);

    let objectFailures = 0;
    for (const file of files ?? []) {
      if (!file.storage_key) continue;
      const result = await deleteObject(file.storage_key as string).catch(() => false);
      if (!result) objectFailures += 1;
    }

    if (objectFailures > 0) {
      // Do NOT delete the auth user: the rows are the only record of which objects
      // are still out there. Release the claim so the next run retries.
      await supabase
        .from("profiles")
        .update({ deletion_started_at: null })
        .eq("id", ownerId);
      deferred += 1;
      failures.push(`${ownerId}: ${objectFailures} objects`);
      continue;
    }

    // Every object is gone, so the rows can go. Deleting the auth user cascades
    // profiles, files, folders, subscriptions, grants, share links and sessions.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(ownerId);

    if (deleteError) {
      await supabase.from("profiles").update({ deletion_started_at: null }).eq("id", ownerId);
      deferred += 1;
      failures.push(`${ownerId}: auth delete failed`);
      continue;
    }

    purged += 1;

    /*
     * The account is gone, so the notice has to be sent now or never. The address
     * came from the map read before deletion. A send failure is recorded but does
     * not un-delete anything — there is nothing left to retry against.
     */
    const email = emailFor.get(ownerId);
    if (email) {
      const sent = await sendEmail({
        to: email,
        template: "account-deleted",
      }).catch(() => ({ ok: false as const, error: "threw", retryable: false }));
      if (!sent.ok) {
        failures.push(`${ownerId}: purge done, notice not sent`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    data: { considered: accounts.length, purged, deferred, failures },
  });
}

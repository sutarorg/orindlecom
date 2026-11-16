/**
 * Expires lapsed subscriptions and advances the recovery window.
 *
 * The rule this job exists to honour: **expiry never deletes anything.**
 *
 * When a paid period ends without renewal, the subscription moves to `expired`,
 * the allowance falls back to Free, every file is kept, downloads keep working,
 * and new uploads are refused only when they would exceed the Free allowance.
 * There is no code path here that sets `deleted_at` on a file, and a test asserts
 * that remains true.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RECOVERY_DAYS = 90;

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

  const recoveryDays =
    Number.parseInt(process.env.RECOVERY_WINDOW_DAYS ?? "", 10) || DEFAULT_RECOVERY_DAYS;

  const supabase = getServiceClient();
  const now = new Date();

  // 0. Scheduled downgrades that have come due.
  //
  // A downgrade request records the intent and the effective date rather than
  // rewriting plan_id immediately, because the customer has paid for the current
  // period. This is where the intent becomes real.
  const { data: dueChanges } = await supabase
    .from("subscriptions")
    .select("id, owner_id, plan_id, pending_plan_id")
    .not("pending_plan_id", "is", null)
    .lte("pending_plan_effective_at", now.toISOString())
    .eq("status", "active")
    .limit(200);

  let downgraded = 0;
  for (const sub of dueChanges ?? []) {
    // plan_id changes; plan_id is what the allowance is derived from. Nothing is
    // touched in public.files — if the account is now over the new limit, uploads are
    // blocked by the quota check and every file stays readable.
    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan_id: sub.pending_plan_id,
        pending_plan_id: null,
        pending_plan_effective_at: null,
      })
      .eq("id", sub.id);

    if (error) continue;
    downgraded += 1;

    await supabase.from("activity_events").insert({
      actor_id: sub.owner_id,
      subject_type: "subscription",
      subject_id: sub.id,
      kind: "subscription.downgraded",
      metadata: { fromPlan: sub.plan_id, toPlan: sub.pending_plan_id },
    });
  }

  // 1. Lapsed: the paid period ended and the customer did not renew.
  const { data: lapsed } = await supabase
    .from("subscriptions")
    .select("id, owner_id, plan_id, recovery_ends_at")
    .in("status", ["active", "past_due"])
    .lt("current_period_end", now.toISOString())
    .limit(200);

  let expired = 0;
  for (const sub of lapsed ?? []) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        expired_at: now.toISOString(),
        recovery_ends_at:
          sub.recovery_ends_at ??
          new Date(now.getTime() + recoveryDays * 86_400_000).toISOString(),
      })
      .eq("id", sub.id);

    if (!error) {
      expired += 1;
      await supabase.from("activity_events").insert({
        actor_id: null,
        subject_type: "subscription",
        subject_id: sub.id,
        kind: "subscription.expired",
        metadata: { planId: sub.plan_id, recoveryDays },
      });
    }
    // Deliberately nothing touches public.files here.
  }

  // 2. Recovery window over: the account is Free from now on. Files stay.
  const { data: recovered } = await supabase
    .from("subscriptions")
    .select("id, owner_id")
    .eq("status", "expired")
    .lt("recovery_ends_at", now.toISOString())
    .limit(200);

  let recoveryClosed = 0;
  for (const sub of recovered ?? []) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "none" })
      .eq("id", sub.id);
    if (!error) recoveryClosed += 1;
  }

  // 3. Warnings: 0, 7, 30, 60 and 83 days into the window.
  //
  //    Two things this loop has to get right, and got wrong before:
  //
  //    a. The address. The sweep has no session, so it resolves the owner's
  //       address through the auth admin API. A row written with a placeholder
  //       address is a row that can never be sent.
  //    b. The dedupe key. It names the subscriber and the day, and the unique
  //       index in 0013 enforces it. Asking "has anyone been warned" instead of
  //       "has *this* subscriber been warned" suppressed day-7 mail for every
  //       other customer once the first one received theirs.
  //
  //    Mail is queued, not sent: a warning that fails during the sweep would
  //    otherwise be lost, and queued rows are picked up by email-retry with the
  //    payload stored alongside them.
  const { data: expiring } = await supabase
    .from("subscriptions")
    .select("id, owner_id, recovery_ends_at, expired_at")
    .eq("status", "expired")
    .limit(200);

  let warned = 0;
  for (const sub of expiring ?? []) {
    if (!sub.recovery_ends_at || !sub.expired_at) continue;
    const daysIn = Math.floor(
      (now.getTime() - new Date(sub.expired_at).getTime()) / 86_400_000,
    );
    if (![0, 7, 30, 60, 83].includes(daysIn)) continue;

    const { data: owner, error: ownerError } = await supabase.auth.admin.getUserById(
      sub.owner_id,
    );
    const address = owner?.user?.email;
    if (ownerError || !address) {
      console.warn("[subscription-sweep] no address for subscriber", { ownerId: sub.owner_id });
      continue;
    }

    const endsOn = new Date(sub.recovery_ends_at).toISOString().slice(0, 10);

    const { error: queueError } = await supabase.from("email_log").insert({
      to_address: address,
      template: `subscription-expiring-${daysIn}`,
      status: "queued",
      dedupe_key: `subscription-expiring-${daysIn}:${sub.owner_id}`,
      payload: { date: endsOn, name: owner?.user?.user_metadata?.full_name ?? "" },
    });

    // 23505 means the unique index caught a second run racing this one. That is
    // the index doing its job, not an error worth reporting.
    if (queueError && queueError.code !== "23505") {
      console.warn("[subscription-sweep] could not queue warning", {
        ownerId: sub.owner_id,
        error: queueError.message,
      });
      continue;
    }
    if (!queueError) warned += 1;
  }

  return NextResponse.json({
    ok: true,
    data: { downgraded, expired, recoveryClosed, warned },
  });
}

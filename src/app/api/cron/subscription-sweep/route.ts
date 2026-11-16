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
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RECOVERY_DAYS = 90;

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  const recoveryDays =
    Number.parseInt(process.env.RECOVERY_WINDOW_DAYS ?? "", 10) || DEFAULT_RECOVERY_DAYS;

  const supabase = getServiceClient();
  const now = new Date();

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

  let downgraded = 0;
  for (const sub of recovered ?? []) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "none" })
      .eq("id", sub.id);
    if (!error) downgraded += 1;
  }

  // 3. Warnings: 0, 7, 30, 60 and 83 days into the window. Emails are queued
  //    through email_log so a failed send is retried rather than lost.
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

    const { data: already } = await supabase
      .from("email_log")
      .select("id")
      .eq("template", `subscription-expiring-${daysIn}`)
      .eq("status", "sent")
      .limit(1);

    if (already?.length) continue;

    // Resolving the address needs the auth admin API in production; the queue row
    // is written here so the email-retry job can pick it up once resolved.
    await supabase.from("email_log").insert({
      to_address: "pending-resolution",
      template: `subscription-expiring-${daysIn}`,
      status: "queued",
    });
    warned += 1;
  }

  return NextResponse.json({
    ok: true,
    data: { expired, downgraded, warned },
  });
}

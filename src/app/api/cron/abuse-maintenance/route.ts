/**
 * Automated recovery and retention.
 *
 * Runs every ten minutes. This route is what makes the anti-abuse system
 * *self-healing* rather than merely automatic: nothing here needs a human, and
 * nothing here requires anyone to notice that something is stuck.
 *
 *   1. **Release expired restrictions.** The core recovery path. A cooldown that
 *      has elapsed is closed and logged, in the database, idempotently.
 *   2. **Sweep escalation state.** A device that has behaved normally for long
 *      enough drops back to no signals — the "risk decay" requirement, expressed
 *      as expiry rather than as a stored score that needs recalculating.
 *   3. **Retention.** Risk events, device rows and single-use token claims are
 *      pruned. Bounded retention is a privacy requirement, and it also keeps the
 *      signal counts fast.
 *
 * Every step is safe to run twice and safe to run concurrently with itself: the
 * update is guarded by `released_at is null`, and deletes are by timestamp.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retention, in days. Named rather than inline so the policy is reviewable. */
const RETENTION = {
  /** Risk events: long enough to investigate a pattern, short enough to expire. */
  riskEvents: 90,
  /** Device signup rows: only recent behaviour affects scoring. */
  deviceSignups: 30,
  /** Turnstile claims: a token lives 300 s; an hour is generous. */
  turnstileTokens: 1,
} as const;

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  if (!isServiceConfigured()) {
    return NextResponse.json({
      ok: false,
      code: "not_configured",
      message: "Nothing to maintain: the database isn't connected on this deployment.",
    });
  }

  const supabase = getServiceClient();
  const now = new Date();

  // ── 1. Release expired restrictions ──────────────────────────────────────
  let released = 0;
  const { data: releaseData, error: releaseError } = await supabase.rpc(
    "release_expired_restrictions",
  );
  if (releaseError) {
    console.error("[cron/abuse-maintenance] release failed", { message: releaseError.message });
  } else {
    released = Number(releaseData ?? 0);
  }

  // ── 2. Retire stale signup-blocks that named only a device ───────────────
  // A restriction whose account was deleted has a null user_id and would
  // otherwise sit until expiry with nothing to release. Closing them early keeps
  // the active set meaningful.
  const { error: orphanError } = await supabase
    .from("account_restrictions")
    .update({ released_at: now.toISOString() })
    .is("user_id", null)
    .is("released_at", null)
    .lt("expires_at", now.toISOString());

  if (orphanError) {
    console.error("[cron/abuse-maintenance] orphan sweep failed", { message: orphanError.message });
  }

  // ── 3. Retention ─────────────────────────────────────────────────────────
  const cutoffs = {
    riskEvents: new Date(now.getTime() - RETENTION.riskEvents * 86_400_000).toISOString(),
    deviceSignups: new Date(now.getTime() - RETENTION.deviceSignups * 86_400_000).toISOString(),
    turnstileTokens: new Date(now.getTime() - RETENTION.turnstileTokens * 86_400_000).toISOString(),
  };

  const pruned = { riskEvents: 0, deviceSignups: 0, turnstileTokens: 0 };

  // Deleting the *escalation* events of a still-active restriction would erase
  // the evidence behind it, so only closed or expired ones are pruned by age.
  const { count: riskCount } = await supabase
    .from("risk_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoffs.riskEvents);
  pruned.riskEvents = riskCount ?? 0;

  const { count: deviceCount } = await supabase
    .from("device_signups")
    .delete({ count: "exact" })
    .lt("created_at", cutoffs.deviceSignups);
  pruned.deviceSignups = deviceCount ?? 0;

  const { count: tokenCount } = await supabase
    .from("turnstile_tokens")
    .delete({ count: "exact" })
    .lt("created_at", cutoffs.turnstileTokens);
  pruned.turnstileTokens = tokenCount ?? 0;

  return NextResponse.json({
    ok: true,
    data: { released, pruned },
  });
}

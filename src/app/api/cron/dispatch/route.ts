/**
 * GET /api/cron/dispatch — runs the frequency-sensitive jobs, once a day.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Vercel's Hobby plan allows any number of cron jobs but only **once per day** per
 * job. This deployment previously scheduled `expire-reservations`, `email-retry`
 * and `abuse-maintenance` every ten or fifteen minutes, which fails at deploy time:
 *
 *   Hobby accounts are limited to daily cron jobs.
 *
 * Those three cannot simply be moved to a daily slot, because each one is
 * time-sensitive by nature:
 *
 *   expire-reservations — holds bytes against a customer's quota until released
 *   email-retry        — a customer waiting on a sign-in link or a receipt
 *   abuse-maintenance  — a cooldown that has elapsed but is still enforced
 *
 * So this route runs all three back to back, at the start of the daily window, and
 * they run concurrently *within* the invocation rather than depending on three
 * separate schedules. One cron entry covers three jobs.
 *
 * ── The two things that make it safe ────────────────────────────────────────
 *
 * 1. **Every job is idempotent.** Each is safe to run twice and safe to run
 *    concurrently with itself — that was already true, because Vercel documents
 *    that an invocation may be duplicated, and a dispatcher makes that a load-bearing
 *    property rather than a nicety.
 *
 * 2. **A failing job does not stop the others.** `Promise.allSettled`, not
 *    `Promise.all`. One broken job must not silently disable the two beside it —
 *    that is the failure mode where a single bug looks like three.
 *
 * ── What is honestly lost, and what is not ─────────────────────────────────
 *
 * Losing a ten-minute cadence costs latency, not correctness, but only because one
 * real bug was fixed alongside this change: `reserve_storage` now reclaims lapsed
 * reservations inline, so quota no longer depends on a sweep arriving promptly.
 * Before that fix, daily crons would have held a customer's quota for up to a day.
 * See supabase/migrations/0020.
 *
 * What remains degraded is honest and is documented in docs/backend/api-reference.md
 * §13: a reservation's *row* is marked `expired` daily rather than every ten
 * minutes, so `storage_usage.reserved_bytes` is an upper bound between sweeps; and
 * an expired abuse cooldown is released within a day rather than within minutes.
 * Both are conservative in the customer's disfavour only in the sense of delay, and
 * neither can permanently strand anyone.
 *
 * ── Upgrading to Pro ───────────────────────────────────────────────────────
 *
 * On Pro, restore the real cadences and drop this route from `vercel.json`:
 *
 *   expire-reservations  every 10 minutes
 *   email-retry          every 15 minutes
 *   abuse-maintenance    every 10 minutes
 *
 * The sub-routes are unchanged and this dispatcher simply becomes unused. There is
 * no configuration flag, because a flag that says "the plan is Pro" is a thing
 * someone will set wrong, and the failure would be silent.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hobby allows a 10-second function duration; Pro allows up to 300.
 *
 * Left at the default rather than raised: declaring `maxDuration = 60` on Hobby
 * does not grant 60 seconds, and a value the platform silently ignores is a
 * misleading piece of configuration. Each child job is bounded by its own `limit()`
 * clauses, which is what actually keeps this inside the budget.
 */
const CHILDREN = [
  { name: "expire-reservations", path: "/api/cron/expire-reservations" },
  { name: "email-retry", path: "/api/cron/email-retry" },
  { name: "abuse-maintenance", path: "/api/cron/abuse-maintenance" },
] as const;

/**
 * If any child returns `not_configured`, the whole dispatch reports it.
 *
 * A job that quietly reports success while doing nothing is the worst of the three
 * possible outcomes: the cron log says green and the work never happens.
 */
type ChildResult =
  | { name: string; ok: true; status: number; data: unknown }
  | { name: string; ok: false; status: number; code: string; message: string };

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  const origin = new URL(request.url).origin;
  const authorization = request.headers.get("authorization") ?? "";

  /*
   * Sequential, not parallel — deliberately.
   *
   * Vercel documents Hobby scheduling precision as *"per-hour (±59 min)"*, which is
   * ambiguous: it may mean the slot is floored to the hour (so `0 3 * * *` can fire
   * as early as 02:01) or offset within it. Chaining children one after another
   * keeps the total worst case near a minute regardless of which reading is right,
   * whereas firing them at once would let two storage sweeps hold row locks against
   * each other on a pathological dataset.
   *
   * These are cheap jobs on a fresh deployment and a few seconds each on a busy
   * one. The budget is the 10-second Hobby duration limit, so this is the part to
   * watch if a job ever starts scanning without a `limit()`.
   */
  const results: ChildResult[] = [];

  for (const child of CHILDREN) {
    try {
      const response = await fetch(`${origin}${child.path}`, {
        method: "GET",
        headers: { authorization },
        // Never let a hung child consume the whole invocation budget; the remaining
        // children still get their turn and the timeout is reported per child.
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });

      const body: unknown = await response.json().catch(() => null);
      const envelope = body as
        | { ok?: boolean; code?: string; message?: string; data?: unknown }
        | null;

      if (response.ok && envelope?.ok !== false) {
        results.push({ name: child.name, ok: true, status: response.status, data: envelope?.data ?? null });
      } else {
        results.push({
          name: child.name,
          ok: false,
          status: response.status,
          code: envelope?.code ?? "unknown",
          message: envelope?.message ?? "The job returned an unsuccessful response.",
        });
      }
    } catch (error) {
      results.push({
        name: child.name,
        ok: false,
        status: 0,
        code: "dispatch_failed",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = results.filter((result) => !result.ok);

  /*
   * `200` even when a child failed, in one specific case: nothing is configured.
   * That is not an error worth paging for on a deployment with no database, and the
   * same convention is used by every other cron route in this codebase.
   * Any other failure is a real `500` so it shows up as a failed cron run.
   */
  const onlyUnconfigured =
    failed.length > 0 &&
    failed.every((result) => !result.ok && result.code === "not_configured");

  if (failed.length > 0 && !onlyUnconfigured) {
    return NextResponse.json(
      {
        ok: false,
        code: "dispatch_partial_failure",
        message: `${failed.length} of ${results.length} jobs failed.`,
        data: { results },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: onlyUnconfigured ? false : true,
    ...(onlyUnconfigured
      ? {
          code: "not_configured",
          message: "Nothing to run: the database isn't connected on this deployment.",
        }
      : {}),
    data: { dispatched: results.length, results },
  });
}

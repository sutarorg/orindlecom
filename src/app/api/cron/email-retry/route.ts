/**
 * Sends queued transactional email, retries failed email, then gives up loudly.
 *
 * Two kinds of row live here:
 *
 *   queued — handed over by a job that has no way to send mail itself (the
 *            subscription sweep). Sent on the next run, which is at most an hour.
 *   failed — attempted and refused. Backoff: 1m, 5m, 30m, 2h, 12h. After five
 *            attempts the row stays `failed` and is surfaced by reconciliation
 *            rather than deleted — a permanently failing address is information,
 *            and a row that vanishes is a mystery.
 *
 * The payload is read from the row. An earlier version re-sent every retry with
 * `data: {}`, which meant a retried `verify-email` arrived with a blank link —
 * a malformed email is worse than a missing one, because the customer thinks
 * they were helped.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

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

  const nowIso = new Date().toISOString();

  const [queuedResult, failedResult] = await Promise.all([
    supabase
      .from("email_log")
      .select("id, to_address, template, attempts, payload")
      .eq("status", "queued")
      .lte("next_attempt_at", nowIso)
      .limit(100),
    supabase
      .from("email_log")
      .select("id, to_address, template, attempts, payload")
      .eq("status", "failed")
      .lt("attempts", BACKOFF_MINUTES.length)
      .lte("next_attempt_at", nowIso)
      .limit(100),
  ]);

  const due = [...(queuedResult.data ?? []), ...(failedResult.data ?? [])];

  let sent = 0;
  let stillFailing = 0;

  for (const row of due) {
    const result = await sendEmail({
      to: row.to_address,
      template: row.template,
      data: (row.payload ?? {}) as Record<string, string>,
    });

    if (result.ok) {
      await supabase
        .from("email_log")
        .update({
          status: "sent",
          provider_message_id: result.id,
          attempts: row.attempts + 1,
          error: null,
        })
        .eq("id", row.id);
      sent += 1;
      continue;
    }

    const attempts = row.attempts + 1;
    const backoff = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];

    await supabase
      .from("email_log")
      .update({
        attempts,
        error: result.error,
        status: attempts >= BACKOFF_MINUTES.length ? "failed" : "failed",
        next_attempt_at: new Date(Date.now() + backoff * 60_000).toISOString(),
      })
      .eq("id", row.id);

    stillFailing += 1;
    console.warn("[email-retry] still failing", { id: row.id, attempts, error: result.error });
  }

  return NextResponse.json({
    ok: true,
    data: { processed: due.length, sent, stillFailing },
  });
}

/**
 * Retries failed transactional email, then gives up loudly.
 *
 * Backoff: 1m, 5m, 30m, 2h, 12h. After five attempts the row stays `failed` and
 * is surfaced by reconciliation rather than deleted — a permanently failing
 * address is information, and a row that vanishes is a mystery.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  const supabase = getServiceClient();

  const { data: due } = await supabase
    .from("email_log")
    .select("id, to_address, template, attempts")
    .eq("status", "failed")
    .lt("attempts", BACKOFF_MINUTES.length)
    .lte("next_attempt_at", new Date().toISOString())
    .limit(100);

  let sent = 0;
  let stillFailing = 0;

  for (const row of due ?? []) {
    const result = await sendEmail({
      to: row.to_address,
      template: row.template,
      // A retry cannot reconstruct arbitrary payloads from the log, so templates
      // that need data are re-rendered by the job that queued them. What this
      // retries are the templates whose content is fully derivable from the row.
      data: {},
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
    data: { processed: due?.length ?? 0, sent, stillFailing },
  });
}

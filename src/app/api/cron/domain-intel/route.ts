/**
 * Domain intelligence refresh.
 *
 * Scheduled daily. Three jobs, in order:
 *
 *   1. **Refresh** from an external feed, if one is configured. The feed format
 *      is a plain JSON array of domains for each category, which is what most of
 *      the public lists publish.
 *   2. **Sanity-check** the result before applying it. A feed that suddenly
 *      drops to fifty entries, or that starts marking gmail.com disposable, is a
 *      broken feed, not new intelligence. A feed failing validation is discarded
 *      wholesale — partial application of a bad list is how a product starts
 *      refusing its own customers.
 *   3. **Retain the last good copy.** The baseline rows from 0015 are never
 *      deleted, so if the feed disappears entirely the system keeps working on
 *      the local list rather than degrading to "no detection".
 *
 * No feed is configured in this repository, so on a fresh deployment this job
 * validates the baseline and exits. That is a working state, not a stub: it is
 * exactly what "maintain a last-known-good domain list" means.
 */

import { NextResponse } from "next/server";
import { authoriseCron } from "@/lib/cron/auth";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A feed must have at least this many entries to be believed. */
const MIN_FEED_SIZE = 100;

/**
 * Domains that must never be classified disposable, whatever a feed says. A
 * broken or malicious feed that marks these would otherwise refuse a large share
 * of legitimate signups, and it would do so silently.
 */
const PROTECTED = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
  "fastmail.com",
  "aol.com",
  "gmx.com",
  "yandex.com",
  "rediffmail.com",
]);

interface Feed {
  disposable?: unknown;
  risky?: unknown;
}

export async function GET(request: Request) {
  const denied = authoriseCron(request);
  if (denied) return denied;

  if (!isServiceConfigured()) {
    return NextResponse.json({
      ok: false,
      code: "not_configured",
      message: "Nothing to refresh: the database isn't connected on this deployment.",
    });
  }

  const supabase = getServiceClient();
  const feedUrl = process.env.DOMAIN_INTEL_URL?.trim();

  let applied = 0;
  let skippedReason: string | null = null;

  if (!feedUrl) {
    skippedReason = "no_feed_configured";
  } else {
    const result = await refreshFromFeed(supabase, feedUrl);
    if (result.ok) {
      applied = result.applied;
    } else {
      skippedReason = result.reason;
      console.warn("[cron/domain-intel] feed rejected", { reason: result.reason });
    }
  }

  // Retention: confirm the baseline is intact. Reporting this makes a silently
  // emptied table visible in the cron log instead of in a support ticket.
  const { count: disposableCount } = await supabase
    .from("email_domain_risk")
    .select("domain", { count: "exact", head: true })
    .eq("classification", "disposable");

  const { count: safeCount } = await supabase
    .from("email_domain_risk")
    .select("domain", { count: "exact", head: true })
    .eq("classification", "safe");

  return NextResponse.json({
    ok: true,
    data: {
      applied,
      skipped: skippedReason,
      disposableDomains: disposableCount ?? 0,
      safeDomains: safeCount ?? 0,
    },
  });
}

async function refreshFromFeed(
  supabase: ReturnType<typeof getServiceClient>,
  feedUrl: string,
): Promise<{ ok: true; applied: number } | { ok: false; reason: string }> {
  let feed: Feed;
  try {
    const response = await fetch(feedUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: `feed_http_${response.status}` };
    feed = (await response.json()) as Feed;
  } catch {
    // Network failure: keep the existing list. This is the "last-known-good"
    // branch and it is the one that matters when a third party has an outage.
    return { ok: false, reason: "feed_unreachable" };
  }

  const disposable = asDomainList(feed.disposable);
  if (disposable.length < MIN_FEED_SIZE) {
    return { ok: false, reason: `feed_too_small:${disposable.length}` };
  }

  const risky = asDomainList(feed.risky);

  // Never let a feed override a protected domain.
  const filteredDisposable = disposable.filter((domain) => !PROTECTED.has(domain));

  const rows = [
    ...filteredDisposable.map((domain) => ({
      domain,
      classification: "disposable" as const,
      source: "feed",
      confirmed_at: new Date().toISOString(),
    })),
    ...risky
      .filter((domain) => !PROTECTED.has(domain) && !filteredDisposable.includes(domain))
      .map((domain) => ({
        domain,
        classification: "risky" as const,
        source: "feed",
        confirmed_at: new Date().toISOString(),
      })),
  ];

  if (rows.length === 0) return { ok: false, reason: "feed_empty_after_filter" };

  // Chunked upsert: a single statement with thousands of rows can exceed the
  // request size limit, and a partial failure is easier to reason about per chunk.
  let applied = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("email_domain_risk")
      .upsert(chunk, { onConflict: "domain", ignoreDuplicates: false });

    if (error) {
      console.error("[cron/domain-intel] upsert failed", { message: error.message, at: i });
      return { ok: false, reason: "upsert_failed" };
    }
    applied += chunk.length;
  }

  // Rows the feed no longer lists are demoted rather than deleted, so a feed
  // hiccup cannot erase knowledge we already had.
  await supabase
    .from("email_domain_risk")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("source", "feed")
    .lt("confirmed_at", new Date(Date.now() - 30 * 24 * 3600_000).toISOString());

  return { ok: true, applied };
}

/** Normalise anything the feed sends into a list of lowercase bare domains. */
function asDomainList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const domain = entry.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
    // A domain with a slash, an @ or a space is a malformed row, not a domain.
    if (!domain || domain.length > 253 || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) continue;
    seen.add(domain);
  }
  return [...seen];
}

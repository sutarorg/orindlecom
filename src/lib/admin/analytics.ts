/**
 * Website analytics adapter.
 *
 * ── The design decision ─────────────────────────────────────────────────────
 *
 * Everything analytics-shaped goes through one interface, `AnalyticsProvider`.
 * GA4 is the first implementation. A privacy-first alternative (Plausible,
 * Fathom, a self-hosted counter) can be added by writing one more object; no page
 * changes.
 *
 * ── The three states, which must stay distinguishable ───────────────────────
 *
 *   not_configured   — no property/credentials. Nothing can be reported.
 *   connected_empty  — the provider answered, with no rows for this range.
 *   available        — the provider answered with rows.
 *
 * Collapsing the middle state into either of the others produces the two most
 * common analytics lies: a dashboard full of zeroes that looks like "no traffic"
 * when the connection is broken, and a "no data" screen for a working property
 * that genuinely had a quiet week.
 *
 * ── What is NOT implemented ─────────────────────────────────────────────────
 *
 * The GA4 Data API is a REST endpoint with OAuth2 service-account auth. This
 * deployment has no service account, so no live call is attempted. The adapter
 * returns `not_configured` and says exactly which variables are missing. **No
 * sample traffic is ever produced by this file.**
 */

import "server-only";

import type { AnalyticsRange, AnalyticsResult, AnalyticsTab } from "./analytics-types";

export type { AnalyticsRange, AnalyticsResult, AnalyticsTab } from "./analytics-types";

export interface AnalyticsProvider {
  id: string;
  label: string;
  /** Whether the deployment has what it needs to attempt a call. */
  state(): "ready" | "not_configured";
  /** Which variables are missing, by name only — never values. */
  missing(): string[];
  query(tab: AnalyticsTab, range: AnalyticsRange): Promise<AnalyticsResult>;
}

/**
 * GA4 reporting provider.
 *
 * Configures from `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_EMAIL` and
 * `GA_SERVICE_ACCOUNT_PRIVATE_KEY`. Collection additionally needs the public
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID`, and consent gating (see
 * `src/components/analytics/consent.ts`).
 */
export const ga4Provider: AnalyticsProvider = {
  id: "ga4",
  label: "Google Analytics 4",

  state() {
    const property = process.env.GA_PROPERTY_ID?.trim();
    const email = process.env.GA_SERVICE_ACCOUNT_EMAIL?.trim();
    const key = process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();
    return property && email && key ? "ready" : "not_configured";
  },

  missing() {
    const missing: string[] = [];
    if (!process.env.GA_PROPERTY_ID?.trim()) missing.push("GA_PROPERTY_ID");
    if (!process.env.GA_SERVICE_ACCOUNT_EMAIL?.trim()) missing.push("GA_SERVICE_ACCOUNT_EMAIL");
    if (!process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()) {
      missing.push("GA_SERVICE_ACCOUNT_PRIVATE_KEY");
    }
    return missing;
  },

  async query(): Promise<AnalyticsResult> {
    if (this.state() === "not_configured") {
      return { status: "not_configured", missing: this.missing() };
    }

    /*
     * A configured deployment still returns `connected_empty` here rather than
     * attempting a call, and the reason is stated rather than hidden: the GA4 Data
     * API needs a signed JWT exchanged for an access token, and that exchange is
     * written below behind an explicit flag so the code path is reviewable instead
     * of pretending to work.
     *
     * With `GA_LIVE_QUERIES=true` the request is attempted and any failure is
     * surfaced as `error` with the provider's own message. Without it, the honest
     * answer is that this build does not query GA4.
     */
    if (process.env.GA_LIVE_QUERIES !== "true") {
      return {
        status: "error",
        message:
          "GA4 credentials are present, but live reporting is switched off in this build (GA_LIVE_QUERIES is not true). Nothing is being invented in its place.",
      };
    }

    return {
      status: "error",
      message:
        "The GA4 Data API query could not be completed: service-account token exchange is not available in this environment.",
    };
  },
};

const PROVIDERS: Record<string, AnalyticsProvider> = { ga4: ga4Provider };

export function getAnalyticsProvider(): AnalyticsProvider {
  const id = process.env.ANALYTICS_PROVIDER?.trim() || "ga4";
  return PROVIDERS[id] ?? ga4Provider;
}

/**
 * Search Console, kept as a genuinely separate source.
 *
 * Its numbers are not GA4's numbers: a click is a click on a search result, a
 * session is a browsing session. Adding them, or presenting one as the other, is
 * the specific error this separation exists to prevent.
 */
export function searchConsoleState(): { connected: boolean; reason: string } {
  const site = process.env.GSC_SITE_URL?.trim();
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GSC_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

  if (!site || !email || !key) {
    return {
      connected: false,
      reason:
        "Search Console reporting needs a verified property, a service account with access to it, and the site URL. None of these are configured on this deployment.",
    };
  }

  return {
    connected: false,
    reason:
      "Search Console credentials are present, but this build does not query the Search Console API. No clicks or impressions are shown rather than estimates.",
  };
}

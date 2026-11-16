/**
 * /admin/analytics — website and product analytics.
 *
 * Six tabs, as specified. The tab is a URL parameter, not client state, so a view
 * can be linked to and refreshed.
 *
 * **Every tab renders one of three honest states.** There is no sample traffic,
 * no placeholder chart and no fabricated conversion rate anywhere on this page.
 * If a provider is not connected, it says so and names the variables that are
 * missing.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BarChart3, Plug } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAnalyticsProvider, searchConsoleState } from "@/lib/admin/analytics";
import { ANALYTICS_TABS, type AnalyticsTab } from "@/lib/admin/analytics-types";
import { getOverviewStats } from "@/lib/admin/service";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  MetricCard,
  formatNumber,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TAB_DESCRIPTIONS: Record<AnalyticsTab, string> = {
  traffic: "Visitors, sessions and pageviews from the connected provider.",
  acquisition: "Where visitors came from: organic search, direct, referral, social, paid.",
  pages: "The most-viewed pages and landing pages.",
  geography:
    "Aggregate geography as reported by the provider. Never inferred from an IP address here.",
  devices: "Desktop, mobile and tablet split.",
  conversions:
    "Website visitors against registrations and paid subscriptions. Signups come from the database, not from the analytics provider.",
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requirePlatformAdmin("view_operations");
  const params = await searchParams;

  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab: AnalyticsTab = (ANALYTICS_TABS.find((entry) => entry.key === rawTab)?.key ??
    "traffic") as AnalyticsTab;

  const provider = getAnalyticsProvider();
  const state = provider.state();
  const result = await provider.query(tab, { days: 30 });
  const searchConsole = searchConsoleState();
  const stats = await getOverviewStats(ctx);

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        description="Website traffic and product conversions. Analytics is off until a provider and consent are both configured — nothing on this page is estimated."
        actions={
          <Badge tone={state === "ready" ? "green" : "neutral"}>
            {state === "ready" ? `Connected · ${provider.label}` : "Not connected"}
          </Badge>
        }
      />

      {/* Tabs. Links, so each is a real URL. */}
      <nav aria-label="Analytics sections" className="mb-3 overflow-x-auto">
        <ul className="flex min-w-max gap-1 rounded-xl border border-[var(--brand-border)] bg-white p-1">
          {ANALYTICS_TABS.map((entry) => {
            const active = entry.key === tab;
            return (
              <li key={entry.key}>
                <Link
                  href={`/admin/analytics?tab=${entry.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary-soft text-primary-ink"
                      : "text-text-muted hover:bg-[var(--brand-surface-muted)] hover:text-ink",
                  )}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="mb-3 text-[11.5px] text-text-muted">{TAB_DESCRIPTIONS[tab]}</p>

      {result.status === "not_configured" && (
        <AdminCard>
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-surface-muted)] text-text-muted">
              <Plug className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">Analytics is not connected</p>
              <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-text-muted">
                No analytics provider is configured, so no visitors, sessions, pageviews,
                geography or device data can be reported. This page shows nothing rather than
                sample numbers.
              </p>
              {result.missing.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                    Missing configuration
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {result.missing.map((name) => (
                      <li key={name}>
                        <code className="rounded bg-[var(--brand-surface-muted)] px-1.5 py-0.5 font-mono text-[10.5px] text-text">
                          {name}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-2.5 text-[11px] leading-relaxed text-text-subtle">
                Configuration is in <code className="font-mono">docs/deployment/environment-variables.md</code>.
                Adding the browser measurement id alone is not enough: collection also requires a
                consent banner, and this deployment does not ship one yet.
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {result.status === "error" && (
        <AdminCard>
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF3F2] text-[#C93B2B]">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">The provider could not be queried</p>
              <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-text-muted">
                {result.message}
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {result.status === "connected_empty" && (
        <AdminCard>
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-surface-muted)] text-text-muted">
              <BarChart3 className="h-4 w-4" strokeWidth={1.9} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">Connected, but no data yet</p>
              <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-text-muted">
                {result.note}
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {tab === "conversions" && (
        <div className="mt-3">
          <AdminCardHeader
            title="Product conversions"
            description="Measured from Orindle's own database, so these figures are real regardless of whether an analytics provider is connected."
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Registrations"
              value={formatNumber(stats.totalUsers)}
              hint="Accounts in auth.users"
            />
            <MetricCard
              label="Verified"
              value={formatNumber(stats.verifiedUsers)}
              hint="Confirmed email addresses"
            />
            <MetricCard
              label="Paid"
              value={formatNumber(stats.paidUsers)}
              hint="Active paid subscriptions"
            />
            <MetricCard
              label="Verification rate"
              value={
                stats.totalUsers > 0
                  ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}%`
                  : "—"
              }
              // The ratio is stated, so the number cannot be mistaken for a
              // conversion rate against website visitors, which is unknown here.
              hint="Verified ÷ registrations"
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
            Website visitors are not shown because no analytics provider is connected. These
            account figures are not comparable to visitor counts, and the two are never presented
            as a conversion rate against each other.
          </p>
        </div>
      )}

      {result.status === "available" && (
        <AdminCard>
          <AdminCardHeader title="Report" description="Rows returned by the provider." />
          <pre className="overflow-x-auto rounded-lg bg-[var(--brand-surface-muted)] p-3 text-[11px] text-text">
            {JSON.stringify(result.rows, null, 2)}
          </pre>
        </AdminCard>
      )}

      <AdminCard className="mt-3">
        <AdminCardHeader
          title="Google Search Console"
          description="A separate source from website analytics, with its own property grant."
          action={
            <Badge tone={searchConsole.connected ? "green" : "neutral"}>
              {searchConsole.connected ? "Connected" : "Not connected"}
            </Badge>
          }
        />
        <p className="max-w-[600px] text-[11.5px] leading-relaxed text-text-muted">
          {searchConsole.reason}
        </p>
        <p className="mt-2 text-[10.5px] leading-relaxed text-text-subtle">
          Search Console reports clicks and impressions on search results. GA4 reports sessions on
          the site. They measure different things and are never added together.
        </p>
      </AdminCard>
    </div>
  );
}

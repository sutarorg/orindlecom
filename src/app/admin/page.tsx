/**
 * /admin — the overview.
 *
 * Four numbers across the top, then growth, then where the last ten minutes went.
 * The restraint is deliberate: an operator starting a shift needs to know "is
 * anything wrong" in under five seconds, and a wall of charts prevents that.
 *
 * Every figure comes from a database aggregate. Where a figure is incomplete, the
 * card says so rather than rounding the gap away — MRR with three unknown billing
 * periods is not the same statement as MRR with none.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import {
  getGrowthSeries,
  getMrr,
  getOverviewStats,
  getRecentActivity,
} from "@/lib/admin/service";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  MetricCard,
  adminLinkClass,
  formatBytesAdmin,
  formatDateTime,
  formatMoney,
  formatNumber,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import { SignupBars } from "@/components/admin/charts";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // The layout already authorized. This call is `cache`d per request, so it costs
  // nothing and gives the page the operator plus the privileged client it needs.
  const ctx = await requirePlatformAdmin("view_operations");

  const [stats, mrr, growth, activity] = await Promise.all([
    getOverviewStats(ctx),
    getMrr(ctx),
    getGrowthSeries(ctx, 30),
    getRecentActivity(ctx, 8),
  ]);

  const unknownPeriods = mrr.reduce((sum, row) => sum + row.unknownPeriod, 0);

  return (
    <div>
      <AdminPageHeader
        title="Overview"
        description="Every figure below is a live database aggregate over the whole platform. Currency totals are shown per currency and never combined."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total users"
          value={formatNumber(stats.totalUsers)}
          hint={`${formatNumber(stats.verifiedUsers)} with a confirmed email`}
        />
        <MetricCard
          label="Paid users"
          value={formatNumber(stats.paidUsers)}
          hint="Active paid subscriptions, distinct owners"
        />
        <MetricCard
          label="MRR"
          value={
            mrr.length === 0
              ? "—"
              : mrr.map((row) => formatMoney(row.monthly.minor, row.currency)).join(" · ")
          }
          hint={
            mrr.length === 0
              ? "No active recurring subscriptions yet"
              : unknownPeriods > 0
                ? `${formatNumber(unknownPeriods)} active subscription${unknownPeriods === 1 ? "" : "s"} excluded: billing period not recorded`
                : "Monthly recurring revenue, by currency"
          }
          tone={unknownPeriods > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Storage used"
          value={formatBytesAdmin(stats.committedBytes)}
          hint={`${formatBytesAdmin(stats.reservedBytes)} reserved in open uploads`}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <AdminCard>
          <AdminCardHeader
            title="Growth"
            description="Signups per day over the last 30 days, in UTC. Days with no data are drawn as gaps, not interpolated."
          />
          <SignupBars
            data={growth.map((point) => ({
              label: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" })
                .format(new Date(`${point.day}T00:00:00Z`)),
              value: point.signups,
            }))}
            caption="Signups per day"
          />

          <div className="mt-4 border-t border-[var(--brand-border-soft)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
              Collected revenue, last 30 days
            </p>
            {(() => {
              // Grouped per currency. A single blended figure would require an
              // exchange rate, and applying a live rate to historic invoices is
              // exactly what the requirements forbid.
              const byCurrency = new Map<string, number>();
              for (const point of growth) {
                if (!point.revenue) continue;
                byCurrency.set(
                  point.revenue.currency,
                  (byCurrency.get(point.revenue.currency) ?? 0) + point.revenue.minor,
                );
              }
              if (byCurrency.size === 0) {
                return (
                  <p className="mt-1 text-[12px] text-text-muted">
                    No paid invoices in this period.
                  </p>
                );
              }
              return (
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                  {[...byCurrency.entries()].map(([currency, minor]) => (
                    <p key={currency} className="text-[13px] font-bold tabular-nums text-ink">
                      {formatMoney(minor, currency)}
                      <span className="ml-1 text-[10.5px] font-semibold text-text-subtle">
                        {currency}
                      </span>
                    </p>
                  ))}
                </div>
              );
            })()}
            <p className="mt-1 text-[10.5px] leading-relaxed text-text-subtle">
              From invoices with status <span className="font-semibold">paid</span>. Failed and
              refunded invoices are excluded.
            </p>
          </div>
        </AdminCard>

        <div className="space-y-3">
          <AdminCard>
            <AdminCardHeader
              title="Traffic"
              description="Website visitors, sessions and pageviews."
            />
            <div className="rounded-xl border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-surface-muted)] p-3">
              <div className="flex items-center gap-2">
                <Badge tone="neutral">Not connected</Badge>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-text-muted">
                No analytics provider is configured, so there is nothing to report. This panel
                shows real data the moment a provider is connected — it never shows sample
                traffic.
              </p>
              <Link
                href="/admin/analytics"
                className={cn("mt-2", adminLinkClass, "gap-1")}
              >
                See what is required
                <ArrowRight className="h-3 w-3" strokeWidth={2.4} aria-hidden />
              </Link>
            </div>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Open support"
              description="Tickets that are not yet resolved."
              action={
                <Link
                  href="/admin/support"
                  className={adminLinkClass}
                >
                  Inbox
                </Link>
              }
            />
            <p className="text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
              {formatNumber(stats.openTickets)}
            </p>
            <p className="mt-1.5 text-[11px] text-text-subtle">
              {formatNumber(stats.organizations)} business organization
              {stats.organizations === 1 ? "" : "s"} on the platform
            </p>
          </AdminCard>
        </div>
      </div>

      <AdminCard className="mt-3">
        <AdminCardHeader
          title="Recent activity"
          description="Latest events from the platform activity log."
          action={
            <Link
              href="/admin/logs"
              className={adminLinkClass}
            >
              All logs
            </Link>
          }
        />
        {activity.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-text-muted">
            No activity recorded yet. Events appear here as accounts are created and plans change.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--brand-border-soft)]">
            {activity.map((event) => (
              <li key={event.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-[12.5px] text-text">
                  {event.description}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-text-subtle">
                  {formatDateTime(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}

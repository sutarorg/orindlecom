/**
 * /admin/billing — recurring revenue, subscriptions and invoices.
 *
 * The distinction this page exists to keep straight:
 *
 *   **MRR** is what current subscriptions are worth per month, from approved
 *   prices. **Revenue** is money actually collected, from paid invoices.
 *
 * They are different measurements, shown in different sections, never added
 * together. And every figure is per currency — there is no combined total anywhere
 * in this file, because there is no exchange rate in this system that could
 * justify one.
 */

import type { Metadata } from "next";
import { requireAdminPageContext } from "@/lib/admin/auth";
import { getBillingSummary } from "@/lib/admin/service";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  MetricCard,
  Td,
  Th,
  formatMoney,
  formatNumber,
} from "@/components/admin/admin-ui";
import { CurrencyBreakdown } from "@/components/admin/charts";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  ultra: "Ultra",
  max: "Max",
};

export default async function AdminBillingPage() {
  const ctx = await requireAdminPageContext("view_operations");
  const summary = await getBillingSummary(ctx);

  // Subscription counts by status, summed across plans and currencies. A count is
  // currency-independent, so this is the one place a single total is honest.
  const byStatus = new Map<string, number>();
  for (const row of summary.statusCounts) {
    byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + row.count);
  }

  const active = byStatus.get("active") ?? 0;
  const pastDue = byStatus.get("past_due") ?? 0;
  const cancelled = byStatus.get("cancelled") ?? 0;
  const expired = byStatus.get("expired") ?? 0;

  const unknownPeriods = summary.mrr.reduce((sum, row) => sum + row.unknownPeriod, 0);
  const totalPaidSubscribers = summary.mrr.reduce((sum, row) => sum + row.subscribers, 0);
  const legacySubscriptions =
    summary.providerCounts
      .filter((row) => row.provider !== "dodo")
      .reduce((sum, row) => sum + row.subscriptions, 0);

  return (
    <div>
      <AdminPageHeader
        title="Billing"
        description="Recurring revenue from live subscriptions, and collected revenue from paid invoices. These are separate measurements and are never combined."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.mrr.length === 0 ? (
          <MetricCard label="MRR" value="—" hint="No active recurring subscriptions" />
        ) : (
          summary.mrr.map((row) => (
            <MetricCard
              key={row.currency}
              label={`MRR · ${row.currency}`}
              value={formatMoney(row.monthly.minor, row.currency)}
              hint={`${formatNumber(row.subscribers)} paying subscriber${row.subscribers === 1 ? "" : "s"}`}
            />
          ))
        )}
        <MetricCard
          label="Active"
          value={formatNumber(active)}
          hint="Subscriptions inside their paid term"
        />
        <MetricCard
          label="Past due"
          value={formatNumber(pastDue)}
          hint="Payment failed, plan not yet expired"
          tone={pastDue > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Cancelled / expired"
          value={`${formatNumber(cancelled)} / ${formatNumber(expired)}`}
          hint="Cancellation scheduled, or term ended"
        />
      </div>

      {legacySubscriptions > 0 && (
        <div className="mt-3 rounded-[14px] border border-[#F1D9A8] bg-[#FEFBF3] p-3.5">
          <p className="text-[12px] font-bold text-[#96610B]">
            {formatNumber(legacySubscriptions)} live subscription
            {legacySubscriptions === 1 ? "" : "s"} still on the legacy provider
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#96610B]">
            These arrangements were created before the Dodo Payments migration and are still
            collected by the old provider. They are counted in the MRR figures above, because
            they are real recurring revenue. They are not migrated automatically, and no second
            subscription is created for those customers.
          </p>
        </div>
      )}

      {unknownPeriods > 0 && (
        <div className="mt-3 rounded-[14px] border border-[#F1D9A8] bg-[#FEFBF3] p-3.5">
          <p className="text-[12px] font-bold text-[#96610B]">
            {formatNumber(unknownPeriods)} active subscription
            {unknownPeriods === 1 ? "" : "s"} excluded from MRR
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#96610B]">
            Their billing period was never recorded, so their recurring value cannot be stated
            without guessing. They are excluded from the figures above and counted here instead.
            New subscriptions record the verified period at activation, so this only covers
            subscriptions created before that was implemented.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <AdminCard>
          <AdminCardHeader
            title="Recurring revenue by currency"
            description="One row per currency. Annual plans would be normalised to a monthly equivalent; none are approved today."
          />
          {summary.mrr.length === 0 ? (
            <p className="py-4 text-[12px] text-text-muted">
              No active recurring subscriptions. When a customer subscribes, their monthly value
              appears here.
            </p>
          ) : (
            <div className="space-y-2">
              {summary.mrr.map((row) => (
                <div
                  key={row.currency}
                  className="flex items-baseline justify-between gap-3 border-b border-[var(--brand-border-soft)] pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="text-[12.5px] text-text">
                    {row.currency} · {formatNumber(row.subscribers)} subscriber
                    {row.subscribers === 1 ? "" : "s"}
                  </span>
                  <span className="text-[15px] font-extrabold tabular-nums text-ink">
                    {formatMoney(row.monthly.minor, row.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader
            title="Collected revenue"
            description="From invoices with status paid, all time. Refunded and failed invoices are excluded."
          />
          <CurrencyBreakdown rows={summary.invoices.revenue} label="Collected" />
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--brand-border-soft)] pt-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                Paid
              </p>
              <p className="text-[13px] font-bold tabular-nums text-[#1B7F4B]">
                {formatNumber(summary.invoices.paid)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                Failed
              </p>
              <p className="text-[13px] font-bold tabular-nums text-[#C93B2B]">
                {formatNumber(summary.invoices.failed)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                Refunded
              </p>
              <p className="text-[13px] font-bold tabular-nums text-[#96610B]">
                {formatNumber(summary.invoices.refunded)}
              </p>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard className="mt-3" padded={false}>
        <div className="p-4 pb-0">
          <AdminCardHeader
            title="Plan distribution"
            description="Subscriptions by status, plan and currency."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <caption className="sr-only">Subscriptions by status, plan and currency</caption>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Plan</Th>
                <Th>Currency</Th>
                <Th align="right">Subscriptions</Th>
              </tr>
            </thead>
            <tbody>
              {summary.statusCounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-[12px] text-text-muted">
                    No subscriptions yet. Paid plans appear here after the first completed
                    checkout.
                  </td>
                </tr>
              ) : (
                summary.statusCounts.map((row) => (
                  <tr key={`${row.status}-${row.planId}-${row.currency}`}>
                    <Td>
                      <Badge
                        tone={
                          row.status === "active"
                            ? "green"
                            : row.status === "past_due"
                              ? "amber"
                              : row.status === "expired"
                                ? "red"
                                : "neutral"
                        }
                      >
                        {row.status.replace("_", " ")}
                      </Badge>
                    </Td>
                    <Td>{PLAN_LABELS[row.planId] ?? row.planId}</Td>
                    <Td>{row.currency}</Td>
                    <Td align="right" numeric>
                      {formatNumber(row.count)}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <p className="mt-3 text-[11px] leading-relaxed text-text-subtle">
        Billing is read-only in this console. Refunds, manual payment confirmation and plan
        overrides are not implemented — each changes what a customer is charged, and none should
        exist behind a table row.
        {totalPaidSubscribers > 0 && (
          <> Totals above cover {formatNumber(totalPaidSubscribers)} paying subscriptions.</>
        )}
      </p>
    </div>
  );
}

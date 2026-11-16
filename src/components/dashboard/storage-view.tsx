"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Database, Sparkles } from "lucide-react";
import { formatBytes, formatPercent } from "@/lib/drive/format";
import { PLANS, formatPrice, resolvePrice } from "@/config/pricing";
import type { StorageUsage } from "@/lib/drive/types";

/**
 * Storage.
 *
 * Shows the plan, the capacity, and the used/available figures straight from
 * `usage()`. The category breakdown only renders when the backend has actually
 * measured it — `authoritative` false means we know the allowance but not the
 * composition, and inventing a split would be a lie with a nice chart attached.
 */
export function StorageView({ usage }: { usage: StorageUsage }) {
  const pct = usage.total > 0 ? Math.min(100, (usage.used / usage.total) * 100) : 0;
  const available = Math.max(0, usage.total - usage.used);
  const plan = PLANS.find((p) => p.id === usage.planId) ?? PLANS[0];
  const nextPlan = PLANS[PLANS.indexOf(plan) + 1];

  // Display the user's monthly INR rate here; all 8 currencies and annual
  // savings are selectable on the Billing page.
  const price = (p: (typeof PLANS)[number]) => {
    const amount = resolvePrice(p, "INR", "monthly");
    return amount === null ? "—" : `${formatPrice(amount, "INR")}/mo`;
  };

  const breakdown = Object.entries(usage.byCategory).filter(([, bytes]) => bytes > 0);
  const hasBreakdown = usage.authoritative && breakdown.length > 0;

  return (
    <div className="space-y-4">
      {/* Capacity card */}
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--brand-border-soft)] px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold tracking-[-0.02em] text-ink">{plan.name} plan</h2>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                Current
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-text-muted">
              {price(plan)} · {formatBytes(plan.storageBytes)} of storage
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Billing
            <ArrowUpRight className="h-3 w-3 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[22px] font-extrabold tabular-nums tracking-[-0.04em] text-ink">
              {formatBytes(usage.used)}
              <span className="ml-1.5 inline-flex items-baseline gap-1 text-[12px] font-semibold tracking-normal text-text-subtle">
                <span>of</span>
                <span>{formatBytes(usage.total)}</span>
              </span>
            </p>
            <p className="text-[11.5px] text-text-muted">
              <span className="font-semibold text-ink">{formatBytes(available)}</span> available
            </p>
          </div>

          <div
            className="mt-2.5 overflow-hidden rounded-full bg-[#E9ECF4]"
            style={{ height: 10 }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            aria-label={`${formatBytes(usage.used)} of ${formatBytes(usage.total)} used`}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Files" value={String(usage.fileCount)} />
            <Stat label="Folders" value={String(usage.folderCount)} />
            <Stat label="Used" value={formatPercent(usage.used, usage.total)} />
          </dl>
        </div>
      </section>

      {/* Breakdown — only when measured */}
      <section className="rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="border-b border-[var(--brand-border-soft)] px-4 py-3">
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">What&apos;s using space</h2>
        </div>
        {hasBreakdown ? (
          <ul className="divide-y divide-[var(--brand-border-soft)]">
            {breakdown
              .sort((a, b) => b[1] - a[1])
              .map(([category, bytes]) => (
                <li key={category} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="font-medium capitalize text-ink">{category}</span>
                    <span className="tabular-nums text-text-muted">
                      {formatBytes(bytes)}
                      <span className="ml-1.5 text-text-subtle">
                        {usage.used > 0 ? Math.round((bytes / usage.used) * 100) : 0}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F7]">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${usage.used > 0 ? (bytes / usage.used) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <div className="px-4 py-6">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <Database className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              No usage breakdown yet
            </p>
            <p className="mt-1 max-w-[440px] text-[11.5px] leading-relaxed text-text-muted">
              A per-category split needs measured file sizes from storage. Until that&apos;s connected,
              Orindle shows the plan allowance rather than an estimated chart.
            </p>
          </div>
        )}
      </section>

      {/* Upgrade */}
      {nextPlan && (
        <section className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
                <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" strokeWidth={2} aria-hidden="true" />
                Need more room?
              </p>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                {nextPlan.name} gives you {formatBytes(nextPlan.storageBytes)} for {price(nextPlan)}.
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Compare plans
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--brand-canvas)] px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">{label}</dt>
      <dd className="mt-0.5 text-[14px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}



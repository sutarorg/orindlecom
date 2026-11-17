"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Database, Sparkles, TrendingUp } from "lucide-react";
import { formatBytes, formatPercent } from "@/lib/drive/format";
import { PLANS, formatPrice, resolvePrice } from "@/config/pricing";
import type { BusinessStorage } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Organization storage.
 *
 * Same capacity semantics as the personal page, with one addition: per-member
 * attribution when the backend can measure it. It renders only when
 * `byMember` is present — a member list showing "0 B" for everyone before
 * attribution has run would read as fact, and somebody would file a ticket.
 *
 * Colour escalates at 80% and 100% because running out of team storage is an
 * operational event, not a cosmetic one.
 */
export function BusinessStorageCard({
  storage,
  variant = "full",
}: {
  storage: BusinessStorage;
  variant?: "full" | "compact";
}) {
  const pct = storage.total > 0 ? Math.min(100, (storage.used / storage.total) * 100) : 0;
  const available = Math.max(0, storage.total - storage.used);
  const tone = pct >= 100 ? "full" : pct >= 80 ? "high" : "normal";
  const fill = tone === "full" ? "#E0533D" : tone === "high" ? "#F9A53B" : "var(--brand-primary)";

  const plan = PLANS.find((candidate) => candidate.id === storage.planId) ?? PLANS[0];
  const nextPlan = PLANS[PLANS.indexOf(plan) + 1];

  if (variant === "compact") {
    return (
      <section className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[12.5px] font-bold tracking-[-0.02em] text-ink">Team storage</h2>
          <Link
            href="/business/storage"
            className="inline-flex min-h-6 items-center gap-1 rounded text-[11px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Manage
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-1 text-[11.5px] text-text">
          <span className="text-[16px] font-extrabold tabular-nums text-ink">
            {formatBytes(storage.used)}
          </span>
          <span>of</span>
          <span className="font-semibold text-ink">{formatBytes(storage.total)}</span>
          <span className="ml-auto text-text-subtle">{formatPercent(storage.used, storage.total)}</span>
        </div>
        <Meter pct={pct} fill={fill} used={storage.used} total={storage.total} height={6} />
      </section>
    );
  }

  const byMember = storage.byMember?.slice().sort((a, b) => b.used - a.used) ?? [];
  const categories = Object.entries(storage.byCategory)
    .filter(([, bytes]) => bytes > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--brand-border-soft)] px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold tracking-[-0.02em] text-ink">
                {storage.planName} plan
              </h2>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                Shared
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-text-muted">
              Inherits the organization owner&rsquo;s active plan — shared by the whole team with no
              per-seat fee.
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Billing
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex flex-wrap items-baseline gap-x-1 text-[22px] font-extrabold tabular-nums tracking-[-0.04em] text-ink">
              <span>{formatBytes(storage.used)}</span>
              <span className="text-[12px] font-semibold tracking-normal text-text-subtle">of</span>
              <span className="text-[12px] font-semibold tracking-normal text-text-subtle">
                {formatBytes(storage.total)}
              </span>
            </p>
            <p className="text-[11.5px] text-text-muted">
              <span className="font-semibold text-ink">{formatBytes(available)}</span> available
            </p>
          </div>

          <Meter pct={pct} fill={fill} used={storage.used} total={storage.total} height={10} />

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Files" value={String(storage.fileCount)} />
            <Stat label="Folders" value={String(storage.folderCount)} />
            <Stat label="Used" value={formatPercent(storage.used, storage.total)} />
            <Stat
              label="Per member"
              value={
                storage.byMember && storage.byMember.length > 0
                  ? formatBytes(storage.used / storage.byMember.length)
                  : "—"
              }
            />
          </dl>

          {tone !== "normal" && (
            <p
              className={cn(
                "mt-3 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed",
                tone === "full"
                  ? "bg-[#FDF3F2] text-[#8F2D20]"
                  : "bg-[#FEF7EA] text-[#7A5209]",
              )}
            >
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span>
                {tone === "full"
                  ? "The organization is out of storage. Uploads will fail until some space is freed or the plan is upgraded."
                  : `The team is at ${formatPercent(storage.used, storage.total)} of its allowance. Uploads will start failing at 100%.`}
              </span>
            </p>
          )}

          {!storage.authoritative && (
            <p className="mt-2 text-[10.5px] leading-relaxed text-text-subtle">
              These figures are the plan allowance only — team usage is confirmed once storage is
              connected.
            </p>
          )}
        </div>
      </section>

      {/* Per-member attribution, only when measured */}
      {byMember.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--brand-border-soft)] px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
              <TrendingUp className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              Usage by member
            </h2>
            <span className="text-[10.5px] text-text-subtle">Top {Math.min(byMember.length, 8)}</span>
          </div>
          <ul className="divide-y divide-[var(--brand-border-soft)]">
            {byMember.slice(0, 8).map((member) => {
              const share = storage.used > 0 ? (member.used / storage.used) * 100 : 0;
              return (
                <li key={member.memberId} className="px-4 py-2">
                  <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
                    <span className="truncate font-medium text-ink">{member.name}</span>
                    <span className="shrink-0 tabular-nums text-text-muted">
                      {formatBytes(member.used)}
                      <span className="ml-1.5 text-text-subtle">{Math.round(share)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EEF1F7]">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Category breakdown, only when measured */}
      {storage.authoritative && categories.length > 0 && (
        <section className="rounded-2xl border border-[var(--brand-border)] bg-white">
          <div className="border-b border-[var(--brand-border-soft)] px-4 py-3">
            <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">What&rsquo;s using space</h2>
          </div>
          <ul className="divide-y divide-[var(--brand-border-soft)]">
            {categories.map(([category, bytes]) => (
              <li key={category} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3 text-[12px]">
                  <span className="font-medium capitalize text-ink">{category}</span>
                  <span className="tabular-nums text-text-muted">
                    {formatBytes(bytes)}
                    <span className="ml-1.5 text-text-subtle">
                      {storage.used > 0 ? Math.round((bytes / storage.used) * 100) : 0}%
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F7]">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${storage.used > 0 ? (bytes / storage.used) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!storage.authoritative && (
        <section className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <Database className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
            No usage breakdown yet
          </p>
          <p className="mt-1 max-w-[460px] text-[11.5px] leading-relaxed text-text-muted">
            A per-member split needs measured file sizes attributed to accounts. Until storage is
            connected, Orindle shows the team allowance rather than an estimated chart.
          </p>
        </section>
      )}

      {nextPlan && (
        <section className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em] text-ink">
                <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" strokeWidth={2} aria-hidden="true" />
                More room for the team
              </p>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                {nextPlan.name} gives everyone {formatBytes(nextPlan.storageBytes)} shared —{" "}
                {priceLabel(nextPlan)}.
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

function priceLabel(plan: (typeof PLANS)[number]) {
  const amount = resolvePrice(plan, "INR", "monthly");
  return amount === null ? "—" : `${formatPrice(amount, "INR")}/mo`;
}

function Meter({
  pct,
  fill,
  used,
  total,
  height,
}: {
  pct: number;
  fill: string;
  used: number;
  total: number;
  height: number;
}) {
  return (
    <div
      className="mt-2.5 overflow-hidden rounded-full bg-[#E9ECF4]"
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={`${formatBytes(used)} of ${formatBytes(total)} used`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, backgroundColor: fill }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--brand-canvas)] px-2.5 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-bold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

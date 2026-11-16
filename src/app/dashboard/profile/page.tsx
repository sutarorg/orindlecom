import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDriveRepository } from "@/lib/drive/service";
import { getViewer } from "@/lib/drive/viewer";
import { formatBytes, formatRelative } from "@/lib/drive/format";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Profile",
  description: "Who you are in Orindle, and what you're using.",
  path: "/dashboard/profile",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Profile.
 *
 * A read-only summary — the editable fields live in Settings, and having two
 * places to edit the same value is how profiles end up inconsistent. This page
 * answers "what does Orindle know about me and what am I using".
 */
export default async function ProfilePage() {
  const [viewer, usage, subscription] = await Promise.all([
    getViewer(),
    getDriveRepository().usage(),
    getDriveRepository().subscription(),
  ]);

  const planName = usage.ok ? usage.data.planName : "Free";
  const used = usage.ok ? usage.data.used : 0;
  const total = usage.ok ? usage.data.total : 0;
  const sub = subscription.ok ? subscription.data : null;

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Profile"
        description="Your account at a glance."
        className="mb-4"
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[18px] font-bold text-white"
            aria-hidden="true"
          >
            {viewer.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[16px] font-extrabold tracking-[-0.03em] text-ink">
              {viewer.name}
              {!viewer.authenticated && (
                <span className="rounded-full bg-[var(--brand-surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-subtle">
                  Not signed in
                </span>
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-text-muted">
              <Mail className="h-3 w-3 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              {viewer.email}
            </p>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserCircle className="h-3 w-3 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
            Edit profile
          </Link>
        </div>

        <dl className="grid border-t border-[var(--brand-border-soft)] sm:grid-cols-3">
          {[
            { label: "Plan", value: planName },
            { label: "Storage used", value: `${formatBytes(used)} of ${formatBytes(total)}` },
            {
              label: "Member since",
              value: sub?.currentPeriodEnd ? formatRelative(sub.currentPeriodEnd) : "Not recorded yet",
            },
          ].map((row, index) => (
            <div
              key={row.label}
              className={
                index > 0
                  ? "border-t border-[var(--brand-border-soft)] px-4 py-3 sm:border-l sm:border-t-0"
                  : "px-4 py-3"
              }
            >
              <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-[12.5px] font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-4 rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <ShieldCheck className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          Security
        </p>
        <p className="mt-1 max-w-[440px] text-[11.5px] leading-relaxed text-text-muted">
          Password changes and session management live in Settings, next to the other account
          controls, so everything about signing in is in one place.
        </p>
        <Link
          href="/dashboard/settings"
          className="mt-2 inline-flex min-h-6 items-center gap-1 rounded text-[11.5px] font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Manage account security
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

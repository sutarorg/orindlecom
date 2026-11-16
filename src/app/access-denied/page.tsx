/**
 * The refusal page.
 *
 * Deliberately **not** at `/admin/...`.
 *
 * The obvious home was `/admin/forbidden`, and it is a redirect loop: every route
 * under `src/app/admin/` is wrapped by `admin/layout.tsx`, so rendering the
 * refusal page would re-run the authorization check that produced the redirect,
 * and redirect again, forever. Next.js offers no way to opt a child segment out of
 * its parent layout, so the refusal has to live outside the segment entirely.
 *
 * This page checks nothing and reveals nothing — no counts, no navigation, no
 * names, and no distinction between "not an administrator" and "your access was
 * disabled". Being here is itself the whole message.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Not available",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  /*
   * One switch, one value, and nothing else is read from the URL. A refusal page
   * that renders arbitrary query text is an open redirect in spirit and a phishing
   * surface in practice: "Your account was suspended, call this number" is one
   * crafted link away.
   */
  const notConfigured = params.reason === "not-configured";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--brand-canvas)] px-4 py-16">
      <div className="w-full max-w-[420px] rounded-[16px] border border-[var(--brand-border)] bg-white p-6 text-center shadow-[0_1px_2px_rgba(23,29,58,0.04)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-surface-muted)] text-text-muted">
          <ShieldOff className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-4 text-[18px] font-extrabold tracking-[-0.03em] text-ink">
          {notConfigured ? "Administration isn\u2019t connected" : "This area isn\u2019t available"}
        </h1>
        <p className="mx-auto mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed text-text-muted">
          {notConfigured
            ? "This deployment has no account system configured, so the administration console cannot run. Nothing here is broken — it simply isn\u2019t set up yet."
            : "Your account doesn\u2019t have platform administration access. If you believe that is a mistake, contact the platform owner."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Go to your dashboard
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-10 items-center rounded-xl border border-[var(--brand-border-strong)] px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Contact support
          </Link>
        </div>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";

/**
 * Route-level error boundary.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * The app had no `error.tsx` at all. When a Server Component threw, Next had
 * nothing to render in the route's place, so the visitor got an empty document —
 * no header, no logo, no sentence, and on a dark browser chrome it reads as a
 * completely black screen. That is indistinguishable from a blank or broken
 * deployment, and it gives the person nothing to do.
 *
 * A boundary does not fix a crash, but it makes the failure legible and gives the
 * one action that reliably works (a fresh request) instead of a dead page.
 *
 * It deliberately does **not** guess at the cause. A wrong explanation is worse
 * than none: it sends someone to change a password or re-verify an email for a
 * problem that was a transient render fault.
 *
 * `digest` is the only detail Next forwards from a server error. It is shown
 * because it is the one thing that makes a support report actionable, and it
 * carries no user data.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server already logged the stack; this keeps the client-side case
    // visible in the browser console rather than silently swallowed.
    console.error("[render] route error boundary", error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_50%_0%,rgba(231,226,253,0.7),rgba(255,255,255,0)_72%)]"
      />

      <div className="w-full max-w-[460px] rounded-[14px] border border-[var(--brand-border)] bg-surface p-7 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3E2]">
          <AlertTriangle className="h-5 w-5 text-[#8A5A12]" strokeWidth={1.9} aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
          This page didn&apos;t load
        </h1>
        <p className="mx-auto mt-2 max-w-[40ch] text-[13.5px] leading-relaxed text-text-muted">
          Something went wrong while building this screen. Nothing in your account changed — trying
          again usually works.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-text-subtle">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[var(--brand-border)] bg-surface px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Go to dashboard
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-5 border-t border-[var(--brand-border-soft)] pt-4 text-[11.5px] leading-relaxed text-text-subtle">
          If this keeps happening, write to{" "}
          <a
            href="mailto:tejassutar.business@gmail.com"
            className="font-medium text-primary hover:underline"
          >
            tejassutar.business@gmail.com
          </a>{" "}
          with the reference above.
        </p>
      </div>
    </div>
  );
}

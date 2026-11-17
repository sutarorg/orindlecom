"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Dashboard error boundary.
 *
 * Scoped to `/dashboard` on purpose. The root `app/error.tsx` replaces the whole
 * page, which on the dashboard also removes the navigation — leaving someone who
 * was browsing their files with no way back except the browser's back button.
 * This one renders *inside* the dashboard shell, so the sidebar and header stay
 * and only the panel that failed is replaced.
 *
 * The copy names the failure honestly and does not suggest the account is at
 * fault: a render fault says nothing about the customer's data.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render] dashboard error boundary", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[560px] px-1 py-10">
      <div className="rounded-[14px] border border-[var(--brand-border)] bg-surface p-7 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#FEF3E2]">
          <AlertTriangle className="h-5 w-5 text-[#8A5A12]" strokeWidth={1.9} aria-hidden="true" />
        </span>

        <h2 className="mt-4 text-[17px] font-extrabold tracking-[-0.02em] text-ink">
          This panel didn&apos;t load
        </h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[13px] leading-relaxed text-text-muted">
          The rest of your dashboard is fine and your files were not touched. Try loading this panel
          again, or pick another section from the sidebar.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-text-subtle">Reference: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          Reload this panel
        </button>
      </div>
    </div>
  );
}

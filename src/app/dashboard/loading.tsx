"use client";

import { usePathname } from "next/navigation";

/**
 * Route loading boundary for the dashboard and workspace.
 *
 * Why this exists: every dashboard route is `force-dynamic` and does its Supabase
 * work on the server, so a tab click used to do nothing visible until the whole
 * round trip finished — no spin, no fade, just a dead pause. A Suspense boundary
 * around the route segment gives Next somewhere to paint during that time.
 *
 * It is deliberately a skeleton of the *shape* of a page (a title block and a grid
 * of cards) rather than a spinner, so the layout does not jump when the real
 * content arrives and the visitor can see the page assembling.
 *
 * `aria-busy` and the status line keep it meaningful for assistive technology
 * instead of being a purely visual flourish.
 */
export default function DashboardLoading() {
  /*
   * The skeleton is derived from the route, not fixed.
   *
   * It used to be one shape — a title and six cards — which is the Overview page's
   * shape. On `/dashboard/files` that meant a tab click painted six card outlines and
   * then replaced them with a grid of tiles: a visible lie about what is loading, and
   * a layout jump. A skeleton is only worth having if it predicts the thing that is
   * about to arrive.
   */
  const pathname = usePathname();
  const tileView = pathname?.startsWith("/dashboard/files") || pathname?.startsWith("/dashboard/folders");

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this page…</span>

      {/* Title block */}
      <div className="animate-pulse">
        <div className="h-6 w-44 rounded-lg bg-[var(--brand-surface-muted)]" />
        <div className="mt-2.5 h-3.5 w-72 rounded bg-[var(--brand-surface-muted)]" />
      </div>

      {tileView ? (
        <>
          {/* Toolbar strip, then tiles — the file and folder routes. */}
          <div className="mt-5 flex animate-pulse items-center gap-2">
            <div className="h-8 w-40 rounded-lg bg-[var(--brand-surface-muted)]" />
            <div className="ml-auto h-8 w-24 rounded-lg bg-[var(--brand-surface-muted)]" />
          </div>
          <div className="mt-4 grid animate-pulse grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-[var(--brand-border-soft)] bg-white/60 p-2"
              >
                <div className="aspect-square w-full rounded-lg bg-[var(--brand-surface-muted)]" />
                <div className="mt-2 h-3 w-3/4 rounded bg-[var(--brand-surface-muted)]" />
                <div className="mt-1.5 h-2.5 w-1/2 rounded bg-[var(--brand-surface-muted)]" />
              </div>
            ))}
          </div>
        </>
      ) : (
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-2xl border border-[var(--brand-border-soft)] bg-white/60 p-4"
          >
            <div className="h-3 w-24 rounded bg-[var(--brand-surface-muted)]" />
            <div className="mt-3 h-7 w-20 rounded bg-[var(--brand-surface-muted)]" />
            <div className="mt-3 h-2.5 w-full rounded bg-[var(--brand-surface-muted)]" />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

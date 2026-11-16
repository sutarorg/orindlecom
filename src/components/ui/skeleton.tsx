import { cn } from "@/lib/utils";

/**
 * Loading placeholders.
 *
 * Shaped like the content they stand in for, at the real dimensions, so the
 * page doesn't reflow when the data lands. A generic grey bar would technically
 * be a loading state; matching the tile and row geometry is what makes it feel
 * fast.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/** Grid of placeholder tiles matching the real tile geometry. */
export function TileGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-[var(--brand-border-soft)] bg-white p-3"
        >
          <Skeleton className="h-[72px] w-full rounded-lg" />
          <Skeleton className="mt-2.5 h-3 w-3/4" />
          <Skeleton className="mt-1.5 h-2.5 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Rows matching the list-view geometry, including the column rhythm. */
export function ListSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-[var(--brand-border-soft)] px-3 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="hidden h-3 w-16 sm:block" />
          <Skeleton className="hidden h-3 w-20 md:block" />
          <Skeleton className="hidden h-3 w-12 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--brand-border)] bg-white p-4" aria-hidden="true">
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-3 h-5 w-28" />
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
    </div>
  );
}

/** Announced to assistive tech while the visual placeholders are decorative. */
export function LoadingAnnouncer({ label }: { label: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}

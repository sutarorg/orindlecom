"use client";

import * as React from "react";
import { ChevronDown, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TocEntry {
  id: string;
  heading: string;
  gist?: string;
  /** Set when the section needs lawyer review — shown as a marker in the list. */
  needsReview?: boolean;
}

/**
 * Table of contents.
 *
 * Desktop: a sticky rail that highlights the section you are reading. The
 * highlight comes from an IntersectionObserver rather than scroll maths, because
 * a section can be several screens tall and "the last heading above the fold" is
 * the correct definition of current, not "the heading nearest the top".
 *
 * Mobile: a disclosure that lists the same entries in a sheet-like panel. A
 * twelve-section rail would be taller than the article on a phone; a collapsed
 * "On this page" row costs one line and stays out of the way.
 */
export function TableOfContents({
  entries,
  variant,
}: {
  entries: TocEntry[];
  variant: "rail" | "disclosure";
}) {
  const [activeId, setActiveId] = React.useState<string>(entries[0]?.id ?? "");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) return;

    // Track every heading that has crossed the top of the viewport and treat the
    // last one as current. Recomputing from the whole set avoids the flicker a
    // per-element observer produces when two headings are visible at once.
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) visible.add(record.target.id);
          else visible.delete(record.target.id);
        }

        const firstVisible = headings.find((heading) => visible.has(heading.id));
        if (firstVisible) {
          setActiveId(firstVisible.id);
          return;
        }

        // Nothing in the observation band: fall back to the closest heading above.
        let candidate = headings[0];
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top <= 120) candidate = heading;
        }
        setActiveId(candidate.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [entries]);

  const jump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    setOpen(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    // Move focus so keyboard and screen-reader users land where the eye does.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  if (variant === "disclosure") {
    return (
      <div className="rounded-[12px] border border-[var(--brand-border)] bg-white">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="toc-mobile-panel"
          className="flex min-h-[48px] w-full items-center justify-between gap-3 px-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <ListTree className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
            On this page
            <span className="font-normal text-text-subtle">
              {entries.length} sections
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-text-muted transition-transform duration-200",
              open && "rotate-180",
            )}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ol id="toc-mobile-panel" className="border-t border-[var(--brand-border-soft)] px-1.5 py-1.5">
            {entries.map((entry, index) => {
              const active = entry.id === activeId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => jump(entry.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex min-h-[42px] w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "bg-primary-soft font-semibold text-primary-ink"
                        : "text-text-muted hover:bg-[var(--brand-canvas)] hover:text-ink",
                    )}
                  >
                    <span className="w-4 shrink-0 text-[10.5px] tabular-nums text-text-subtle">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{entry.heading}</span>
                    {entry.needsReview && <ReviewDot />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    );
  }

  return (
    <nav aria-label="On this page" className="text-[12px]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        On this page
      </p>
      <ol className="mt-2.5 space-y-0.5 border-l border-[var(--brand-border)]">
        {entries.map((entry, index) => {
          const active = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => jump(entry.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "-ml-px flex w-full items-start gap-2 border-l-2 py-1.5 pl-3 pr-1 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-primary font-semibold text-ink"
                    : "border-transparent text-text-muted hover:border-[var(--brand-border-strong)] hover:text-ink",
                )}
              >
                <span className="mt-px w-3.5 shrink-0 text-[10px] tabular-nums text-text-subtle">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 leading-[1.45]">{entry.heading}</span>
                {entry.needsReview && <ReviewDot />}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 flex items-start gap-1.5 pl-1 text-[10.5px] leading-[1.5] text-text-subtle">
        <ReviewDot />
        Needs legal review before publication
      </p>
    </nav>
  );
}

function ReviewDot() {
  return (
    <span
      aria-label="Needs legal review"
      title="Needs legal review"
      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9A63E]"
    />
  );
}

"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Download, Search, X } from "lucide-react";

/**
 * The filter bar.
 *
 * A plain GET-style form: every control writes to the URL, and the URL is the
 * query. That means a filtered view is bookmarkable, shareable, survives a
 * refresh, and works with the back button.
 *
 * Search is debounced only in the browser — the server always receives a complete
 * term, never a keystroke stream, so a slow typist cannot produce a query per
 * character.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelect {
  name: string;
  label: string;
  options: FilterOption[];
  /** Value treated as "no filter". Always present, always first. */
  allLabel: string;
}

export function FilterBar({
  searchPlaceholder,
  selects = [],
  exportHref,
  exportLabel,
}: {
  searchPlaceholder: string;
  selects?: FilterSelect[];
  exportHref?: string;
  exportLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in sync when the URL changes from outside (a cleared filter,
  // a browser back navigation).
  React.useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const apply = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change resets to page 1: staying on page 4 of a new result set
      // is how a search returns "no results" for something that exists.
      next.delete("page");
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ q: value.trim() || null }), 320);
  };

  const hasFilters = [...searchParams.keys()].some((key) => key !== "page" && key !== "pageSize");

  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:max-w-[320px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
          strokeWidth={2.2}
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-[var(--brand-border-strong)] bg-white pl-8 pr-2.5 text-[12.5px] text-ink placeholder:text-text-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        />
      </div>

      {/*
        * The select carries its own `aria-label`, so a separate <label> here would
        * be a second, empty label — worse than none. Avoided deliberately.
        */}
      {selects.map((select) => (
        <select
          key={select.name}
          value={searchParams.get(select.name) ?? ""}
          onChange={(event) => apply({ [select.name]: event.target.value || null })}
          aria-label={select.label}
          className="h-9 rounded-lg border border-[var(--brand-border-strong)] bg-white px-2 text-[12.5px] font-medium text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
        >
          <option value="">{select.allLabel}</option>
          {select.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push(pathname);
          }}
          className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold text-text-muted transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
          Clear
        </button>
      )}

      {exportHref && (
        <a
          href={exportHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] px-2.5 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:ml-auto"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
          {exportLabel ?? "Export CSV"}
        </a>
      )}
    </div>
  );
}

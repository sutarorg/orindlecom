"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Filter,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { CATEGORY_LABEL } from "@/lib/drive/format";
import type { FileCategory, SortKey } from "@/lib/drive/types";
import { useDrive } from "./drive-store";
import { cn } from "@/lib/utils";

/**
 * File manager toolbar.
 *
 * One row on desktop, two on tablet, and a search-first layout on mobile where
 * the secondary controls collapse behind a single "View" button. The sort and
 * filter controls are real menus, and the view toggle is a radio group so it
 * is announced as a choice rather than a pair of buttons.
 */

const SORT_OPTIONS: Array<{ key: SortKey; label: string; shortcut?: string }> = [
  { key: "name", label: "Name" },
  { key: "modifiedAt", label: "Date modified" },
  { key: "size", label: "Size" },
  { key: "category", label: "Type" },
];

const CATEGORIES: FileCategory[] = [
  "image",
  "video",
  "audio",
  "pdf",
  "document",
  "spreadsheet",
  "presentation",
  "archive",
  "code",
  "text",
];

export function FileToolbar({
  /** Show the filters button. Hidden on collections where filtering is noise. */
  showFilters = true,
  searchPlaceholder = "Search files…",
  /** Extra controls rendered on the right, e.g. trash-specific actions. */
  trailing,
}: {
  showFilters?: boolean;
  searchPlaceholder?: string;
  trailing?: React.ReactNode;
}) {
  const { search, setSearch, view, setView, sort, direction, setSort, categories, toggleCategory, clearFilters } =
    useDrive();

  const sortRef = React.useRef<HTMLButtonElement>(null);
  const filterRef = React.useRef<HTMLButtonElement>(null);
  const viewRef = React.useRef<HTMLButtonElement>(null);
  const [sortOpen, setSortOpen] = React.useState(false);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);

  const activeFilters = categories.length;
  const sortLabel = SORT_OPTIONS.find((option) => option.key === sort)?.label ?? "Name";

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--brand-border-soft)] pb-3 sm:flex-row sm:items-center">
      {/* Search — the primary control, so it gets the space. */}
      <div className="relative flex-1 sm:max-w-[320px]">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
          strokeWidth={2.1}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 w-full rounded-lg border border-[var(--brand-border)] bg-white pl-8.5 pr-8 text-[12.5px] text-ink placeholder:text-text-subtle transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.14)] [&::-webkit-search-cancel-button]:hidden"
          style={{ paddingLeft: 32 }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-subtle hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Sort */}
        <button
          ref={sortRef}
          type="button"
          onClick={() => setSortOpen(true)}
          aria-haspopup="menu"
          aria-expanded={sortOpen}
          // The visible label is hidden below `sm`, so the button needs an
          // explicit name or it becomes an unlabelled icon on mobile.
          aria-label={`Sort by ${sortLabel}, ${direction === "asc" ? "ascending" : "descending"}`}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-white px-2.5 text-[12px] font-medium text-text transition-colors hover:border-[var(--brand-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          <span className="hidden sm:inline">{sortLabel}</span>
          {direction === "asc" ? (
            <ArrowUp className="h-3 w-3 text-text-subtle" strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <ArrowDown className="h-3 w-3 text-text-subtle" strokeWidth={2.4} aria-hidden="true" />
          )}
        </button>
        <Menu
          open={sortOpen}
          onClose={() => setSortOpen(false)}
          anchor={sortRef.current}
          label="Sort by"
          width={196}
          items={SORT_OPTIONS.map((option) => ({
            key: option.key,
            label: `${option.label}${sort === option.key ? (direction === "asc" ? " (A–Z)" : " (Z–A)") : ""}`,
            onSelect: () => setSort(option.key),
          }))}
        />

        {/* Filters */}
        {showFilters && (
          <>
            <button
              ref={filterRef}
              type="button"
              onClick={() => setFilterOpen(true)}
              aria-haspopup="menu"
              aria-expanded={filterOpen}
              aria-label={`Filter${activeFilters > 0 ? ` (${activeFilters} active)` : ""}`}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeFilters > 0
                  ? "border-primary text-primary-ink"
                  : "border-[var(--brand-border)] text-text hover:border-[var(--brand-border-strong)]",
              )}
            >
              <Filter className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="hidden md:inline">Filter</span>
              {activeFilters > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9.5px] font-bold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
            <Menu
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              anchor={filterRef.current}
              label="Filter by type"
              width={200}
              items={[
                ...CATEGORIES.map((category) => ({
                  key: category,
                  label: `${categories.includes(category) ? "✓ " : ""}${CATEGORY_LABEL[category]}`,
                  onSelect: () => toggleCategory(category),
                })),
                ...(activeFilters > 0
                  ? [{ key: "clear", label: "Clear all filters", separatorBefore: true, onSelect: clearFilters }]
                  : []),
              ]}
            />
          </>
        )}

        {/* View toggle — a radio group, because it is a choice of two. */}
        <div
          role="radiogroup"
          aria-label="View mode"
          className="flex h-9 items-center rounded-lg border border-[var(--brand-border)] bg-white p-0.5"
        >
          {(
            [
              { mode: "grid" as const, icon: LayoutGrid, label: "Grid view" },
              { mode: "list" as const, icon: List, label: "List view" },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={view === mode}
              aria-label={label}
              onClick={() => setView(mode)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                view === mode
                  ? "bg-[var(--brand-surface-muted)] text-ink"
                  : "text-text-subtle hover:text-text",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </div>

        {trailing}
      </div>
    </div>
  );
}

/** Inline note under the toolbar when filters are hiding results. */
export function ActiveFilterNotice({ total, shown }: { total: number; shown: number }) {
  const { categories, search, clearFilters } = useDrive();
  if (categories.length === 0 && !search) return null;

  return (
    <div className="flex items-center gap-2 pt-2 text-[11.5px] text-text-muted">
      <span>
        Showing {shown} of {total}
        {search && ` matching “${search}”`}
      </span>
      <button
        type="button"
        onClick={clearFilters}
        className="inline-flex items-center gap-1 rounded font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}

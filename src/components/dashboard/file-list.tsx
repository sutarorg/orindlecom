"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, MoreVertical, Star } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { CATEGORY_LABEL, formatBytes, formatRelative } from "@/lib/drive/format";
import type { DriveItem, SortKey } from "@/lib/drive/types";
import { FileTypeIcon, FolderIcon } from "./file-icon";
import { useDrive } from "./drive-store";
import { cn } from "@/lib/utils";

/**
 * List view.
 *
 * Columns: name, type, modified, size, actions. Type and size are dropped
 * progressively as the viewport narrows — modified is kept longest because
 * "when did I last touch this" is the question people actually ask of a list.
 *
 * The header is a real sort control: clicking toggles direction, and the
 * aria-sort attribute tells assistive tech which column is active. Rows are a
 * single tab stop with arrow-key traversal, matching the grid.
 */

const COLUMNS: Array<{ key: SortKey; label: string; className: string; srOnly?: boolean }> = [
  // Display is decided here, not in the header row: a shared `flex` on the
  // wrapper wins over `hidden` (same CSS layer), which is how four column
  // headings ended up on a 390px screen.
  { key: "name", label: "Name", className: "flex min-w-0 flex-1 items-center gap-1" },
  { key: "category", label: "Type", className: "hidden w-[92px] shrink-0 items-center gap-1 md:flex" },
  { key: "modifiedAt", label: "Modified", className: "hidden w-[104px] shrink-0 items-center gap-1 sm:flex" },
  { key: "size", label: "Size", className: "hidden w-[76px] shrink-0 items-center gap-1 text-right lg:flex" },
];

export function FileList({
  items,
  onOpen,
  onContext,
  onRowAction,
  selectable = true,
}: {
  items: DriveItem[];
  onOpen: (item: DriveItem) => void;
  onContext: (item: DriveItem, anchor: HTMLElement) => void;
  /** Runs a row action through the manager, which owns the API calls. */
  onRowAction: (item: DriveItem, action: string) => void;
  selectable?: boolean;
}) {
  const { select, isSelected, selected, selectMode, beginSelection, sort, direction, setSort } = useDrive();
  const [focusIndex, setFocusIndex] = React.useState(0);
  const rowRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  React.useEffect(() => {
    setFocusIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const move = (delta: 1 | -1) => {
    if (items.length === 0) return;
    const next = Math.max(0, Math.min(items.length - 1, focusIndex + delta));
    setFocusIndex(next);
    rowRefs.current[next]?.focus();
  };

  return (
    <div
      role="grid"
      aria-label="Files"
      aria-rowcount={items.length}
      aria-multiselectable={selectable || undefined}
      data-drive-surface
      /* Rows are a click target, not prose: without this, a shift-click or a
         sloppy drag paints a text selection across filenames. */
      className="select-none overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white"
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          setFocusIndex(0);
          rowRefs.current[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          const last = items.length - 1;
          setFocusIndex(last);
          rowRefs.current[last]?.focus();
        }
      }}
    >
      {/* Header */}
      <div
        role="row"
        className="flex items-center gap-2 border-b border-[var(--brand-border)] bg-[var(--brand-canvas)] px-3 py-2 sm:gap-3"
      >
        <span className="w-4 shrink-0" aria-hidden="true" />
        {/* On phones only Name survives; the header stays because it is still
            the sort control, just without four empty column labels. */}
        {COLUMNS.map((column) => {
          const active = sort === column.key;
          return (
            <div
              key={column.key}
              role="columnheader"
              aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
              className={cn(column.className)}
            >
              <button
                type="button"
                onClick={() => setSort(column.key)}
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded text-[10.5px] font-semibold uppercase tracking-[0.06em] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active ? "text-ink" : "text-text-subtle hover:text-text",
                  column.className.includes("text-right") && "ml-auto flex-row-reverse",
                )}
              >
                <span className="truncate">{column.label}</span>
                {active &&
                  (direction === "asc" ? (
                    <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={2.6} aria-hidden="true" />
                  ))}
              </button>
            </div>
          );
        })}
        <span className="w-6 shrink-0" aria-hidden="true" />
      </div>

      <div role="rowgroup">
        {items.map((item, index) => {
          const active = isSelected(item.id);
          return (
            <ListRow
              key={item.id}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              item={item}
              selected={active}
              anySelected={selectable && selected.size > 0}
              tabIndex={index === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onActivate={(event) => {
                setFocusIndex(index);
                /*
                 * Same rule as the grid: outside select mode a click opens, inside
                 * it a click picks. Two views that disagree about what a click does
                 * would make the product feel like two products.
                 */
                if (!selectMode) {
                  onOpen(item);
                  return;
                }
                if (event.shiftKey) select(item.id, { range: true });
                else select(item.id, { additive: true });
              }}
              onOpen={() => {
                if (!selectMode) onOpen(item);
              }}
              onContext={(anchor) => {
                if (!selectMode) beginSelection(item.id);
                onContext(item, anchor);
              }}
              onRowAction={(action) => onRowAction(item, action)}
              selectable={selectable}
            />
          );
        })}
      </div>
    </div>
  );
}

const ListRow = React.forwardRef<
  HTMLDivElement,
  {
    item: DriveItem;
    selected: boolean;
    anySelected: boolean;
    tabIndex: number;
    selectable: boolean;
    onFocus: () => void;
    onActivate: (event: React.MouseEvent | React.KeyboardEvent) => void;
    onOpen: () => void;
    onContext: (anchor: HTMLElement) => void;
    onRowAction: (action: string) => void;
  }
>(function ListRow(
  { item, selected, anySelected, tabIndex, selectable, onFocus, onActivate, onOpen, onContext, onRowAction },
  ref,
) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  /*
   * The same menu as the grid tile, in the same order: Open, Select, Star, Share,
   * Move to Trash. Select replaces the old duplicated "Preview"/"Open" entry and is
   * where selection begins; the remaining entries route through the manager instead
   * of being the `() => undefined` stubs they were.
   */
  const items: MenuItem[] = React.useMemo(
    () => [
      { key: "open", label: item.kind === "folder" ? "Open" : "Preview", onSelect: onOpen },
      { key: "select", label: "Select", onSelect: () => onRowAction("select") },
      {
        key: "star",
        label: item.starred ? "Remove from Starred" : "Add to Starred",
        onSelect: () => onRowAction("star"),
      },
      { key: "share", label: "Share", onSelect: () => onRowAction("share") },
      {
        key: "trash",
        label: "Move to Trash",
        destructive: true,
        separatorBefore: true,
        onSelect: () => onRowAction("trash"),
      },
    ],
    [item, onOpen, onRowAction],
  );

  return (
    <div
      ref={ref}
      role="row"
      data-item-id={item.id}
      tabIndex={tabIndex}
      aria-selected={selectable ? selected : undefined}
      onFocus={onFocus}
      onClick={onActivate}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        } else if (event.key === " ") {
          event.preventDefault();
          onActivate(event);
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onContext(event.currentTarget);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContext(event.currentTarget);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group flex cursor-default items-center gap-2 border-b border-[var(--brand-border-soft)] px-3 py-2 transition-colors last:border-b-0 sm:gap-3",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
        selected ? "bg-primary-soft/60" : "hover:bg-[var(--brand-surface-muted)]",
        !selected && anySelected && "opacity-70",
      )}
    >
      {/* Selection checkbox */}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-opacity",
          selected ? "border-primary bg-primary" : "border-[var(--brand-border-strong)] bg-white",
          !selectable && "hidden",
          !selected && !hovered && !anySelected && "opacity-0",
        )}
      >
        {selected && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white" aria-hidden="true">
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {item.kind === "folder" ? <FolderIcon size="sm" /> : <FileTypeIcon category={item.category} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-ink">
            <span className="truncate">{item.name}</span>
            {item.starred && (
              <Star className="h-2.5 w-2.5 shrink-0 fill-[#F9A53B] text-[#F9A53B]" aria-label="Starred" />
            )}
            {item.shared && (
              <span className="shrink-0 rounded bg-[var(--brand-surface-muted)] px-1 text-[9.5px] font-semibold uppercase tracking-wide text-text-subtle">
                Shared
              </span>
            )}
          </p>
          {/* On phones the metadata columns are hidden, so fold the essentials
              into a second line rather than losing the information entirely. */}
          <p className="truncate text-[10.5px] text-text-subtle sm:hidden">
            {item.kind === "folder" ? `${item.childCount} items` : formatBytes(item.size)}
            {" · "}
            {formatRelative(item.modifiedAt)}
          </p>
        </div>
      </div>

      <div className="hidden w-[92px] shrink-0 md:block">
        <span className="text-[11.5px] text-text-muted capitalize">
          {item.kind === "folder" ? "Folder" : CATEGORY_LABEL[item.category]}
        </span>
      </div>

      <div className="hidden w-[104px] shrink-0 sm:block">
        <span className="text-[11.5px] tabular-nums text-text-muted">{formatRelative(item.modifiedAt)}</span>
      </div>

      <div className="hidden w-[76px] shrink-0 text-right lg:block">
        <span className="text-[11.5px] tabular-nums text-text-muted">
          {item.kind === "folder" ? "—" : formatBytes(item.size)}
        </span>
      </div>

      <div className="w-6 shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            // Opening the menu asks what you may do; it does not pick the row.
            setMenuOpen(true);
          }}
          aria-label={`Actions for ${item.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-text-subtle transition-[opacity,background-color] hover:bg-white hover:text-ink focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            menuOpen || hovered ? "opacity-100" : "opacity-0",
          )}
        >
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchor={menuRef.current}
          items={items}
          label={`Actions for ${item.name}`}
        />
      </div>
    </div>
  );
});

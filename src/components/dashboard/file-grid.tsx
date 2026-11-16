"use client";

import * as React from "react";
import { MoreVertical, Star } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { formatBytes, formatRelative } from "@/lib/drive/format";
import type { DriveItem } from "@/lib/drive/types";
import { FileTypeIcon, FolderIcon } from "./file-icon";
import { useDrive } from "./drive-store";
import { cn } from "@/lib/utils";

/**
 * Grid view.
 *
 * Tiles are square-ish with a preview/icon plate on top and two lines of
 * metadata — the proportion that keeps a 4-across grid readable at 1280px
 * without turning into a wall of empty cards at 1920px.
 *
 * Selection is the thing that has to feel right. The tile carries
 * `aria-selected` and a roving tabindex: the whole grid is one tab stop, arrow
 * keys move within it, Enter opens, Space selects. That is how a native file
 * manager behaves and how a screen reader user expects a grid of items to work.
 */
export function FileGrid({
  items,
  onOpen,
  onContext,
}: {
  items: DriveItem[];
  onOpen: (item: DriveItem) => void;
  onContext: (item: DriveItem, anchor: HTMLElement) => void;
}) {
  const { select, isSelected, selected, view } = useDrive();
  const [focusIndex, setFocusIndex] = React.useState(0);
  const tileRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  // Keep the roving index inside the list as it shrinks.
  React.useEffect(() => {
    setFocusIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const columnsFor = (index: number) => {
    // Mirrors the Tailwind grid: 2 / 3 / 4 / 5 columns.
    const width = window.innerWidth;
    if (width >= 1536) return 5;
    if (width >= 1024) return 4;
    if (width >= 640) return 3;
    return 2;
  };

  const move = (delta: 1 | -1) => {
    if (items.length === 0) return;
    const next = Math.max(0, Math.min(items.length - 1, focusIndex + delta));
    setFocusIndex(next);
    tileRefs.current[next]?.focus();
  };

  const moveRow = (delta: 1 | -1) => {
    if (items.length === 0) return;
    const columns = columnsFor(focusIndex);
    const next = Math.max(0, Math.min(items.length - 1, focusIndex + delta * columns));
    setFocusIndex(next);
    tileRefs.current[next]?.focus();
  };

  return (
    <div
      role="grid"
      aria-label="Files"
      aria-multiselectable="true"
      data-drive-surface
      className="grid select-none grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 2xl:grid-cols-5"
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(-1);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          moveRow(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveRow(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          setFocusIndex(0);
          tileRefs.current[0]?.focus();
        } else if (event.key === "End") {
          event.preventDefault();
          const last = items.length - 1;
          setFocusIndex(last);
          tileRefs.current[last]?.focus();
        }
      }}
    >
      {items.map((item, index) => {
        const active = isSelected(item.id);
        return (
          <GridTile
            key={item.id}
            ref={(node) => {
              tileRefs.current[index] = node;
            }}
            item={item}
            selected={active}
            anySelected={selected.size > 0}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            onActivate={(event) => {
              setFocusIndex(index);
              if (event.shiftKey) select(item.id, { range: true });
              else if (event.metaKey || event.ctrlKey) select(item.id, { additive: true });
              else select(item.id);
            }}
            onOpen={() => onOpen(item)}
            onContext={(anchor) => {
              if (!active) select(item.id);
              onContext(item, anchor);
            }}
            view={view}
          />
        );
      })}
    </div>
  );
}

const GridTile = React.forwardRef<
  HTMLDivElement,
  {
    item: DriveItem;
    selected: boolean;
    anySelected: boolean;
    tabIndex: number;
    onFocus: () => void;
    onActivate: (event: React.MouseEvent | React.KeyboardEvent) => void;
    onOpen: () => void;
    onContext: (anchor: HTMLElement) => void;
    view: "grid" | "list";
  }
>(function GridTile(
  { item, selected, anySelected, tabIndex, onFocus, onActivate, onOpen, onContext },
  ref,
) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { select } = useDrive();
  const [hovered, setHovered] = React.useState(false);

  const items: MenuItem[] = React.useMemo(
    () => [
      { key: "open", label: item.kind === "folder" ? "Open" : "Preview", onSelect: onOpen },
      {
        key: "star",
        label: item.starred ? "Remove from Starred" : "Add to Starred",
        onSelect: () => undefined,
      },
      { key: "share", label: "Share", onSelect: () => undefined },
      {
        key: "trash",
        label: "Move to Trash",
        destructive: true,
        separatorBefore: true,
        onSelect: () => undefined,
      },
    ],
    [item, onOpen],
  );

  return (
    <div
      ref={ref}
      role="gridcell"
      tabIndex={tabIndex}
      aria-selected={selected}
      aria-label={`${item.name}${item.kind === "file" ? `, ${formatBytes(item.size)}` : `, folder with ${item.childCount} items`}`}
      data-selected={selected}
      data-item-id={item.id}
      onFocus={onFocus}
      onClick={onActivate}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (event.metaKey || event.ctrlKey || event.shiftKey) onActivate(event);
          else onOpen();
        } else if (event.key === " ") {
          event.preventDefault();
          onActivate(event);
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onContext((menuRef.current?.parentElement as HTMLElement) ?? (event.target as HTMLElement));
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onContext(event.currentTarget);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative flex cursor-default flex-col rounded-xl border bg-white p-2.5 text-left transition-[border-color,box-shadow,background-color] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        selected
          ? "border-primary bg-primary-soft/40 shadow-[0_0_0_1px_var(--brand-primary)]"
          : "border-[var(--brand-border-soft)] hover:border-[var(--brand-border-strong)] hover:shadow-[var(--brand-shadow-sm)]",
        // Dim unselected tiles while a selection exists, so the selection reads
        // as a set rather than as several unrelated boxes.
        !selected && anySelected && "opacity-70",
      )}
    >
      {/* Selection checkbox: appears on hover or when anything is selected. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1.5 top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-[4px] border transition-opacity",
          selected
            ? "border-primary bg-primary opacity-100"
            : "border-[var(--brand-border-strong)] bg-white",
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

      {/* Overflow menu */}
      <div ref={menuRef} className="absolute right-1 top-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            select(item.id);
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

      {/* Plate */}
      <div className="flex h-[76px] items-center justify-center rounded-lg bg-[var(--brand-canvas)]">
        {item.kind === "folder" ? <FolderIcon size="lg" /> : <FileTypeIcon category={item.category} size="lg" />}
      </div>

      <div className="mt-2 min-w-0">
        <p className="truncate text-[12px] font-semibold leading-snug text-ink" title={item.name}>
          {item.name}
        </p>
        <p className="mt-0.5 truncate text-[10.5px] text-text-subtle">
          {item.kind === "folder"
            ? `${item.childCount} ${item.childCount === 1 ? "item" : "items"}`
            : formatBytes(item.size)}
          {" · "}
          {formatRelative(item.modifiedAt)}
        </p>
      </div>

      {item.starred && (
        <Star
          className="absolute bottom-2.5 right-2.5 h-3 w-3 fill-[#F9A53B] text-[#F9A53B]"
          aria-label="Starred"
        />
      )}
    </div>
  );
});

"use client";

import * as React from "react";
import { MoreVertical, Star } from "lucide-react";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { formatBytes, formatRelative } from "@/lib/drive/format";
import type { DriveItem } from "@/lib/drive/types";
import { FolderIcon } from "./file-icon";
import { FileThumbnail } from "./file-thumbnail";
import { assignFolderColours, type FolderColour } from "@/lib/drive/folder-colour";
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
  onRowAction,
}: {
  items: DriveItem[];
  onOpen: (item: DriveItem) => void;
  onContext: (item: DriveItem, anchor: HTMLElement) => void;
  /**
   * Runs a row action for one item. Owned by the manager, which is the only place
   * that knows how to talk to the API — the tile asks, it does not act.
   */
  onRowAction: (item: DriveItem, action: string) => void;
}) {
  const { select, isSelected, selected, selectMode, beginSelection, view } = useDrive();
  const [focusIndex, setFocusIndex] = React.useState(0);
  const tileRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  /*
   * Folder colours are assigned across the visible set, not hashed per id, so the
   * first four folders in any listing are four different colours. See
   * `folder-colour.ts` for the measurement behind that choice.
   */
  const folderColours = React.useMemo(
    () => assignFolderColours(items.filter((item) => item.kind === "folder").map((item) => item.id)),
    [items],
  );

  // Keep the roving index inside the list as it shrinks.
  React.useEffect(() => {
    setFocusIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const columnsFor = (_index: number) => {
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
            onClick={(event) => {
              setFocusIndex(index);
              /*
               * Two behaviours behind one click, decided by whether a selection is
               * live. Outside select mode a click opens — the primary action, and
               * what a person clicking a file in their own drive expects. Inside
               * it, a click picks; modifiers still refine the pick.
               */
              if (!selectMode) {
                onOpen(item);
                return;
              }
              if (event.shiftKey) select(item.id, { range: true });
              else select(item.id, { additive: true });
            }}
            /* A double click is two clicks, so in select mode it must not toggle
               twice and land back where it started. Outside select mode the first
               click already opened the item, so there is nothing left to do. */
            onOpen={() => {
              if (!selectMode) onOpen(item);
            }}
            onAction={(action) => onRowAction(item, action)}
            onContext={(anchor) => {
              // The row menu shows the menu bar's actions for this row, so it makes
              // it the current selection — but it must not replace a multi-item
              // selection the visitor built deliberately.
              if (!selectMode) beginSelection(item.id);
              onContext(item, anchor);
            }}
            view={view}
            folderColour={folderColours.get(item.id)}
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
    onClick: (event: React.MouseEvent) => void;
    onOpen: () => void;
    onContext: (anchor: HTMLElement) => void;
    /** Runs a row action through the manager, which owns the API calls. */
    onAction: (action: string) => void;
    /** Assigned across the listing so neighbouring folders differ. */
    folderColour?: FolderColour;
    view: "grid" | "list";
  }
>(function GridTile(
  { item, selected, anySelected, tabIndex, onFocus, onClick, onOpen, onContext, onAction, folderColour },
  ref,
) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { beginSelection } = useDrive();
  const [hovered, setHovered] = React.useState(false);

  /*
   * Open, then Select.
   *
   * The tile menu used to offer "Preview"/"Open" — the same action a click already
   * performs — and its star, share and trash entries were `() => undefined` stubs
   * that closed the menu and did nothing. "Select" replaces the redundant open
   * entry, which is where selection now begins; the destructive and sharing actions
   * are routed through the manager's row menu, which is one implementation rather
   * than two that can drift.
   */
  const items: MenuItem[] = React.useMemo(
    () => [
      { key: "open", label: item.kind === "folder" ? "Open" : "Preview", onSelect: onOpen },
      {
        key: "select",
        label: "Select",
        onSelect: () => beginSelection(item.id),
      },
      { key: "star", label: item.starred ? "Remove from Starred" : "Add to Starred", onSelect: () => onAction("star") },
      { key: "share", label: "Share", onSelect: () => onAction("share") },
      {
        key: "trash",
        label: "Move to Trash",
        destructive: true,
        separatorBefore: true,
        onSelect: () => onAction("trash"),
      },
    ],
    [item, onOpen, beginSelection, onAction],
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
      onClick={onClick}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        /*
         * Enter opens, Space selects — the native file-manager pair. Keyboard users
         * get the same rule, and Space is what enters select mode from the
         * keyboard, so a selection can be built without a pointer.
         */
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
        } else if (event.key === " ") {
          event.preventDefault();
          onAction("select-row");
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
            // Opening the menu is not a selection: it is how you ask what you may
            // do, and answering that should not change what is picked.
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

      {/*
        Plate. Square, and showing the file itself wherever the file can be shown —
        an icon standing in for an image, a PDF or a spreadsheet is a wasted square.
      */}
      {item.kind === "folder" ? (
        <div className="flex aspect-square w-full items-center justify-center">
          <FolderIcon size="xl" colour={folderColour} id={item.id} />
        </div>
      ) : (
        <FileThumbnail item={item} />
      )}

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

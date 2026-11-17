"use client";

import * as React from "react";
import type { DriveItem, ListQuery, SortDirection, SortKey } from "@/lib/drive/types";

/**
 * Client-side drive state.
 *
 * Scoped to a single dashboard route: the server component fetches, this holds
 * the presentation state (sort, filter, search, selection, view mode) and the
 * list the visitor is looking at. It is a context rather than props because the
 * toolbar, the content grid and the selection bar all read the same state and
 * threading it through would make every intermediate component care.
 *
 * Selection is an explicit mode, not something a click does by accident.
 *
 * Clicking a file opens it. Clicking a folder opens it. Neither selects, because
 * in this product the click is the primary action — you are here to look at your
 * files, not to build a selection. Selection begins from the three-dot menu
 * ("Select"), and once it has begun, clicking items toggles them, so building a
 * multi-file selection is a run of clicks with no modifier keys.
 *
 * That is why the mode has to be visible: if clicking sometimes opens and
 * sometimes selects, the only honest thing to do is say which one is live. The
 * bar at the top of the list is that statement, and it disappears the moment the
 * selection is cleared.
 *
 * Within select mode the modifiers still work as people expect:
 *   - Click toggles one item.
 *   - Shift-click extends from the anchor within the current ordering.
 *   - Escape clears (and leaves the mode); Ctrl/Cmd-A selects all visible.
 */

export type ViewMode = "grid" | "list";

interface DriveState {
  items: DriveItem[];
  /** True when the backend list was empty and no filters narrow it further. */
  isLoading: boolean;
  error: string | null;

  view: ViewMode;
  setView: (view: ViewMode) => void;

  sort: SortKey;
  direction: SortDirection;
  setSort: (key: SortKey) => void;

  categories: string[];
  toggleCategory: (category: string) => void;
  clearFilters: () => void;

  search: string;
  setSearch: (value: string) => void;

  selected: Set<string>;
  /** True while clicks pick items instead of opening them. */
  selectMode: boolean;
  /** Enter select mode, optionally selecting one item on the way in. */
  beginSelection: (id?: string) => void;
  /** Leave select mode and drop the selection. */
  clearSelection: () => void;
  select: (id: string, options?: { additive?: boolean; range?: boolean }) => void;
  selectAll: () => void;
  isSelected: (id: string) => boolean;

  /** Item currently shown in the preview panel, if any. */
  previewId: string | null;
  openPreview: (id: string) => void;
  closePreview: () => void;

  /** Folder being viewed, for breadcrumbs and "new folder" target. */
  parentId: string | null;
}

const DriveContext = React.createContext<DriveState | null>(null);

export function useDrive() {
  const context = React.useContext(DriveContext);
  if (!context) throw new Error("useDrive must be used inside <DriveProvider>");
  return context;
}

/**
 * Sorts a list in place-free fashion.
 *
 * Folders always lead, which is the one ordering rule that isn't negotiable:
 * a drive where folders sort among files by size is disorienting at any list
 * length. Within each group the visitor's chosen key applies.
 */
export function sortItems(items: DriveItem[], key: SortKey, direction: SortDirection): DriveItem[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    switch (key) {
      case "size":
        return ((a.size ?? 0) - (b.size ?? 0)) * factor;
      case "modifiedAt":
        return (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()) * factor;
      case "category":
        return a.category.localeCompare(b.category) * factor;
      case "name":
      default:
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) * factor;
    }
  });
}

export function DriveProvider({
  initialItems,
  parentId = null,
  onQueryChange,
  children,
}: {
  initialItems: DriveItem[];
  parentId?: string | null;
  /** Called when sort/search change, so a live backend can refetch. */
  onQueryChange?: (query: Pick<ListQuery, "sort" | "direction" | "search" | "categories">) => void;
  children: React.ReactNode;
}) {
  const [view, setView] = React.useState<ViewMode>("grid");
  const [sort, setSortKey] = React.useState<SortKey>("name");
  const [direction, setDirection] = React.useState<SortDirection>("asc");
  const [categories, setCategories] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = React.useState(false);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const anchorRef = React.useRef<string | null>(null);

  // Persist the view mode: people who prefer a list expect it back tomorrow.
  React.useEffect(() => {
    const stored = window.localStorage.getItem("orindle:view");
    if (stored === "grid" || stored === "list") setView(stored);
  }, []);

  const changeView = React.useCallback((next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem("orindle:view", next);
    } catch {
      // Private mode; the preference simply doesn't persist.
    }
  }, []);

  // Keep the visible ordering stable so shift-click ranges match what's on screen.
  const visible = React.useMemo(() => {
    let list = sortItems(initialItems, sort, direction);
    if (categories.length > 0) list = list.filter((item) => categories.includes(item.category));
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(needle));
    }
    return list;
  }, [initialItems, sort, direction, categories, search]);

  const setSort = React.useCallback(
    (key: SortKey) => {
      if (key === sort) {
        setDirection((current) => (current === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setDirection(key === "modifiedAt" ? "desc" : "asc");
      }
    },
    [sort],
  );

  React.useEffect(() => {
    onQueryChange?.({ sort, direction, search, categories: categories as ListQuery["categories"] });
    // onQueryChange is intentionally not a dependency: callers pass stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, direction, search, categories]);

  const toggleCategory = React.useCallback((category: string) => {
    setCategories((current) =>
      current.includes(category) ? current.filter((value) => value !== category) : [...current, category],
    );
  }, []);

  const clearFilters = React.useCallback(() => {
    setCategories([]);
    setSearch("");
  }, []);

  const select = React.useCallback(
    (id: string, options: { additive?: boolean; range?: boolean } = {}) => {
      setSelected((current) => {
        const next = new Set(current);

        if (options.range && anchorRef.current) {
          const ids = visible.map((item) => item.id);
          const from = ids.indexOf(anchorRef.current);
          const to = ids.indexOf(id);
          if (from !== -1 && to !== -1) {
            const [start, end] = from < to ? [from, to] : [to, from];
            for (const item of visible.slice(start, end + 1)) next.add(item.id);
            return next;
          }
        }

        if (options.additive) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
          anchorRef.current = id;
          return next;
        }

        anchorRef.current = id;
        return new Set([id]);
      });
    },
    [visible],
  );

  const selectAll = React.useCallback(() => setSelected(new Set(visible.map((item) => item.id))), [visible]);

  const beginSelection = React.useCallback((id?: string) => {
    setSelectMode(true);
    if (id) {
      anchorRef.current = id;
      setSelected(new Set([id]));
    }
  }, []);

  /*
   * Leaving select mode and emptying the selection are one operation, because they
   * are one experience: the bar goes away and clicking opens again. Splitting them
   * would let the app sit in select mode with nothing selected, which looks like a
   * broken file manager.
   */
  const clearSelection = React.useCallback(() => {
    setSelected(new Set());
    setSelectMode(false);
  }, []);
  const isSelected = React.useCallback((id: string) => selected.has(id), [selected]);

  // Keyboard: Escape clears selection, Ctrl/Cmd-A selects the visible list.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "Escape" && selected.size > 0 && !typing) {
        clearSelection();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" && !typing) {
        // Only hijack select-all when the focus is inside the grid, so it
        // still works normally in the search field.
        if (target?.closest("[data-drive-surface]")) {
          event.preventDefault();
          selectAll();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected.size, clearSelection, selectAll]);

  /**
   * Clicking away from the items clears the selection.
   *
   * A selection mode that can only be left with the X leaves the page in a state
   * where clicking a file does something different from what it did a moment ago,
   * with no obvious way back. Clicking the empty space is the gesture people try,
   * so it is the one that works.
   *
   * The check is on the *item* rather than the surface: a click on the toolbar, the
   * breadcrumb, the search field or the selection bar itself must not clear —
   * otherwise pressing "Move" would empty the selection it was about to act on.
   */
  React.useEffect(() => {
    if (!selectMode) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // A click on an item is handled by the item, which decides whether to toggle.
      if (target.closest("[data-item-id]")) return;

      /*
       * Anything interactive on the page keeps the selection: controls, links,
       * inputs, dialogs, menus, and the bar itself. The rule is "clicked empty
       * space", not "clicked something that is not a file".
       */
      if (
        target.closest(
          "button, a, input, textarea, select, label, [role='menu'], [role='dialog'], [role='toolbar'], [data-keep-selection]",
        )
      ) {
        return;
      }

      clearSelection();
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [selectMode, clearSelection]);

  // Keep preview in sync when the item disappears from the list.
  React.useEffect(() => {
    if (previewId && !visible.some((item) => item.id === previewId)) setPreviewId(null);
  }, [visible, previewId]);

  /*
   * A selection that has been emptied from underneath us — the last selected item
   * was deleted, or a filter hid them — must not leave the bar up. Otherwise the
   * bar reads "0 selected" over an empty list, which is the visual version of a
   * stale pointer.
   */
  React.useEffect(() => {
    if (selectMode && selected.size === 0) clearSelection();
  }, [selectMode, selected.size, clearSelection]);

  const value: DriveState = {
    items: visible,
    isLoading: false,
    error: null,
    view,
    setView: changeView,
    sort,
    direction,
    setSort,
    categories,
    toggleCategory,
    clearFilters,
    search,
    setSearch,
    selected,
    selectMode,
    beginSelection,
    select,
    selectAll,
    clearSelection,
    isSelected,
    previewId,
    openPreview: setPreviewId,
    closePreview: () => setPreviewId(null),
    parentId,
  };

  return <DriveContext.Provider value={value}>{children}</DriveContext.Provider>;
}

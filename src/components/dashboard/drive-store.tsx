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
 * Selection semantics follow the conventions people already have from file
 * managers:
 *   - Plain click selects one item and clears the rest.
 *   - Ctrl/Cmd-click toggles.
 *   - Shift-click extends from the anchor within the current ordering.
 *   - Escape clears; Ctrl/Cmd-A selects all visible.
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
  select: (id: string, options?: { additive?: boolean; range?: boolean }) => void;
  selectAll: () => void;
  clearSelection: () => void;
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

  const selectAll = React.useCallback(() => {
    setSelected(new Set(visible.map((item) => item.id)));
  }, [visible]);

  const clearSelection = React.useCallback(() => setSelected(new Set()), []);
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

  // Keep preview in sync when the item disappears from the list.
  React.useEffect(() => {
    if (previewId && !visible.some((item) => item.id === previewId)) setPreviewId(null);
  }, [visible, previewId]);

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

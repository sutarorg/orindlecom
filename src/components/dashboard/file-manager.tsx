"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  FolderInput,
  FolderPlus,
  Info,
  Link2,
  PencilLine,
  RotateCcw,
  SearchX,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { TRASH_RETENTION, type DriveItem } from "@/lib/drive/types";
import { DriveProvider, useDrive } from "./drive-store";
import { FileGrid } from "./file-grid";
import { FileList } from "./file-list";
import { FileToolbar, ActiveFilterNotice } from "./file-toolbar";
import { SelectionBar } from "./selection-bar";
import { MoveDialog } from "./move-dialog";
import { PreviewPanel } from "./preview-panel";
import { ShareDialog } from "./share-dialog";
import { UploadZone } from "./upload-zone";
import { useRegisterSearch } from "./search-bridge";
import { RenameDialog } from "./rename-dialog";
import { api, triggerDownload } from "@/lib/drive/client";

/**
 * The file manager.
 *
 * Owns the interaction surface shared by My Files, Folders, Recent, Starred,
 * Shared and Trash. What differs between those routes lives in `empty` (the
 * first-use copy) and `mode` (trash gets restore plus permanent delete, starred
 * gets unstar) rather than in duplicated layout.
 *
 * The context menu is hosted once per surface with the anchor held in state,
 * not once per tile — a menu per row would mean a portal per file.
 */

export interface EmptyCopy {
  title: string;
  description: React.ReactNode;
  variant?: "first-use" | "collection";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  art?: React.ReactNode;
  action?: React.ReactNode;
  footnote?: React.ReactNode;
}

export type ManagerMode = "default" | "trash" | "starred" | "shared";

export function FileManager({
  items,
  parentId = null,
  empty,
  mode = "default",
  showFilters = true,
  searchPlaceholder,
  leading,
  toolbarTrailing,
  showUploadZone = false,
}: {
  items: DriveItem[];
  parentId?: string | null;
  empty: EmptyCopy;
  mode?: ManagerMode;
  showFilters?: boolean;
  searchPlaceholder?: string;
  leading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
  showUploadZone?: boolean;
}) {
  return (
    <DriveProvider initialItems={items} parentId={parentId}>
      <FileManagerInner
        empty={empty}
        mode={mode}
        showFilters={showFilters}
        searchPlaceholder={searchPlaceholder}
        leading={leading}
        toolbarTrailing={toolbarTrailing}
        showUploadZone={showUploadZone}
        totalCount={items.length}
        parentId={parentId}
      />
    </DriveProvider>
  );
}

function FileManagerInner({
  empty,
  mode,
  showFilters,
  searchPlaceholder,
  leading,
  toolbarTrailing,
  showUploadZone,
  totalCount,
  parentId,
}: {
  parentId: string | null;
  empty: EmptyCopy;
  mode: ManagerMode;
  showFilters: boolean;
  searchPlaceholder?: string;
  leading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
  showUploadZone: boolean;
  totalCount: number;
}) {
  const {
    items,
    view,
    selected,
    beginSelection,
    clearSelection,
    previewId,
    openPreview,
    closePreview,
    setSearch,
    patchItems,
  } = useDrive();
  const { toast } = useToast();
  const router = useRouter();

  // The shell's search field drives this list's filter, so typing in the topbar
  // and typing in the toolbar do the same thing.
  useRegisterSearch(setSearch);

  const [context, setContext] = React.useState<{ item: DriveItem; anchor: HTMLElement } | null>(null);
  const [shareItem, setShareItem] = React.useState<DriveItem | null>(null);
  const [confirmTrash, setConfirmTrash] = React.useState(false);
  const [confirmPurge, setConfirmPurge] = React.useState(false);
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [renameItem, setRenameItem] = React.useState<DriveItem | null>(null);

  /**
   * Save the selected files.
   *
   * Each file needs its own signed URL, so this walks the selection. If one fails
   * the rest still run — a single unreadable file should not cancel the download
   * of everything beside it — and the failures are reported together at the end so
   * the toast count matches the number of files that did not arrive.
   */
  const downloadFiles = React.useCallback(
    async (ids: string[]) => {
      const itemsById = new Map(items.map((item) => [item.id, item]));
      const failures: string[] = [];

      for (const id of ids) {
        const item = itemsById.get(id);
        if (!item || item.kind === "folder") continue;

        const result = await api.post<{ url: string; filename: string }>(
          `/api/download/${id}`,
          { disposition: "attachment" },
        );

        if (!result.ok) {
          failures.push(item.name);
          continue;
        }
        triggerDownload(result.data.url, result.data.filename);
      }

      if (failures.length > 0) {
        toast({
          tone: "error",
          title:
            failures.length === 1
              ? `Couldn't download ${failures[0]}`
              : `${failures.length} files couldn't be downloaded`,
          description: failures.slice(0, 3).join(", ") + (failures.length > 3 ? "…" : ""),
        });
      }
    },
    [items, toast],
  );

  /**
   * Copy a share link for one item.
   *
   * The link is created server-side first. Copying a URL this component constructed
   * would put a dead address in someone's chat window, so nothing is copied unless
   * the server confirmed a live link.
   */
  const copyLink = React.useCallback(
    async (item: DriveItem) => {
      const created = await api.put<{ url: string; enabled: boolean }>(
        `/api/files/${item.id}/link`,
        { permission: "viewer" },
      );

      if (!created.ok || !created.data.enabled) {
        toast({
          tone: "error",
          title: "Link wasn't created",
          description: created.ok ? "That link isn't active." : created.message,
        });
        return;
      }

      const absolute = new URL(created.data.url, window.location.origin).toString();
      try {
        await navigator.clipboard.writeText(absolute);
        toast({
          tone: "success",
          title: "Link copied",
          description: "Anyone with this link can view the file until it expires.",
        });
      } catch {
        // Clipboard access can be denied. Put the URL somewhere they can select
        // rather than telling them it worked.
        window.prompt("Copy this link:", absolute);
      }
    },
    [toast],
  );

  const renameItems = React.useCallback(
    async (id: string, name: string) => {
      const isFolder = items.find((item) => item.id === id)?.kind === "folder";
      const result = await api.patch<{ name: string }>(
        isFolder ? `/api/folders/${id}` : `/api/files/${id}`,
        { name },
      );
      if (!result.ok) {
        // Return the reason so the dialog can keep the text on screen.
        return result.message;
      }
      router.refresh();
      return null;
    },
    [items, router],
  );

  const trashItems = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const result = await api.post<{ trashed: number }>("/api/trash", { ids });
      if (!result.ok) {
        toast({ tone: "error", title: "Nothing was moved", description: result.message });
        return;
      }
      toast({
        tone: "success",
        title: result.data.trashed === 1 ? "Moved to Trash" : `${result.data.trashed} items moved to Trash`,
        description: `You can restore them for ${TRASH_RETENTION.label}.`,
      });
      router.refresh();
    },
    [router, toast],
  );

  const purgeItems = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const result = await api.post<{ purged: number }>("/api/trash/purge", { ids });
      if (!result.ok) {
        toast({ tone: "error", title: "Nothing was deleted", description: result.message });
        return;
      }
      toast({
        tone: "success",
        title: result.data.purged === 1 ? "Deleted permanently" : `${result.data.purged} items deleted`,
        description: "They are gone and their space is free.",
      });
      router.refresh();
    },
    [router, toast],
  );

  /**
   * Star selected items.
   *
   * One request for the whole selection. This used to be one PATCH per id, so a
   * twenty-file selection was twenty sequential round trips — the reason starring
   * a selection felt slow. `desired` is passed explicitly by the bar, which knows
   * what the icon meant; without it, the rule is "star everything unless they are
   * all already starred", which is what a tri-state button implies.
   */
  const toggleStar = React.useCallback(
    async (ids: string[], desired?: boolean) => {
      if (ids.length === 0) return;
      const itemsById = new Map(items.map((item) => [item.id, item]));
      const starred = desired ?? ids.some((id) => !itemsById.get(id)?.starred);

      /*
       * Paint first, confirm second.
       *
       * The star used to change only after the PATCH *and* a `router.refresh()` of the
       * whole route — two round trips before a boolean moved, which is why it felt
       * slow. The optimistic patch is applied immediately, the PATCH confirms it, and
       * the refresh that used to be unconditional is skipped when every row already
       * shows the new value.
       */
      const undo = patchItems(ids, { starred });

      const result = await api.patch<{ updated: number }>("/api/files/star", { ids, starred });
      if (!result.ok) {
        undo();
        toast({ tone: "error", title: "Nothing changed", description: result.message });
        return;
      }
      if (result.data.updated < ids.length) {
        /*
         * A partial write is the one case where the local state is not the truth, so
         * it is dropped rather than guessed at — leaving the optimistic star on rows
         * the server refused would be the exact "reports success the server didn't
         * confirm" failure.
         */
        undo();
        toast({
          tone: "error",
          title: `${ids.length - result.data.updated} not updated`,
          description: "The others were saved.",
        });
        router.refresh();
        return;
      }

      /*
       * No refresh on success.
       *
       * Nothing else on the page depends on a star: the count in this list, the
       * route's own filter (this page is not `/dashboard/starred`), and the sidebar
       * all read either local state or something a star does not touch. The refresh
       * cost a full server render of the layout and the page to change one icon that
       * had already changed.
       */
      if (mode === "starred") router.refresh();
    },
    [items, mode, patchItems, router, toast],
  );

  /**
   * Move selected items into a folder, or back to the top level.
   *
   * Batched into one request per item by the API surface, but issued concurrently
   * so the wall time is the slowest move rather than the sum — a selection of ten
   * files should not take ten round trips end to end.
   */
  const moveItems = React.useCallback(
    async (ids: string[], parentId: string | null) => {
      if (ids.length === 0) return;
      const results = await Promise.all(
        ids.map((id) =>
          id.startsWith("folder:")
            ? api.patch(`/api/folders/${id.slice(7)}/move`, { parentId })
            : api.patch(`/api/files/${id}/move`, { parentId }),
        ),
      );
      const failed = results.filter((result) => !result.ok);
      if (failed.length === ids.length) {
        toast({ tone: "error", title: "Nothing was moved", description: failed[0]?.message });
        return;
      }
      if (failed.length > 0) {
        toast({
          tone: "error",
          title: `${failed.length} ${failed.length === 1 ? "item" : "items"} not moved`,
          description: failed[0]?.message ?? "The others were moved.",
        });
      } else {
        toast({
          tone: "success",
          title: ids.length === 1 ? "1 item moved" : `${ids.length} items moved`,
          description: parentId === null ? "Moved to your top level." : "Moved into the folder.",
        });
      }
      clearSelection();
      router.refresh();
    },
    [clearSelection, router, toast],
  );

  const restoreItems = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const result = await api.post<{ restored: number }>("/api/trash/restore", { ids });
      if (!result.ok) {
        toast({ tone: "error", title: "Nothing was restored", description: result.message });
        return;
      }
      toast({
        tone: "success",
        title:
          result.data.restored === 1
            ? "1 item restored"
            : `${result.data.restored} items restored`,
        description: "They are back where you left them.",
      });
      router.refresh();
    },
    [router, toast],
  );

  const openItem = React.useCallback(
    (item: DriveItem) => {
      /*
       * Selecting never opens.
       *
       * The tile decides this already, but the manager is the component that
       * actually opens a preview, so the rule is enforced here too — otherwise any
       * new caller (a keyboard handler, a future view) could open the panel while a
       * selection is on screen and the selection bar would then be sitting over the
       * file it had just opened.
       */
      if (selected.size > 0) return;

      if (item.kind === "folder") {
        /*
         * In the bin, a folder has nowhere to open.
         *
         * `/dashboard/folders/<id>` resolves a live parent, and a deleted folder is
         * not one — navigating there lands on a not-found page. A click on it
         * therefore picks it, which is the only thing the bin can do with a folder.
         */
        if (mode === "trash") {
          beginSelection(item.id);
          return;
        }
        // A folder is a real route, so opening one is plain navigation — the
        // one action in this manager that works end to end without a backend.
        router.push(`/dashboard/folders/${item.id}`);
        return;
      }
      openPreview(item.id);
    },
    [beginSelection, mode, openPreview, router, selected.size],
  );

  const handleSelectionAction = (action: string) => {
    switch (action) {
      case "move":
        setMoveOpen(true);
        break;
      case "download": {
        // Download every selected file the user can read. One request per file,
        // sequential, so a burst of twenty files does not open twenty signed
        // requests at once.
        const ids = [...selected];
        if (ids.length === 0) break;
        void downloadFiles(ids);
        break;
      }
      case "star": {
        const ids = [...selected];
        if (ids.length === 0) break;
        /*
         * The bar sends the state it displayed, so the result is always the one the
         * visitor asked for: a full star clears, a half star fills everything.
         */
        void toggleStar(ids, selectionStar.state !== "all");
        break;
      }
      case "share":
        setShareItem(items.find((item) => selected.has(item.id)) ?? null);
        break;
      case "trash":
        setConfirmTrash(true);
        break;
      case "restore": {
        const ids = [...selected];
        if (ids.length === 0) break;
        void restoreItems(ids);
        break;
      }
      case "purge":
        setConfirmPurge(true);
        break;
    }
  };

  /**
   * What the star button should show for the current selection.
   *
   *   all    — every selected item is starred: a filled icon, click clears.
   *   none   — none is: an outline icon, click fills.
   *   mixed  — some are: the icon is deliberately NOT filled, because a filled icon
   *            would claim a state half the selection is not in.
   */
  // Not memoised: it is a set-membership count over a handful of items, and the
  // compiler could not preserve the memo anyway, so an explicit one would only be
  // a lie about the cost.
  const selectionStar = (() => {
    const ids = [...selected];
    const starred = ids.filter((id) => items.find((item) => item.id === id)?.starred).length;
    if (ids.length === 0) return { state: "none" as const, count: 0 };
    if (starred === ids.length) return { state: "all" as const, count: ids.length };
    if (starred === 0) return { state: "none" as const, count: ids.length };
    return { state: "mixed" as const, count: ids.length };
  })();

  /**
   * Row actions from a tile menu.
   *
   * The tile does not call the API; it names an action and the manager runs it, so
   * there is one implementation of "star this row" rather than one per view. A row
   * action that needs a selection makes that row the selection first, which is why
   * `beginSelection` is called here rather than in the tile.
   */
  const handleRowAction = React.useCallback(
    (item: DriveItem, action: string) => {
      switch (action) {
        case "select":
          beginSelection(item.id);
          break;
        case "star":
          void toggleStar([item.id]);
          break;
        case "share":
          beginSelection(item.id);
          setShareItem(item);
          break;
        case "trash":
          beginSelection(item.id);
          setConfirmTrash(true);
          break;
        case "restore":
          // Restoring is not a bulk operation from a row menu: the row is the
          // subject, so it restores that one item and touches the selection not at
          // all.
          void restoreItems([item.id]);
          break;
        case "purge":
          /*
           * Permanence always goes through the confirmation, and the confirmation
           * acts on the selection — so the row has to become the selection first.
           * Without this the dialog asked "delete this item?" while the purge ran
           * against whatever was selected, which is nobody's intent.
           */
          beginSelection(item.id);
          setConfirmPurge(true);
          break;
      }
    },
    [beginSelection, toggleStar, restoreItems],
  );

  const previewItem = previewId ? items.find((item) => item.id === previewId) ?? null : null;
  const filtering = items.length !== totalCount;

  // Which actions the context menu offers depends on where you are.
  const contextItems = (item: DriveItem): MenuItem[] => {
    if (mode === "trash") {
      // Same three entries as the row's own three-dot menu: Restore, Select,
      // Delete permanently. Right-clicking should not reveal a different set.
      return [
        { key: "restore", label: "Restore", icon: RotateCcw, onSelect: () => void restoreItems([item.id]) },
        { key: "select", label: "Select", icon: CheckSquare, onSelect: () => beginSelection(item.id) },
        {
          key: "purge",
          label: "Delete permanently",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => {
            beginSelection(item.id);
            setConfirmPurge(true);
          },
        },
      ];
    }
    const base: MenuItem[] = [
      { key: "open", label: item.kind === "folder" ? "Open" : "Preview", icon: Info, onSelect: () => openItem(item) },
      {
        key: "star",
        label: item.starred ? "Remove from Starred" : "Add to Starred",
        icon: Star,
        onSelect: () => void toggleStar([item.id]),
      },
      {
        key: "move",
        label: "Move to…",
        icon: FolderInput,
        onSelect: () => {
          beginSelection(item.id);
          setMoveOpen(true);
        },
      },
      {
        key: "rename",
        label: "Rename",
        icon: PencilLine,
        shortcut: "F2",
        onSelect: () => setRenameItem(item),
      },
      {
        key: "share",
        label: "Share",
        icon: Share2,
        separatorBefore: true,
        onSelect: () => setShareItem(item),
      },
      {
        key: "copy",
        label: "Copy link",
        icon: Link2,
        onSelect: () => void copyLink(item),
      },
      {
        key: "trash",
        label: "Move to Trash",
        icon: Trash2,
        destructive: true,
        separatorBefore: true,
        shortcut: "Del",
        onSelect: () => setConfirmTrash(true),
      },
    ];
    return base;
  };

  return (
    <div className="space-y-3" data-drive-surface>
      {leading}

      {showUploadZone && items.length > 0 && <UploadZone compact />}

      {/* The toolbar sticks under the topbar so sort and view stay reachable
          while scrolling a long folder. */}
      <div className="sticky top-[60px] z-20 -mx-1 bg-[var(--brand-canvas)] px-1 pt-1">
        <SelectionBar onAction={handleSelectionAction} star={selectionStar} mode={mode} />
        {selected.size === 0 && (
          <FileToolbar
            showFilters={showFilters}
            searchPlaceholder={searchPlaceholder}
            trailing={toolbarTrailing}
          />
        )}
      </div>

      <ActiveFilterNotice total={totalCount} shown={items.length} />

      {items.length === 0 ? (
        filtering ? (
          <EmptyState
            variant="collection"
            icon={SearchX}
            title="Nothing matches those filters"
            description="No files here match the current search or type filter. Clearing them brings the full list back."
            action={<ClearFiltersButton />}
          />
        ) : (
          <EmptyState
            // A card that holds a whole route shouldn't collapse to a few
            // hundred pixels of text: it gets a floor so the page keeps its
            // shape when the list is empty.
            className="min-h-[320px] justify-center sm:min-h-[380px]"
            variant={empty.variant ?? "collection"}
            icon={empty.icon ?? FolderPlus}
            art={empty.art}
            title={empty.title}
            description={empty.description}
            action={empty.action}
            footnote={empty.footnote}
          />
        )
      ) : view === "grid" ? (
        <FileGrid
          items={items}
          mode={mode}
          onOpen={openItem}
          onContext={(item, anchor) => setContext({ item, anchor })}
          onRowAction={handleRowAction}
        />
      ) : (
        <FileList
          items={items}
          mode={mode}
          onOpen={openItem}
          onContext={(item, anchor) => setContext({ item, anchor })}
          onRowAction={handleRowAction}
          selectable
        />
      )}

      <Menu
        open={Boolean(context)}
        onClose={() => setContext(null)}
        anchor={context?.anchor ?? null}
        items={context ? contextItems(context.item) : []}
        label={context ? `Actions for ${context.item.name}` : "Actions"}
      />

      <PreviewPanel
        item={previewItem}
        // Only files are previewable, so arrow-key navigation steps through
        // files — folders stay in the grid but out of the "1 of 12" count.
        siblings={items.filter((candidate) => candidate.kind === "file")}
        onClose={closePreview}
        onNavigate={openPreview}
        onShare={(item) => setShareItem(item)}
      />

      <ShareDialog item={shareItem} onClose={() => setShareItem(null)} />

      <MoveDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        itemCount={selected.size}
        currentParentId={parentId}
        disabledIds={
          // A folder cannot be moved inside itself or its own descendant; the server
          // refuses it, and offering the option would only produce an error toast.
          new Set([...selected])
        }
        onMove={(target) => {
          setMoveOpen(false);
          void moveItems([...selected], target);
        }}
      />

      <RenameDialog
        item={renameItem}
        onClose={() => setRenameItem(null)}
        onRename={renameItems}
      />

      <ConfirmDialog
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        onConfirm={() => {
          setConfirmTrash(false);
          const ids = [...selected];
          clearSelection();
          void trashItems(ids);
        }}
        title={`Move ${selected.size === 1 ? "1 item" : `${selected.size} items`} to Trash?`}
        confirmLabel="Move to Trash"
      >
        Deleted items stay in Trash for {TRASH_RETENTION.label}, then are removed permanently. You
        can restore them from there at any time before that.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmPurge}
        onClose={() => setConfirmPurge(false)}
        onConfirm={() => {
          setConfirmPurge(false);
          const ids = [...selected];
          clearSelection();
          void purgeItems(ids);
        }}
        title={
          selected.size > 1
            ? `Permanently delete ${selected.size} items?`
            : "Permanently delete this item?"
        }
        confirmLabel="Delete forever"
      >
        This can&apos;t be undone. The item is removed from Trash and from storage immediately.
      </ConfirmDialog>
    </div>
  );
}

function ClearFiltersButton() {
  const { clearFilters } = useDrive();
  return (
    <button
      type="button"
      onClick={clearFilters}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-3.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      Clear filters
    </button>
  );
}

export { FileToolbar };

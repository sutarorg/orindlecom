"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FolderPlus,
  Info,
  Link2,
  PencilLine,
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
import { NOT_CONNECTED_MESSAGE } from "@/lib/drive/repository";
import { DriveProvider, useDrive } from "./drive-store";
import { FileGrid } from "./file-grid";
import { FileList } from "./file-list";
import { FileToolbar, ActiveFilterNotice } from "./file-toolbar";
import { SelectionBar } from "./selection-bar";
import { PreviewPanel } from "./preview-panel";
import { ShareDialog } from "./share-dialog";
import { UploadZone } from "./upload-zone";
import { useRegisterSearch } from "./search-bridge";

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
}: {
  empty: EmptyCopy;
  mode: ManagerMode;
  showFilters: boolean;
  searchPlaceholder?: string;
  leading?: React.ReactNode;
  toolbarTrailing?: React.ReactNode;
  showUploadZone: boolean;
  totalCount: number;
}) {
  const { items, view, selected, clearSelection, previewId, openPreview, closePreview, setSearch } =
    useDrive();
  const { toast } = useToast();
  const router = useRouter();

  // The shell's search field drives this list's filter, so typing in the topbar
  // and typing in the toolbar do the same thing.
  useRegisterSearch(setSearch);

  const [context, setContext] = React.useState<{ item: DriveItem; anchor: HTMLElement } | null>(null);
  const [shareItem, setShareItem] = React.useState<DriveItem | null>(null);
  const [confirmTrash, setConfirmTrash] = React.useState(false);
  const [confirmPurge, setConfirmPurge] = React.useState(false);

  const notConnected = React.useCallback(
    (title: string) => toast({ tone: "error", title, description: NOT_CONNECTED_MESSAGE }),
    [toast],
  );

  const openItem = React.useCallback(
    (item: DriveItem) => {
      if (item.kind === "folder") {
        // A folder is a real route, so opening one is plain navigation — the
        // one action in this manager that works end to end without a backend.
        router.push(`/dashboard/folders/${item.id}`);
        return;
      }
      openPreview(item.id);
    },
    [openPreview, router],
  );

  const handleSelectionAction = (action: string) => {
    switch (action) {
      case "download":
        notConnected("Download unavailable");
        break;
      case "star":
        notConnected("Star unavailable");
        break;
      case "share":
        setShareItem(items.find((item) => selected.has(item.id)) ?? null);
        break;
      case "trash":
        setConfirmTrash(true);
        break;
      case "restore":
        notConnected("Nothing was restored");
        break;
      case "purge":
        setConfirmPurge(true);
        break;
    }
  };

  const previewItem = previewId ? items.find((item) => item.id === previewId) ?? null : null;
  const filtering = items.length !== totalCount;

  // Which actions the context menu offers depends on where you are.
  const contextItems = (item: DriveItem): MenuItem[] => {
    if (mode === "trash") {
      return [
        { key: "restore", label: "Restore", icon: Download, onSelect: () => notConnected("Nothing was restored") },
        {
          key: "purge",
          label: "Delete permanently",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => setConfirmPurge(true),
        },
      ];
    }
    const base: MenuItem[] = [
      { key: "open", label: item.kind === "folder" ? "Open" : "Preview", icon: Info, onSelect: () => openItem(item) },
      {
        key: "star",
        label: item.starred ? "Remove from Starred" : "Add to Starred",
        icon: Star,
        onSelect: () => notConnected("Star unavailable"),
      },
      {
        key: "rename",
        label: "Rename",
        icon: PencilLine,
        shortcut: "F2",
        onSelect: () => notConnected("Nothing was renamed"),
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
        onSelect: () => notConnected("No link was created"),
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
        <SelectionBar onAction={handleSelectionAction} />
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
          onOpen={openItem}
          onContext={(item, anchor) => setContext({ item, anchor })}
        />
      ) : (
        <FileList
          items={items}
          onOpen={openItem}
          onContext={(item, anchor) => setContext({ item, anchor })}
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

      <ConfirmDialog
        open={confirmTrash}
        onClose={() => setConfirmTrash(false)}
        onConfirm={() => {
          setConfirmTrash(false);
          clearSelection();
          notConnected("Nothing was moved");
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
          clearSelection();
          notConnected("Nothing was deleted");
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

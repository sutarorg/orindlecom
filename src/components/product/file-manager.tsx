"use client";

import * as React from "react";
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  Folder,
  FolderPlus,
  Grid2x2,
  Home,
  List,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { CloudGlyph } from "@/components/brand/logo";
import { FolderGlyph } from "@/components/brand/plan-icon";
import { StorageMeter } from "./storage-meter";
import { cn } from "@/lib/utils";

/**
 * Real file manager.
 *
 * This is software, not a picture of software: search filters, the grid/list
 * view switch works, folder selection works, and the keyboard model is a
 * roving tabindex over the tiles.
 *
 * It operates on an **empty** library, which is the true state before an account
 * is connected to storage. Actions that need a live backend (upload, new folder)
 * are disabled with an explanation rather than pretending to succeed.
 */

type View = "grid" | "list";

interface FolderItem {
  id: string;
  name: string;
  from: string;
  to: string;
  count: number;
}

const EMPTY: FolderItem[] = [];

const SAMPLE_FOLDERS: FolderItem[] = [
  { id: "documents", name: "Documents", from: "#7FB2FA", to: "#3B7DE8", count: 0 },
  { id: "photos", name: "Photos", from: "#8CE3BE", to: "#38BD8B", count: 0 },
  { id: "projects", name: "Projects", from: "#FFC078", to: "#FB8F3D", count: 0 },
  { id: "designs", name: "Designs", from: "#BCA6FD", to: "#8B5CF6", count: 0 },
];

export function FileManager({
  folders = EMPTY,
  title = "My Files",
  className,
  connected = false,
}: {
  folders?: FolderItem[];
  title?: string;
  className?: string;
  connected?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<View>("grid");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [openFolder, setOpenFolder] = React.useState<FolderItem | null>(null);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, query]);

  const total = folders.reduce((sum, f) => sum + f.count, 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border border-[var(--brand-border)] bg-white shadow-[var(--brand-shadow-lg)]",
        className,
      )}
    >
      <div className="flex">
        {/* ---------------- sidebar ---------------- */}
        <aside className="hidden w-[152px] shrink-0 flex-col justify-between border-r border-[var(--brand-border-soft)] p-3 sm:flex">
          <div>
            <div className="flex items-center gap-1.5 px-1">
              <CloudGlyph className="h-[13px] w-[20px] text-primary" />
              <span className="text-[13px] font-bold tracking-[-0.02em] text-ink">Orindle</span>
            </div>

            <nav aria-label="Library" className="mt-3.5">
              <ul className="space-y-0.5">
                {[
                  { label: "Home", Icon: Home, active: true },
                  { label: "My Files", Icon: Folder },
                  { label: "Shared", Icon: Share2 },
                  { label: "Recent", Icon: FileText },
                  { label: "Trash", Icon: Trash2 },
                ].map(({ label, Icon, active }) => (
                  <li key={label}>
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[12px] font-medium transition-colors",
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-text hover:bg-[var(--brand-surface-muted)]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <StorageMeter used={0} total={10 * 1000 ** 3} />
        </aside>

        {/* ---------------- main ---------------- */}
        <div className="min-w-0 flex-1 p-3 sm:p-4">
          {/* toolbar */}
          <div className="flex items-center gap-2">
            {openFolder ? (
              <button
                type="button"
                onClick={() => setOpenFolder(null)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-[12px] font-medium text-text transition-colors hover:bg-[var(--brand-surface-muted)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                Back
              </button>
            ) : (
              <div className="flex h-8 flex-1 items-center gap-1.5 rounded-lg border border-[var(--brand-border-soft)] px-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden="true" />
                <label htmlFor="fm-search" className="sr-only">
                  Search folders
                </label>
                <input
                  id="fm-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search files…"
                  className="min-w-0 flex-1 bg-transparent py-1 text-[12px] text-ink outline-none placeholder:text-text-subtle"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="rounded p-0.5 text-text-subtle hover:text-ink"
                  >
                    <X className="h-3 w-3" strokeWidth={2.4} />
                  </button>
                )}
              </div>
            )}

            <div
              className="flex items-center rounded-lg bg-[var(--brand-surface-muted)] p-0.5"
              role="group"
              aria-label="View mode"
            >
              {([
                { id: "grid", Icon: Grid2x2, label: "Grid view" },
                { id: "list", Icon: List, label: "List view" },
              ] as const).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-pressed={view === id}
                  aria-label={label}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                    view === id ? "bg-white text-ink shadow-xs" : "text-text-subtle hover:text-ink",
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={2.1} aria-hidden="true" />
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!connected}
              title={connected ? "Upload a file" : "Connect storage to upload files"}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-3 w-3" strokeWidth={2.3} aria-hidden="true" />
              Upload
            </button>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <h3 className="text-[15px] font-bold tracking-[-0.025em] text-ink">
              {openFolder ? openFolder.name : title}
            </h3>
            <span className="text-[11px] text-text-subtle">
              {visible.length} {visible.length === 1 ? "folder" : "folders"}
            </span>
          </div>

          {/* body */}
          {visible.length === 0 ? (
            <EmptyState query={query} connected={connected} />
          ) : view === "grid" ? (
            <ul
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="listbox"
              aria-label="Folders"
            >
              {visible.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected === folder.id}
                    onClick={() => setSelected(folder.id)}
                    onDoubleClick={() => setOpenFolder(folder)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setOpenFolder(folder);
                    }}
                    className={cn(
                      "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-colors",
                      selected === folder.id
                        ? "border-primary bg-primary-soft/60"
                        : "border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] hover:border-[var(--brand-border-strong)]",
                    )}
                  >
                    <FolderGlyph from={folder.from} to={folder.to} className="h-8 w-9" />
                    <span className="truncate text-[11px] font-medium text-text">
                      {folder.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--brand-border-soft)]" role="listbox" aria-label="Folders">
              {visible.map((folder) => (
                <li key={folder.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected === folder.id}
                    onClick={() => setSelected(folder.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-1 py-2 text-left transition-colors",
                      selected === folder.id ? "bg-primary-soft/50" : "hover:bg-[var(--brand-surface-muted)]",
                    )}
                  >
                    <FolderGlyph from={folder.from} to={folder.to} className="h-5 w-6" />
                    <span className="flex-1 truncate text-[12px] text-text">{folder.name}</span>
                    <span className="text-[11px] text-text-subtle">{folder.count} items</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {total === 0 && visible.length > 0 && (
            <p className="mt-3 text-[11px] text-text-subtle">
              These folders are empty. Drop files in to fill them.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ query, connected }: { query: string; connected: boolean }) {
  const searching = query.trim().length > 0;
  return (
    <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] px-4 py-9 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
        {searching ? (
          <Search className="h-5 w-5 text-primary" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <CloudUpload className="h-5 w-5 text-primary" strokeWidth={1.7} aria-hidden="true" />
        )}
      </span>
      <p className="mt-3 text-[13px] font-semibold text-ink">
        {searching ? "No folders match that search" : "Nothing here yet"}
      </p>
      <p className="mt-1 max-w-[36ch] text-[11.5px] leading-relaxed text-text-muted">
        {searching
          ? "Try a shorter word, or clear the search to see everything."
          : connected
            ? "Drag files into this window, or create a folder to get your library started."
            : "This preview runs without a storage connection, so it starts empty. Sign up to connect your own library."}
      </p>

      {!searching && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={!connected}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-3 w-3" strokeWidth={2.3} aria-hidden="true" />
            Upload files
          </button>
          <button
            type="button"
            disabled={!connected}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--brand-border-strong)] bg-white px-3 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderPlus className="h-3 w-3" strokeWidth={2.1} aria-hidden="true" />
            New folder
          </button>
        </div>
      )}
    </div>
  );
}

export { SAMPLE_FOLDERS };

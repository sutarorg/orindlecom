"use client";

import * as React from "react";
import { Folder, Home, MoveRight } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/drive/client";
import { cn } from "@/lib/utils";

interface FolderOption {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * "Move to…" dialog.
 *
 * Destinations are shown as a flat, indented list rather than a tree you drill
 * into. Moving a file is a one-off decision, and a drill-down makes the destination
 * you want three clicks away and hides every alternative — for a list that is
 * usually under twenty folders, one indented column answers "where can this go" in
 * a single glance.
 *
 * The folder you are currently inside is excluded: "move into the folder it is
 * already in" is not a move, and offering it invites a no-op that reports success.
 */
export function MoveDialog({
  open,
  onClose,
  onMove,
  itemCount,
  currentParentId,
  disabledIds,
}: {
  open: boolean;
  onClose: () => void;
  onMove: (parentId: string | null) => void;
  itemCount: number;
  /** Where the items live now; excluded from the list. */
  currentParentId: string | null;
  /** Folders that cannot receive these items — the items themselves, and their descendants. */
  disabledIds?: Set<string>;
}) {
  const [folders, setFolders] = React.useState<FolderOption[]>([]);
  // Loading starts true: the dialog only mounts when opened, and the fetch runs on
  // mount, so initialising to false would paint an empty list for one frame.
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /** `undefined` = nothing chosen yet; `null` = top level; string = that folder. */
  const [chosen, setChosen] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setError(null);
    void api
      .get<{ folders: FolderOption[] }>("/api/folders")
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setFolders(result.data.folders);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  /** Depth-first ordering with a depth, so the list reads as the drive is shaped. */
  const ordered = React.useMemo(() => {
    const byParent = new Map<string | null, FolderOption[]>();
    for (const folder of folders) {
      const key = folder.parentId;
      byParent.set(key, [...(byParent.get(key) ?? []), folder]);
    }

    const out: Array<{ folder: FolderOption; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      for (const folder of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
        out.push({ folder, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [folders]);

  const isDisabled = (id: string) =>
    id === currentParentId || Boolean(disabledIds?.has(id));

  return (
    <Dialog open={open} onClose={onClose} title="Move to" size="md">
      <div className="space-y-3">
        <p className="text-[12.5px] text-text-muted">
          {itemCount === 1 ? "Move 1 item into:" : `Move ${itemCount} items into:`}
        </p>

        <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[var(--brand-border-soft)] p-1">
          <Row
            label="My files"
            icon={Home}
            depth={0}
            active={chosen === null}
            onSelect={() => setChosen(null)}
          />

          {loading && <p className="px-2 py-3 text-[12px] text-text-subtle">Loading folders…</p>}
          {error && <p className="px-2 py-3 text-[12px] text-[#C93B2B]">{error}</p>}

          {!loading && !error && ordered.length === 0 && (
            <p className="px-2 py-3 text-[12px] text-text-subtle">
              No folders yet — this will go to your top level.
            </p>
          )}

          {ordered.map(({ folder, depth }) => (
            <Row
              key={folder.id}
              label={folder.name}
              icon={Folder}
              depth={depth}
              active={chosen === folder.id}
              disabled={isDisabled(folder.id)}
              onSelect={() => setChosen(folder.id)}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-3.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onMove(chosen ?? null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <MoveRight className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            Move here
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Row({
  label,
  icon: Icon,
  depth,
  active,
  disabled = false,
  onSelect,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  depth: number;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-current={active}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[12.5px] transition-colors",
        active ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink hover:bg-[var(--brand-surface-muted)]",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
      {disabled && <span className="ml-auto text-[10.5px] text-text-subtle">can&apos;t</span>}
    </button>
  );
}

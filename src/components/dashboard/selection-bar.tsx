"use client";

import * as React from "react";
import { Download, FolderInput, RotateCcw, Share2, Star, Trash2, X } from "lucide-react";
import { useDrive } from "./drive-store";
import { cn } from "@/lib/utils";

/**
 * The contextual selection bar.
 *
 * Its existence is the statement that select mode is on: it replaces the toolbar
 * the moment selection begins and disappears the moment it ends. That is the whole
 * reason it can be a horizontal bar rather than a floating panel — it occupies the
 * toolbar's slot, so the list below does not jump.
 *
 * The star button is tri-state, and the state is the icon's fill, not its colour
 * alone. "Mixed" is intentionally *not* filled: a selection where one item is
 * starred and another is not is not a starred selection, and a filled icon would
 * be claiming otherwise. Clicking always resolves to a definite state — if
 * everything is starred it clears, otherwise it stars everything.
 */
export function SelectionBar({
  onAction,
  star,
  mode = "default",
}: {
  onAction: (action: string) => void;
  /** Aggregate star state of the current selection. */
  star: { state: "all" | "none" | "mixed"; count: number };
  /**
   * Where the bar is shown. In the bin the actions are a different set entirely:
   * there is nothing to move, share or star about a deleted file, so offering
   * those would be offering controls that cannot mean anything. What is left is
   * what the bin is actually for — restore, take a copy, or destroy.
   */
  mode?: "default" | "trash" | "starred" | "shared";
}) {
  const { selected, clearSelection, selectAll, items } = useDrive();

  if (selected.size === 0) return null;

  const allSelected = selected.size === items.length && items.length > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2",
        "border-primary/25 bg-primary-soft/70 motion-safe:animate-[toastIn_150ms_cubic-bezier(0.22,0.68,0.28,1)]",
      )}
      role="toolbar"
      aria-label="Selected items"
    >
      <button
        type="button"
        onClick={clearSelection}
        aria-label="Clear selection"
        className="flex h-7 w-7 items-center justify-center rounded-md text-primary-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
      </button>

      <p className="text-[12px] font-semibold text-primary-ink" role="status" aria-live="polite">
        {selected.size} selected
      </p>

      <button
        type="button"
        onClick={() => (allSelected ? clearSelection() : selectAll())}
        className="rounded text-[11.5px] font-medium text-primary-ink/80 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {allSelected ? "Clear all" : "Select all"}
      </button>

      <div className="ml-auto flex items-center gap-1">
        {mode === "trash" ? (
          <>
            <ToolbarButton icon={RotateCcw} label="Restore" onClick={() => onAction("restore")} />
            <ToolbarButton icon={Download} label="Download" onClick={() => onAction("download")} />
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-primary/20" />
            <ToolbarButton
              icon={Trash2}
              label="Delete"
              destructive
              onClick={() => onAction("purge")}
            />
          </>
        ) : (
          <>
            <StarButton state={star.state} onClick={() => onAction("star")} />
            <ToolbarButton icon={FolderInput} label="Move" onClick={() => onAction("move")} />
            <ToolbarButton icon={Download} label="Download" onClick={() => onAction("download")} />
            <ToolbarButton icon={Share2} label="Share" onClick={() => onAction("share")} />
            <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-primary/20" />
            <ToolbarButton icon={Trash2} label="Delete" destructive onClick={() => onAction("trash")} />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The star control.
 *
 * `aria-pressed` reports the definite state: true only when every selected item is
 * starred, so a mixed selection reads as "not pressed" — matching the icon, which
 * is also unfilled. The label says what the click will do, not what the state is,
 * because the click is what the visitor is deciding about.
 */
function StarButton({
  state,
  onClick,
}: {
  state: "all" | "none" | "mixed";
  onClick: () => void;
}) {
  const filled = state === "all";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={filled}
      aria-label={
        filled ? "Remove star from selected items" : "Star all selected items"
      }
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        filled ? "text-[#B77414] hover:bg-white" : "text-primary-ink hover:bg-white",
      )}
    >
      <Star
        className={cn(
          "h-3.5 w-3.5 transition-colors",
          filled ? "fill-[#F9A53B] text-[#F9A53B]" : "text-primary-ink",
        )}
        strokeWidth={2.1}
        aria-hidden
      />
      <span className="hidden sm:inline">{filled ? "Starred" : "Star"}</span>
      <span className="sr-only sm:hidden">{filled ? "Starred" : "Star"}</span>
    </button>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        destructive ? "text-[#C93B2B] hover:bg-[#FDF3F2]" : "text-primary-ink hover:bg-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

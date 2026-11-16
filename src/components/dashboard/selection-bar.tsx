"use client";

import * as React from "react";
import { Download, Share2, Star, Trash2, X } from "lucide-react";
import { useDrive } from "./drive-store";
import { cn } from "@/lib/utils";

/**
 * Contextual selection bar.
 *
 * Appears in place of the page-level action row once anything is selected, so
 * the actions on offer always match the thing being acted on. It announces the
 * count politely, and every action reports honestly that the backend isn't
 * connected rather than silently doing nothing.
 */
export function SelectionBar({ onAction }: { onAction: (action: string) => void }) {
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
        <ToolbarButton icon={Download} label="Download" onClick={() => onAction("download")} />
        <ToolbarButton icon={Star} label="Star" onClick={() => onAction("star")} />
        <ToolbarButton icon={Share2} label="Share" onClick={() => onAction("share")} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-primary/20" />
        <ToolbarButton icon={Trash2} label="Delete" destructive onClick={() => onAction("trash")} />
      </div>
    </div>
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
        destructive
          ? "text-[#C93B2B] hover:bg-[#FDF3F2]"
          : "text-primary-ink hover:bg-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

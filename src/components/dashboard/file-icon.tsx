import * as React from "react";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { CATEGORY_TINT } from "@/lib/drive/format";
import { folderColour, type FolderColour } from "@/lib/drive/folder-colour";
import type { FileCategory as Category } from "@/lib/drive/types";
import { cn } from "@/lib/utils";

/**
 * File type glyph.
 *
 * A tinted rounded square with a category icon — the same treatment the
 * marketing pages use for plan icons, so the dashboard doesn't introduce a
 * second icon language. Colour is a secondary signal only; the shape and the
 * label carry the meaning.
 */

const ICONS: Record<Category, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FileArchive,
  code: FileCode2,
  text: FileText,
  other: File,
};

export function FileTypeIcon({
  category,
  size = "md",
  className,
}: {
  category: Category;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const Icon = ICONS[category];
  const tint = CATEGORY_TINT[category];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" && "h-7 w-7 rounded-md",
        size === "md" && "h-9 w-9",
        size === "lg" && "h-12 w-12 rounded-xl",
        size === "xl" && "h-16 w-16 rounded-2xl",
        className,
      )}
      style={{ backgroundColor: tint.bg, color: tint.fg }}
      aria-hidden="true"
    >
      <Icon
        className={cn(
          size === "sm" && "h-3.5 w-3.5",
          size === "md" && "h-4 w-4",
          size === "lg" && "h-5 w-5",
          size === "xl" && "h-7 w-7",
        )}
        strokeWidth={1.9}
      />
    </span>
  );
}

/**
 * Folder glyph for the file manager.
 *
 * This is the marketing hero's folder, not an approximation of it: the same
 * silhouette as `FolderGlyph` (a rounded body with a raised tab and a single white
 * highlight across the fold), the same duotone gradient treatment, and the same
 * palette — imported from `folder-colour`, which is the one definition the
 * marketing mockups and the dashboard now share.
 *
 * Two things changed from the previous version, and both were wrong before:
 *
 *   1. It sat on a `#EAF1FF` plate. A tinted square behind a folder glyph makes the
 *      folder look like a file type badge; the hero art has no plate, and neither
 *      does this now.
 *   2. Every folder was `#3178FB`. A list of identical blue folders is unreadable at
 *      a glance — you find a folder by reading its name instead of recognising it.
 *      The colour is now derived from the folder's id, so folders differ, and each
 *      one keeps its colour forever.
 */
export function FolderIcon({
  size = "md",
  className,
  colour,
  id,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  className?: string;
  /** Explicit colour pair; otherwise derived from `id`. */
  colour?: FolderColour;
  /** Folder id — the colour is stable for a given id. */
  id?: string;
}) {
  const pair = colour ?? folderColour(id ?? "orindle");

  // Unique per instance, and stable across renders: duplicate SVG gradient ids
  // make every folder paint with whichever one registered first, and a value that
  // changed on re-render would remount the gradient on every repaint.
  const gradientId = `folder-${React.useId().replace(/:/g, "")}`;
  const iconSize = cn(
    size === "sm" && "h-4 w-[18px]",
    size === "md" && "h-[21px] w-6",
    size === "lg" && "h-7 w-8",
    size === "xl" && "h-10 w-11",
    // The folder-tile glyph. Sized against the landscape plate it sits in: roughly
    // 55% of the card's width, which fills the frame without touching the edges.
    size === "xxl" && "h-[58px] w-[70px]",
  );

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", className)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 40" className={iconSize}>
        <defs>
          <linearGradient id={gradientId} x1="6" y1="4" x2="40" y2="38" gradientUnits="userSpaceOnUse">
            <stop stopColor={pair.from} />
            <stop offset="1" stopColor={pair.to} />
          </linearGradient>
        </defs>

        {/* Back tab, lighter — the raised edge that reads as a folder and not a card. */}
        <path
          d="M7.2 6.4h9.6c.9 0 1.8.36 2.4 1l1.7 1.7c.4.4 1 .63 1.6.63h10.3c2.1 0 3.8 1.7 3.8 3.8v2.1H4.9V9.7c0-1.8 1-3.3 2.3-3.3Z"
          fill={pair.from}
          fillOpacity="0.55"
        />

        {/* Body */}
        <path
          d="M4.5 11.2c0-2 1.6-3.6 3.6-3.6h8.1c1 0 1.9.4 2.6 1.1l2 2.1c.5.5 1.2.8 1.9.8h13.2c2 0 3.6 1.6 3.6 3.6v17c0 2-1.6 3.6-3.6 3.6H8.1c-2 0-3.6-1.6-3.6-3.6v-21Z"
          fill={`url(#${gradientId})`}
        />

        {/* Fold line and tab highlight — the two strokes the hero art carries. */}
        <path d="M4.5 15.6h39" stroke="rgba(255,255,255,.42)" strokeWidth="1.1" strokeLinecap="round" />
        <path
          d="M8.1 7.6h8.1c1 0 1.9.4 2.6 1.1l2 2.1"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

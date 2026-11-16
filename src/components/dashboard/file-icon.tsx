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
 * Deliberately shares the silhouette of `FolderGlyph` used in the marketing
 * mockups so a folder looks like a folder everywhere in the product, but flat
 * rather than gradient-filled: at 16px in a list row, a gradient reads as noise.
 */
export function FolderIcon({
  size = "md",
  className,
  filled = true,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  filled?: boolean;
}) {
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
      style={{ backgroundColor: filled ? "#EAF1FF" : "transparent", color: "#3178FB" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={cn(
          size === "sm" && "h-4 w-4",
          size === "md" && "h-[18px] w-[18px]",
          size === "lg" && "h-6 w-6",
          size === "xl" && "h-8 w-8",
        )}
      >
        <path
          d="M3 7.4c0-1.1.9-2 2-2h3.6c.6 0 1.1.25 1.5.7l1 1.2h7.9c1.1 0 2 .9 2 2v7.3c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7.4Z"
          fill="currentColor"
          fillOpacity="0.16"
        />
        <path
          d="M3 8.1c0-1.1.9-2 2-2h3.3c.55 0 1.07.23 1.45.63l1.06 1.12h7.19c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V8.1Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

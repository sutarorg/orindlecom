/**
 * Display formatting for the dashboard.
 *
 * One implementation so a size or a date reads identically in the grid, the
 * list, the preview panel and the trash. These are pure functions with no
 * locale guessing — the formats below are the ones the design specifies.
 */

import type { FileCategory } from "./types";

/**
 * Storage units are decimal: 1 KB = 1,000 bytes, 1 GB = 1,000,000,000 bytes.
 *
 * This is a product decision, not an implementation detail. A plan sold as
 * "10 GB" means ten billion bytes. Jumping to binary units here would make a
 * 10 GB allowance fill up at 9.31 "GB" of displayed usage, which is exactly the
 * kind of quiet shrinkflation that makes people distrust a storage product.
 *
 * Cloudflare R2 also meters in decimal GB, so the number the customer sees, the
 * number the database stores, and the number on the invoice agree. Binary units
 * (GiB = 1024^3) are never displayed anywhere in the product.
 */
const KB = 1000;
const MB = KB * 1000;
const GB = MB * 1000;
const TB = GB * 1000;

/** Human byte size, decimal units. See the note above for why. */
export function formatBytes(bytes: number | null, { decimals }: { decimals?: number } = {}): string {
  if (bytes == null) return "—";
  if (bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  if (bytes < KB) return `${bytes} B`;

  const [value, unit] =
    bytes < MB
      ? [bytes / KB, "KB"]
      : bytes < GB
        ? [bytes / MB, "MB"]
        : bytes < TB
          ? [bytes / GB, "GB"]
          : [bytes / TB, "TB"];

  // One decimal below 10 (1.4 MB), none above (24 MB) — keeps the column tidy
  // without pretending to a precision storage doesn't have.
  const places = decimals ?? (value < 10 ? 1 : 0);
  // A non-breaking space keeps "0 B" and "10 GB" from breaking across lines and
  // — critically — survives the flex/grid text nodes that were collapsing a
  // plain space into nothing beside a bold neighbour.
  return `${value.toFixed(places)}\u00A0${unit}`;
}

/** Compact size for tight spaces: 1.4M, 240K. */
export function formatBytesCompact(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)}K`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)}M`;
  return `${(bytes / GB).toFixed(1)}G`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Absolute date, in the dashboard's fixed format: "12 Nov 2026".
 *
 * Rendered from a fixed list rather than `toLocaleDateString`, because the
 * server and the visitor's browser can disagree about locale and produce a
 * hydration mismatch on the first paint.
 */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "12 Nov 2026, 14:05" — for preview panels and detail rows. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(iso)}, ${hh}:${mm}`;
}

/**
 * Relative time: "just now", "4 min ago", "3 days ago".
 *
 * Takes `now` explicitly so callers can render deterministically (and so tests
 * don't depend on the clock).
 */
export function formatRelative(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";

  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

/** Days remaining until a trash item is purged. Null when not trashed. */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const ms = then.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/* ------------------------------------------------------------------ */
/*  File type presentation                                             */
/* ------------------------------------------------------------------ */

export const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  pdf: "PDF",
  document: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  archive: "Archive",
  code: "Code",
  text: "Text",
  other: "File",
};

/**
 * Colour per category.
 *
 * These are the six plan accents plus neutrals, so the file manager reads as
 * part of the same palette rather than a second colour system. Used only on
 * icon chips — never as a large fill.
 */
export const CATEGORY_TINT: Record<FileCategory, { fg: string; bg: string }> = {
  image: { fg: "#8B5CF6", bg: "#F2EDFE" },
  video: { fg: "#FB5F8A", bg: "#FEEDF2" },
  audio: { fg: "#F9A53B", bg: "#FEF4E7" },
  pdf: { fg: "#E0533D", bg: "#FDEDEA" },
  document: { fg: "#3178FB", bg: "#EAF1FF" },
  spreadsheet: { fg: "#34C77B", bg: "#E9F8F1" },
  presentation: { fg: "#F9A53B", bg: "#FEF4E7" },
  archive: { fg: "#6A6F8B", bg: "#F1F3F9" },
  code: { fg: "#3178FB", bg: "#EAF1FF" },
  text: { fg: "#6A6F8B", bg: "#F1F3F9" },
  other: { fg: "#8B90A8", bg: "#F4F6FB" },
};

/**
 * Maps a MIME type to a category.
 *
 * Used to label records the backend returns. Falls back to the extension
 * because some providers report `application/octet-stream` for everything.
 */
export function categorize(mimeType: string | null, name: string): FileCategory {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheetml") || mime.includes("ms-excel") || mime.includes("csv")) return "spreadsheet";
  if (mime.includes("presentationml") || mime.includes("ms-powerpoint")) return "presentation";
  if (mime.includes("wordprocessingml") || mime.includes("msword") || mime.includes("rtf")) return "document";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar") || mime.includes("7z") || mime.includes("gzip")) return "archive";
  if (mime.startsWith("text/")) {
    if (mime.includes("html") || mime.includes("css") || mime.includes("javascript") || mime.includes("json") || mime.includes("xml")) return "code";
    return "text";
  }

  const ext = extensionOf(name);
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".heic"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".webm", ".mkv", ".avi"].includes(ext)) return "video";
  if ([".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"].includes(ext)) return "audio";
  if (ext === ".pdf") return "pdf";
  if ([".doc", ".docx", ".odt", ".rtf", ".pages"].includes(ext)) return "document";
  if ([".xls", ".xlsx", ".csv", ".ods", ".numbers"].includes(ext)) return "spreadsheet";
  if ([".ppt", ".pptx", ".odp", ".key"].includes(ext)) return "presentation";
  if ([".zip", ".tar", ".gz", ".rar", ".7z"].includes(ext)) return "archive";
  if ([".js", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".css", ".html", ".json", ".yml", ".yaml", ".toml", ".sh", ".sql"].includes(ext)) return "code";
  if ([".txt", ".md", ".log"].includes(ext)) return "text";
  return "other";
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index).toLowerCase();
}

/** Strips the extension, for the second line of a tile. */
export function baseName(name: string): string {
  const ext = extensionOf(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/**
 * Usage percentage.
 *
 * A 500 GB plan with 297 MB used is 0.06% — rounding that to "0%" next to a
 * progress bar that visibly has nothing in it is fine, but rounding it next to
 * a bar that *does* have a sliver is worse than saying "<1%". Below one percent
 * the figure is shown to one decimal, and a non-zero amount never reads as
 * zero.
 */
export function formatPercent(used: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = (used / total) * 100;
  if (pct === 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  if (pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

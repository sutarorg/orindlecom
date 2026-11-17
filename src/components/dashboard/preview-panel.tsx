"use client";

import * as React from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileQuestion,
  Loader2,
  Share2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/drive/client";
import { CATEGORY_LABEL, formatBytes, formatDateTime, extensionOf } from "@/lib/drive/format";
import type { DriveItem } from "@/lib/drive/types";
import { FileTypeIcon } from "./file-icon";
import { cn } from "@/lib/utils";

/**
 * Everything with a preview.
 *
 * Archives are on the list because a zip *can* be previewed sensibly — not by
 * unpacking it, but by showing what is inside, which is exactly what you want to
 * know before downloading one. Everything else here renders natively.
 */
const PREVIEWABLE = new Set<DriveItem["category"]>([
  "image",
  "video",
  "audio",
  "pdf",
  "text",
  "code",
  "archive",
]);

/**
 * Preview panel.
 *
 * A side panel on desktop (so the file list stays visible and arrow keys can
 * step through it), a full-screen sheet on mobile.
 *
 * Fetches short-lived signed URLs from `POST /api/download/:id` with
 * `disposition: "inline"` for previewable files and `disposition: "attachment"`
 * when downloading.
 */
export function PreviewPanel({
  item,
  siblings,
  onClose,
  onNavigate,
  onShare,
}: {
  item: DriveItem | null;
  siblings: DriveItem[];
  onClose: () => void;
  onNavigate: (id: string) => void;
  onShare: (item: DriveItem) => void;
}) {
  const { toast } = useToast();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);

  const index = item ? siblings.findIndex((candidate) => candidate.id === item.id) : -1;
  const previous = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  React.useEffect(() => {
    if (!item) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight" && next) {
        onNavigate(next.id);
      } else if (event.key === "ArrowLeft" && previous) {
        onNavigate(previous.id);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [item, next, previous, onClose, onNavigate]);

  React.useEffect(() => {
    if (!item) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    if (window.innerWidth < 1024) body.style.overflow = "hidden";
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [item]);

  if (!item) return null;

  const downloadFile = async () => {
    setDownloading(true);
    const result = await api.post<{ url: string; expiresAt: string }>(
      `/api/download/${encodeURIComponent(item.id)}`,
      { disposition: "attachment" },
    );
    setDownloading(false);

    if (!result.ok) {
      toast({ tone: "error", title: "Download unavailable", description: result.message });
      return;
    }

    const link = document.createElement("a");
    link.href = result.data.url;
    link.download = item.name;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[140] bg-[rgba(14,20,48,0.42)] motion-safe:animate-[fadeIn_140ms_ease-out] lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={false}
        aria-label={`Preview of ${item.name}`}
        className={cn(
          "fixed inset-0 z-[145] flex flex-col bg-white focus:outline-none",
          "motion-safe:animate-[sheetUp_180ms_cubic-bezier(0.22,0.68,0.28,1)]",
          "lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:border-[var(--brand-border)] lg:shadow-[-16px_0_40px_-24px_rgba(23,29,58,0.28)] lg:motion-safe:animate-[fadeIn_160ms_ease-out]",
        )}
      >
        <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-[var(--brand-border-soft)] px-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => previous && onNavigate(previous.id)}
              disabled={!previous}
              aria-label="Previous file"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => next && onNavigate(next.id)}
              disabled={!next}
              aria-label="Next file"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-ink" title={item.name}>
              {item.name}
            </p>
            <p className="text-[10.5px] text-text-subtle">
              {index + 1} of {siblings.length}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onShare(item)}
            aria-label="Share"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Share2 className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        {/* Stage */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[var(--brand-canvas)] p-4">
          <PreviewStage item={item} />
        </div>

        {/* Details */}
        <div className="shrink-0 border-t border-[var(--brand-border-soft)] px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
            <div>
              <dt className="text-text-subtle">Type</dt>
              <dd className="font-medium text-ink">
                {CATEGORY_LABEL[item.category]}
                {extensionOf(item.name) && (
                  <span className="ml-1 text-text-subtle">{extensionOf(item.name)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-text-subtle">Size</dt>
              <dd className="font-medium tabular-nums text-ink">{formatBytes(item.size)}</dd>
            </div>
            <div>
              <dt className="text-text-subtle">Modified</dt>
              <dd className="font-medium text-ink">{formatDateTime(item.modifiedAt)}</dd>
            </div>
            <div>
              <dt className="text-text-subtle">Owner</dt>
              <dd className="truncate font-medium text-ink">
                {item.owned ? "You" : item.ownerName ?? "Shared with you"}
              </dd>
            </div>
          </dl>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void downloadFile()}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-55"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              )}
              {downloading ? "Preparing…" : "Download"}
            </button>
            <button
              type="button"
              onClick={() => onShare(item)}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
              Share
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/**
 * What is inside an archive.
 *
 * Reads the central directory only — the index at the end of the file — so a 2 GB
 * zip lists in the time it takes to fetch its tail, and nothing is inflated. This
 * is a listing, not an extraction: opening an archive to *browse* it is a different
 * feature, and pretending otherwise would mean unpacking untrusted files on a
 * server for a preview.
 *
 * ZIP only. RAR, 7z and tar are recognised and honestly reported as unlistable in
 * the browser rather than shown as an empty box.
 */
interface ArchiveEntry {
  name: string;
  size: number;
  directory: boolean;
}

function readArchiveIndex(buffer: Uint8Array): ArchiveEntry[] | null {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const findEocd = () => {
    const earliest = Math.max(0, buffer.length - 0xffff - 22);
    for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  };

  const eocd = findEocd();
  if (eocd < 0) return null;

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ArchiveEntry[] = [];

  for (let i = 0; i < count && entries.length < 500; i += 1) {
    if (offset + 46 > buffer.length) break;
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const name = new TextDecoder().decode(buffer.subarray(offset + 46, offset + 46 + nameLength));

    if (name) {
      entries.push({ name, size: uncompressed, directory: name.endsWith("/") });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function ArchiveStage({ entries, name }: { entries: ArchiveEntry[] | null; name: string }) {
  if (entries === null) {
    return (
      <div className="flex flex-col items-center px-6 text-center">
        <Archive className="h-9 w-9 text-text-subtle" strokeWidth={1.6} aria-hidden />
        <p className="mt-3 text-[13px] font-semibold text-ink">Archive contents</p>
        <p className="mt-1.5 max-w-[300px] text-[12px] leading-relaxed text-text-muted">
          This archive&apos;s index can&apos;t be read in the browser. Download {name} to open it —
          it is unchanged and complete.
        </p>
      </div>
    );
  }

  const files = entries.filter((entry) => !entry.directory);

  return (
    <div className="flex h-full w-full flex-col rounded-lg bg-white">
      <div className="flex items-center justify-between border-b border-[var(--brand-border-soft)] px-3 py-2">
        <span className="text-[11.5px] font-semibold text-ink">
          {files.length} {files.length === 1 ? "file" : "files"}
        </span>
        <span className="text-[10.5px] text-text-subtle">
          {formatBytes(files.reduce((sum, entry) => sum + entry.size, 0))} uncompressed
        </span>
      </div>
      {files.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-text-subtle">This archive has no files in it.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto py-1">
          {files.map((entry) => (
            <li
              key={entry.name}
              className="flex items-center gap-2 px-3 py-1 text-[11.5px] text-text"
            >
              <File className="h-3 w-3 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden />
              <span className="truncate" title={entry.name}>
                {entry.name}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-[10.5px] text-text-subtle">
                {formatBytes(entry.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewStage({ item }: { item: DriveItem }) {
  const canPreview = PREVIEWABLE.has(item.category);
  const [source, setSource] = React.useState<string | null>(null);
  const [textBody, setTextBody] = React.useState<string | null>(null);
  const [archiveEntries, setArchiveEntries] = React.useState<ArchiveEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setSource(null);
    setTextBody(null);
    setArchiveEntries(null);
    setErrorMessage(null);

    if (!canPreview) return;

    setLoading(true);
    void (async () => {
      const result = await api.post<{ url: string; expiresAt: string }>(
        `/api/download/${encodeURIComponent(item.id)}`,
        { disposition: "inline" },
      );

      if (!active) return;

      if (!result.ok) {
        setLoading(false);
        setErrorMessage(result.message);
        return;
      }

      const url = result.data.url;
      setSource(url);

      if (item.category === "text" || item.category === "code") {
        try {
          const response = await fetch(url);
          if (active && response.ok) {
            const raw = await response.text();
            setTextBody(raw.slice(0, 262_144));
          }
        } catch {
          if (active) setErrorMessage("Could not load text preview. Download the file instead.");
        }
      }

      /*
       * An archive is fetched as bytes and listed, not unpacked. Listing is done
       * here rather than server-side because the signed URL is already in hand and
       * the central directory is at the end of the file — one range-ish read, no
       * extra request, and nothing is ever written to disk.
       */
      if (item.category === "archive") {
        try {
          const response = await fetch(url);
          if (active && response.ok) {
            const buffer = new Uint8Array(await response.arrayBuffer());
            setArchiveEntries(readArchiveIndex(buffer));
          }
        } catch {
          if (active) setErrorMessage("Could not read the archive listing. Download it to open it.");
        }
      }

      if (active) setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [item.id, item.category, canPreview]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 text-center text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin text-primary" strokeWidth={2} aria-hidden="true" />
        <p className="text-[12px]">Loading preview…</p>
      </div>
    );
  }

  if (!canPreview || !source) {
    const unsupported = !canPreview;

    return (
      <div className="flex flex-col items-center px-6 text-center">
        <div className="relative">
          <FileTypeIcon category={item.category} size="xl" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-ink">
          {unsupported ? "No preview for this format" : `${CATEGORY_LABEL[item.category]} preview`}
        </p>
        <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-text-muted">
          {unsupported
            ? "This file type can't be rendered in a browser. Download it to open it in the app that made it."
            : errorMessage ??
              "Previews appear here once storage is connected. Nothing has been edited or removed."}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-border)] bg-white px-2.5 py-1 text-[10.5px] font-medium text-text-subtle">
          <FileQuestion className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          {formatBytes(item.size)}
        </span>
      </div>
    );
  }

  switch (item.category) {
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={source}
          alt={item.name}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      );
    case "video":
      return <video src={source} controls className="max-h-full max-w-full rounded-lg" />;
    case "audio":
      return <audio src={source} controls className="w-full" />;
    case "pdf":
      return <iframe src={source} title={item.name} className="h-full w-full rounded-lg border-0" />;
    case "archive":
      return <ArchiveStage entries={archiveEntries} name={item.name} />;
    case "text":
    case "code":
      return (
        <pre className="h-full w-full overflow-auto rounded-lg bg-white p-3 font-mono text-[11.5px] leading-relaxed text-text">
          {textBody ?? ""}
        </pre>
      );
    default:
      return null;
  }
}

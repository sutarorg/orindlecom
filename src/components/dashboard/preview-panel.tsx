"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
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

const PREVIEWABLE = new Set<DriveItem["category"]>([
  "image",
  "video",
  "audio",
  "pdf",
  "text",
  "code",
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

function PreviewStage({ item }: { item: DriveItem }) {
  const canPreview = PREVIEWABLE.has(item.category);
  const [source, setSource] = React.useState<string | null>(null);
  const [textBody, setTextBody] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setSource(null);
    setTextBody(null);
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

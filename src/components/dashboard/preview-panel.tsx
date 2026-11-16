"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileQuestion,
  Share2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_LABEL, formatBytes, formatDateTime, extensionOf } from "@/lib/drive/format";
import { NOT_CONNECTED_MESSAGE } from "@/lib/drive/repository";
import type { DriveItem } from "@/lib/drive/types";
import { FileTypeIcon } from "./file-icon";
import { cn } from "@/lib/utils";

/**
 * Preview panel.
 *
 * A side panel on desktop (so the file list stays visible and arrow keys can
 * step through it), a full-screen sheet on mobile.
 *
 * The preview renderer is chosen by category, and every branch handles the case
 * where there is no URL — which is the case today, because no storage is
 * connected. Rendering a broken `<img src={undefined}>` would be worse than
 * saying plainly that there's nothing to preview yet.
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
    // Only lock scroll on mobile where the panel is full-screen.
    if (window.innerWidth < 1024) body.style.overflow = "hidden";
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [item]);

  if (!item) return null;

  const notConnected = () =>
    toast({ tone: "error", title: "Not available yet", description: NOT_CONNECTED_MESSAGE });

  return (
    <>
      {/* Scrim, mobile only. */}
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
          // Desktop: a right-hand panel that doesn't cover the list.
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
              onClick={notConnected}
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
              Download
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
 * The preview renderer.
 *
 * Every branch has a "no source" path, because a `DriveItem` can exist without
 * a fetchable URL (signed links expire, storage may not be attached). The
 * unsupported-format state is a designed outcome, not a fallback.
 */
function PreviewStage({ item }: { item: DriveItem }) {
  // A real implementation reads `item.previewUrl` here — absent from the
  // contract until the storage backend provides one.
  const source: string | null = null;

  if (!source) {
    const unsupported = item.category === "archive" || item.category === "other";

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
            : "Previews appear here once storage is connected. Nothing has been edited or removed."}
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
      return <img src={source} alt={item.name} className="max-h-full max-w-full rounded-lg object-contain" />;
    case "video":
      return <video src={source} controls className="max-h-full max-w-full rounded-lg" />;
    case "audio":
      return <audio src={source} controls className="w-full" />;
    case "pdf":
      return <iframe src={source} title={item.name} className="h-full w-full rounded-lg border-0" />;
    case "text":
    case "code":
      return (
        <pre className="h-full w-full overflow-auto rounded-lg bg-white p-3 text-[11.5px] leading-relaxed text-text">
          {/* Populated by the real fetch; a text file can't be previewed from a
              record alone. */}
          {""}
        </pre>
      );
    default:
      return null;
  }
}

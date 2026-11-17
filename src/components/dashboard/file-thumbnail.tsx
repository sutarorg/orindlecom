"use client";

import * as React from "react";
import { FileText, Loader2, Play, Archive, FileQuestion } from "lucide-react";
import { api } from "@/lib/drive/client";
import type { DriveItem } from "@/lib/drive/types";
import { CATEGORY_TINT, extensionOf } from "@/lib/drive/format";
import { FileTypeIcon } from "./file-icon";
import { cn } from "@/lib/utils";

/**
 * The landscape plate on a grid tile.
 *
 * Square, and filled with the best thing available for the file rather than an
 * icon standing in for all of them:
 *
 *   image        — the image, cropped to fill.
 *   video        — a frame from the file itself (`#t` seeks the browser to a
 *                  moment, and `preload="metadata"` means only enough data arrives
 *                  to paint that frame), with a play affordance over it.
 *   pdf          — the document itself in a non-interactive frame, showing page one.
 *   doc/xls/ppt  — the opening text, extracted server-side, over a paper-textured
 *                  plate tinted by type. No browser can lay out these formats, and
 *                  a page raster would need a renderer this app will not ship, so
 *                  the honest preview is the words on page one.
 *   text/code    — the first lines, monospaced.
 *   archive      — the kind of archive, big, because "is this a zip or a rar" is
 *                  the only question a tile can answer about one.
 *   anything else— the type icon.
 *
 * Everything is lazy and cancellable. A grid of two hundred tiles must not issue
 * two hundred signed-URL requests on mount, and a tile that scrolls out of view
 * before its request returns must not keep the pixels.
 */

interface Thumb {
  kind: "redirect" | "text" | "icon";
  url?: string;
  text?: string;
  category?: string;
}

/** Requests are shared per file id, so the grid and the list do not double up. */
const cache = new Map<string, Promise<Thumb | null>>();

function loadThumb(id: string): Promise<Thumb | null> {
  const existing = cache.get(id);
  if (existing) return existing;

  const promise = api
    .get<Thumb>(`/api/thumbnails/${encodeURIComponent(id)}`)
    .then((result) => (result.ok ? result.data : null))
    .catch(() => null);

  cache.set(id, promise);
  return promise;
}

export function FileThumbnail({ item, className }: { item: DriveItem; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [thumb, setThumb] = React.useState<Thumb | null>(null);
  const [settled, setSettled] = React.useState(false);

  // Only fetch once the tile is actually on screen.
  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    let active = true;
    void loadThumb(item.id).then((result) => {
      if (!active) return;
      setThumb(result);
      setSettled(true);
    });
    return () => {
      active = false;
    };
  }, [visible, item.id]);

  const tint = CATEGORY_TINT[item.category];

  return (
    <div
      ref={ref}
      /*
       * Landscape, 16:10 — the same plate a folder card uses.
       *
       * It was `aspect-square`. A grid that holds both files and folders then had two
       * card heights in it, so rows stepped wherever the two kinds met, and a square
       * crop threw away the sides of every screenshot and landscape photo to fill the
       * top and bottom with background. Matching the folder card means one consistent
       * row height and a crop that keeps more of the picture.
       */
      className={cn(
        "relative aspect-[16/10] w-full overflow-hidden rounded-lg",
        className,
      )}
      style={{ backgroundColor: tint.bg }}
    >
      {!settled && visible && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-text-subtle" strokeWidth={2} aria-hidden />
        </span>
      )}

      {thumb?.kind === "redirect" && thumb.url ? (
        <DirectPreview item={item} url={thumb.url} />
      ) : thumb?.kind === "text" && thumb.text ? (
        <TextPlate text={thumb.text} category={item.category} />
      ) : (
        settled && <IconPlate item={item} />
      )}
    </div>
  );
}

function DirectPreview({ item, url }: { item: DriveItem; url: string }) {
  if (item.category === "image") {
    /*
     * The tile asks for a thumbnail, not the original.
     *
     * `url` here is the full-size object. Rendering it meant downloading and decoding
     * megabytes to paint a 200-pixel square — the reason a folder of photos took
     * seconds to show. `/api/thumbnails/:id/image` downscales server-side to a square
     * WebP that matches this tile exactly, and the browser caches it for a year. The
     * original URL is still used by the preview panel, where full size is the point.
     */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/thumbnails/${encodeURIComponent(item.id)}/image`}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }

  if (item.category === "video") {
    return <VideoFrame url={url} />;
  }

  // PDF: page one, non-interactive so the tile opens the preview rather than
  // trapping the click inside an embedded viewer.
  return (
    <iframe
      src={`${url}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
      title=""
      aria-hidden="true"
      tabIndex={-1}
      loading="lazy"
      className="pointer-events-none h-full w-full border-0 bg-white"
    />
  );
}

/**
 * A frame from the video, and a play affordance over it.
 *
 * A `#t=` fragment in the URL is not enough: Chrome shows a black or empty tile
 * unless the element actually seeks, and `preload="metadata"` alone often renders
 * nothing at all. So the seek is explicit — set `currentTime` once the metadata
 * arrives, which makes every browser paint that frame.
 *
 * Half a second rather than zero, because the first frame of most encodes is black
 * or a fade-in. `preload="metadata"` keeps the request to the container header
 * rather than downloading the file, so a grid of videos does not pull gigabytes.
 * `pointer-events-none` means the tile's click still opens the preview instead of
 * being swallowed by a player.
 */
function VideoFrame({ url }: { url: string }) {
  const [ready, setReady] = React.useState(false);

  return (
    <>
      <video
        src={url}
        preload="metadata"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          // A source shorter than half a second would clamp; that is fine.
          try {
            if (Number.isFinite(video.duration) && video.duration > 0.5) video.currentTime = 0.5;
          } catch {
            // Seeking is best-effort; the poster frame is an acceptable fallback.
          }
        }}
        onSeeked={() => setReady(true)}
        className={cn(
          "pointer-events-none h-full w-full object-cover transition-opacity",
          ready ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 backdrop-blur-[2px]">
          <Play className="ml-0.5 h-3.5 w-3.5 fill-white text-white" aria-hidden="true" />
        </span>
      </span>
    </>
  );
}

/**
 * Text extracted from a format with no browser renderer.
 *
 * Rendered as small text on paper rather than as a fake page image: it is a sample
 * of the real content, and dressing it up as a document thumbnail would be a
 * promise about fidelity this does not make.
 */
function TextPlate({ text, category }: { text: string; category: string }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      {/* A paper header, so the plate reads as a document at tile size. */}
      <div className="flex items-center gap-1 border-b border-[var(--brand-border-soft)] px-2 py-1.5">
        <FileText className="h-2.5 w-2.5 shrink-0 text-text-subtle" strokeWidth={2.2} aria-hidden />
        <span className="text-[8px] font-semibold uppercase tracking-wide text-text-subtle">
          {category === "spreadsheet" ? "Sheet" : category === "presentation" ? "Slides" : "Document"}
        </span>
      </div>
      <p
        className={cn(
          "min-h-0 flex-1 overflow-hidden px-2 py-1.5 text-[7.5px] leading-[1.45] text-text",
          (category === "text" || category === "code") && "font-mono",
        )}
      >
        {text}
      </p>
    </div>
  );
}

function IconPlate({ item }: { item: DriveItem }) {
  const extension = extensionOf(item.name)?.replace(/^\./, "").toUpperCase();

  if (item.category === "archive") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <Archive className="h-6 w-6" strokeWidth={1.7} style={{ color: CATEGORY_TINT.archive.fg }} aria-hidden />
        <span className="text-[9px] font-bold tracking-wide text-text-subtle">
          {extension || "ARCHIVE"}
        </span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
      <FileTypeIcon category={item.category} size="lg" className="bg-transparent" />
      {extension && (
        <span className="text-[9px] font-bold tracking-wide text-text-subtle">{extension}</span>
      )}
      {item.category === "other" && !extension && (
        <FileQuestion className="h-4 w-4 text-text-subtle" strokeWidth={1.8} aria-hidden />
      )}
    </div>
  );
}

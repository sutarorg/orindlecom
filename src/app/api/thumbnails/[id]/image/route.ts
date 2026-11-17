/**
 * GET /api/thumbnails/:id/image — the pixels a grid tile actually needs.
 *
 * Why this route exists. Tiles used to render the *original* object: a 6 MB phone
 * photo was downloaded in full, decoded at full resolution, and then CSS-cropped into
 * a 200-pixel square. Twenty of those is a hundred megabytes of transfer to fill one
 * screen, which is what "thumbnails are slow" looked like.
 *
 * This route fetches the original server-side once, downscales it to a square that
 * fits the widest tile the grid renders, and returns WebP. The client gets tens of
 * kilobytes instead of megabytes and the browser decodes a small image.
 *
 * Decisions worth stating:
 *
 *   - **Landscape, cover-cropped.** The tile is `aspect-[16/10]` with `object-cover`,
 *     so the crop here has to be the one the browser would otherwise do. Producing the
 *     final shape server-side means the CSS is no longer scaling or re-cropping
 *     anything — and a square here would be cropped a second time by a landscape tile,
 *     throwing away the sides of every screenshot after already having thrown away
 *     both ends.
 *   - **WebP, quality 72.** Visually indistinguishable at tile size, and roughly half
 *     the bytes of JPEG at the same quality.
 *   - **Cached hard.** The bytes for a given object version never change, so the
 *     response is immutable for a year and carries a strong ETag. A grid scrolled
 *     twice costs nothing the second time.
 *   - **Authorisation is not optional.** The repository read happens through the
 *     caller's own client first, so RLS decides who may see the row; the signed URL
 *     is minted from the same path as a download. A 404 for a file the caller cannot
 *     read, never a thumbnail of it.
 *   - **Bounded.** A source larger than the cap is not fetched at all; the caller is
 *     told to fall back to the type icon rather than being made to wait.
 */

import "server-only";

import { NextResponse } from "next/server";
import { enforceRateLimit, handle, requireUuid, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import { isStorageConfigured } from "@/lib/r2/client";

export const runtime = "nodejs";

/**
 * The plate's shape, and the widest a grid tile gets.
 *
 * The grid is at most five columns inside a 1180px content column, so a tile is
 * ~215 CSS pixels wide and — at the 16:10 plate ratio — ~134 tall. At 2× device pixel
 * ratio that is 430. 480 keeps a little headroom without inflating the bytes: the
 * difference at 2× is not visible after WebP, and this stays in the tens of kilobytes.
 */
const TILE_W = 480;
const TILE_H = 300;

/** Quality for the WebP. 72 is where artefacts stop being visible at tile size. */
const TILE_QUALITY = 72;

/** Hard cap on the source we are willing to download to build a thumbnail. */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("thumbnail.image", auth.actor.userId),
      // Generous: a grid of sixty tiles issues sixty of these. The limit exists to
      // bound a bytes-fetching endpoint, not to ration normal use.
      LIMITS.download,
    );
    if (limited) return limited;

    const { id } = await params;
    requireUuid({ id }, "id");

    const repo = getDriveRepository();

    // Visibility first. If this fails the answer is 404 — not a thumbnail of a file
    // the caller may not see.
    const meta = await repo.get(id);
    if (!meta.ok) throw new AppError("not_found", meta.message);

    const item = meta.data;
    if (item.kind !== "file" || item.category !== "image") {
      throw new AppError("not_found", "That file has no image preview.");
    }

    if ((item.size ?? 0) > MAX_SOURCE_BYTES) {
      throw new AppError("validation_failed", "That image is too large to preview.");
    }

    if (!isStorageConfigured()) {
      throw new AppError("not_configured", "Storage isn't connected.");
    }

    const signed = await repo.downloadUrl({ id, disposition: "inline" });
    if (!signed.ok) throw new AppError("unknown", "That preview couldn't be prepared.");

    let source: Buffer;
    try {
      const response = await fetch(signed.data.url, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      source = Buffer.from(await response.arrayBuffer());
    } catch {
      throw new AppError("unknown", "That preview couldn't be loaded.");
    }

    /*
     * `sharp` ships with Next, so this adds no dependency. It is imported lazily
     * because the module is only needed on this route, and a cold path that never
     * renders an image should not pay for it.
     */
    const { default: sharp } = await import("sharp");

    let output: Buffer;
    try {
      output = await sharp(source, { failOn: "none" })
        // `cover` with a centre gravity is exactly what `object-cover` does in CSS,
        // so the server's crop and the browser's would agree — and now the browser is
        // not doing one at all.
        .resize(TILE_W, TILE_H, { fit: "cover", position: "centre", withoutEnlargement: true })
        .webp({ quality: TILE_QUALITY, effort: 4 })
        // Metadata is stripped: EXIF can carry GPS coordinates, and a thumbnail is
        // not a place to republish somebody's location.
        .toBuffer();
    } catch {
      throw new AppError("unknown", "That preview couldn't be rendered.");
    }

    /*
     * A strong ETag from the row's own modification time and size: the bytes for a
     * given version are stable, and a re-upload changes both. `immutable` tells the
     * browser not to revalidate at all within the year.
     */
    const etag = `"t-${id}-${item.modifiedAt}-${item.size ?? 0}"`;

    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(output.byteLength),
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
      },
    });
  });
}

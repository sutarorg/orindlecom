/**
 * GET /api/thumbnails/:id — what a grid tile should show for this file.
 *
 * Not an image endpoint. It answers "how do I draw this file" with one of three
 * shapes, because only some formats have bytes a browser can paint:
 *
 *   redirect — the object itself is displayable (image, video, PDF). The caller gets
 *              a short-lived signed URL and renders it directly.
 *   text     — the format has no browser renderer but its content is text (Word,
 *              Excel, PowerPoint, plain text, code). The opening is extracted here,
 *              so the tile can show a readable plate instead of a generic icon.
 *   icon     — nothing to show. Archives, audio, and anything whose bytes we cannot
 *              read honestly fall back to the type icon.
 *
 * Extraction happens server-side because it needs the object bytes, and because a
 * browser cannot inflate an OOXML package. The R2 object is never proxied to the
 * client: only a signed URL or a bounded string leaves this route.
 *
 * Nothing here bypasses authorisation. The repository reads the row through the
 * caller's own client, so RLS decides visibility, and the signed URL is minted from
 * the same path as a download.
 */

import "server-only";

import { enforceRateLimit, handle, ok, requireUuid, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import { documentText, plainTextOpening } from "@/lib/drive/document-text";

export const runtime = "nodejs";

/** Formats a browser paints itself once it has a URL. */
const DIRECT = new Set(["image", "video", "pdf"]);

/** Formats whose content is text we can extract for a plate. */
const TEXTUAL = new Set(["document", "spreadsheet", "presentation", "text", "code"]);

/** Hard cap on what we are willing to fetch to make a thumbnail. */
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

export type ThumbnailPayload =
  | { kind: "redirect"; url: string; expiresIn: number }
  | { kind: "text"; text: string }
  | { kind: "icon"; category: string };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    /*
     * Rate limited, but generously: a grid of sixty tiles issues sixty of these on
     * mount, and the limit has to sit above a big folder or the lower half of the
     * page would show nothing. It is not a security gate — `repo.get` is, and it
     * refuses anything the caller may not read — it is a bound on a per-item
     * endpoint that also fetches object bytes for documents.
     */
    const limited = await enforceRateLimit(
      userBucket("thumbnails", auth.actor.userId),
      LIMITS.download,
    );
    if (limited) return limited;

    const { id } = await params;
    // Validated before it reaches a query, so a malformed id is a 400 rather than a
    // database error that reads like the file exists but is private.
    requireUuid({ id }, "id");

    const repo = getDriveRepository();

    /*
     * Metadata first. If the caller cannot read the row, this stops here — the
     * answer is "not found" rather than a thumbnail of a file they may not see.
     */
    const meta = await repo.get(id);
    if (!meta.ok) throw new AppError("not_found", meta.message);

    const item = meta.data;

    if (item.kind === "folder") {
      return ok<ThumbnailPayload>({ kind: "icon", category: "folder" });
    }

    if (DIRECT.has(item.category)) {
      const signed = await repo.downloadUrl({ id, disposition: "inline" });
      if (!signed.ok) return ok<ThumbnailPayload>({ kind: "icon", category: item.category });
      return ok<ThumbnailPayload>({
        kind: "redirect",
        url: signed.data.url,
        expiresIn: signed.data.expiresIn,
      });
    }

    if (!TEXTUAL.has(item.category) || (item.size ?? 0) > MAX_SOURCE_BYTES) {
      return ok<ThumbnailPayload>({ kind: "icon", category: item.category });
    }

    /*
     * Fetch the bytes ourselves for a text plate. The signed URL is requested here
     * and not returned to the client, so the object is read once, server-side, and
     * only the extracted text leaves.
     */
    const signed = await repo.downloadUrl({ id, disposition: "inline" });
    if (!signed.ok) return ok<ThumbnailPayload>({ kind: "icon", category: item.category });

    try {
      const response = await fetch(signed.data.url, { cache: "no-store" });
      if (!response.ok) return ok<ThumbnailPayload>({ kind: "icon", category: item.category });

      const buffer = Buffer.from(await response.arrayBuffer());
      const text =
        item.category === "text" || item.category === "code"
          ? plainTextOpening(buffer)
          : documentText(buffer);

      if (!text) return ok<ThumbnailPayload>({ kind: "icon", category: item.category });
      return ok<ThumbnailPayload>({ kind: "text", text });
    } catch {
      // A preview is a nicety; failing to build one must never fail the page.
      return ok<ThumbnailPayload>({ kind: "icon", category: item.category });
    }
  });
}

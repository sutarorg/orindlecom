/**
 * GET /api/s/:token/content — what to draw for the file behind a public link.
 *
 * Same three-shape answer as the dashboard thumbnail route, but resolved through
 * the link rather than a session:
 *
 *   url  — a short-lived signed URL for a format the browser paints (image, video,
 *          audio, PDF). Null for everything else.
 *   text — the opening of a document or source file, extracted server-side.
 *   both null — nothing to draw; the page says so plainly.
 *
 * The link is resolved again here. Nothing the page already knows is trusted, and
 * the token is the only input — so a link revoked between page load and this call
 * stops serving content immediately.
 */

import "server-only";

import { enforceRateLimit, handle, ok } from "@/lib/api";
import { LIMITS, ipBucket } from "@/lib/rate-limit";
import { hashIp, resolveClientIp } from "@/lib/security/ip";
import { AppError } from "@/domain/auth/errors";
import { publicDocumentText, publicFileUrl, resolvePublicLink } from "@/lib/share/public-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Categories a browser renders directly from a URL. */
const DIRECT = new Set(["image", "video", "audio", "pdf"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handle(async () => {
    /*
     * Rate limited per address, and the limit is shared with viewing rather than
     * separate: a script cycling tokens to harvest content should hit one wall, not
     * get a fresh budget for each shape of request.
     */
    const limited = await enforceRateLimit(
      ipBucket("share.content", hashIp(resolveClientIp(request.headers).ip)),
      LIMITS.download,
    );
    if (limited) return limited;

    const { token } = await params;
    const item = await resolvePublicLink(token);
    if (!item) throw new AppError("not_found", "This link isn't available.");

    if (item.kind === "folder") {
      return ok({ url: null, text: null, previewable: false });
    }

    if (DIRECT.has(item.category)) {
      const signed = await publicFileUrl(item.id, "inline", item.mimeType);
      return ok({ url: signed?.url ?? null, text: null, previewable: Boolean(signed?.url) });
    }

    // Text-bearing formats: extracted, never proxied. The bytes do not leave the
    // server, so a shared document cannot deliver a payload to the visitor.
    const text = await publicDocumentText(item.id, item.category);
    return ok({ url: null, text, previewable: text !== null });
  });
}

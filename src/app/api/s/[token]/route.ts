/**
 * GET /api/s/:token — resolve a public share link.
 * POST /api/s/:token — a download or a comment through a public link.
 *
 * The anonymous surface for shared files. Every branch re-resolves the token rather
 * than trusting anything the client sends, because the token is the entire
 * authority here — there is no session to fall back on.
 *
 * Rate limited by IP. A public route with no session is the one place an attacker
 * can generate unbounded traffic without an account, so the limit is keyed on the
 * address rather than a user id.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { LIMITS, ipBucket } from "@/lib/rate-limit";
import { hashIp, resolveClientIp } from "@/lib/security/ip";
import { AppError } from "@/domain/auth/errors";
import { publicFileUrl, resolvePublicLink } from "@/lib/share/public-link";
import { getServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handle(async () => {
    const limited = await enforceRateLimit(ipBucket("share.view", hashIp(resolveClientIp(request.headers).ip)), LIMITS.download);
    if (limited) return limited;

    const { token } = await params;
    const item = await resolvePublicLink(token);
    if (!item) throw new AppError("not_found", "This link isn't available.");

    return ok(item);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handle(async () => {
    const { token } = await params;
    const body = await readJson(request);
    const action = body.action === "download" ? "download" : body.action === "comment" ? "comment" : null;

    if (!action) throw new AppError("validation_failed", "Unknown action.");

    const item = await resolvePublicLink(token);
    if (!item) throw new AppError("not_found", "This link isn't available.");

    if (action === "download") {
      const limited = await enforceRateLimit(ipBucket("share.download", hashIp(resolveClientIp(request.headers).ip)), LIMITS.download);
      if (limited) return limited;

      if (item.kind !== "file") {
        throw new AppError("validation_failed", "Folders are downloaded from the dashboard.");
      }

      const signed = await publicFileUrl(item.id, "attachment", item.mimeType);
      if (!signed) {
        throw new AppError("unknown", "We couldn't prepare that download. Nothing was changed.");
      }
      return ok({ url: signed.url, filename: signed.filename, expiresIn: signed.expiresIn });
    }

    /*
     * Commenting requires the link to grant it. A viewer link that accepted a
     * comment would be a permission escalation performed entirely by the client —
     * the check has to be here, on the resolved row, not on a UI that hid the box.
     */
    if (item.permission === "viewer") {
      throw new AppError("forbidden", "This link is view-only.");
    }

    const limited = await enforceRateLimit(ipBucket("share.comment", hashIp(resolveClientIp(request.headers).ip)), LIMITS.comment);
    if (limited) return limited;

    const message = typeof body.body === "string" ? body.body.trim() : "";
    const author = typeof body.author === "string" ? body.author.trim().slice(0, 120) : "";

    if (message.length < 1 || message.length > 4000) {
      throw new AppError("validation_failed", "Write a comment between 1 and 4,000 characters.");
    }

    /*
     * A public link has no identity behind it, so the comment is stored with the
     * name the visitor gave and no author id. It is marked as external so the
     * dashboard can tell it apart from a comment by a signed-in collaborator — the
     * owner should never mistake an anonymous comment for a colleague's.
     *
     * A blank name is stored blank, not as "Guest". "Guest" was a substitute nobody
     * chose and it made two different situations — no name given, and someone who
     * signs as Guest — look identical. The display decides what a blank means
     * ("User"), in `link_comments`, so every surface agrees.
     */
    const supabase = getServiceClient();
    const { error } = await supabase.from("file_comments").insert({
      file_id: item.id,
      author_id: null,
      author_name: author,
      body: message,
      external: true,
    });

    if (error) {
      throw new AppError("unknown", "That comment wasn't saved. Nothing was changed.");
    }

    return ok({ posted: true });
  });
}

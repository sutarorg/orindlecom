/**
 * POST /api/s/:token/edit — save an edit made through a public edit link.
 *
 * The only unauthenticated *write* in the product, and the narrowest one that can
 * be useful: it replaces the body of a text or code file, it requires the link to
 * carry the editor permission, and it refuses every other format outright.
 *
 * Writing is done through the service client because the editor has no account, so
 * there is no session for RLS to evaluate. That makes the checks in this handler the
 * entire gate, which is why they are all here and all explicit:
 *
 *   - the token must resolve (unrevoked and unexpired);
 *   - the permission must be `editor` — commenter and viewer links are refused even
 *     though the page does not render an editor for them;
 *   - the file must still be live;
 *   - the file must be text or code, so an edit cannot rewrite an image or, worse,
 *     an HTML file that would then be served back;
 *   - the new body must be within the same size bound the upload path enforces.
 *
 * An edit is an overwrite, not a version. That is stated in the response and in the
 * UI rather than implied, because "edited" and "edited in place with no history" are
 * different promises.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson } from "@/lib/api";
import { LIMITS, ipBucket } from "@/lib/rate-limit";
import { hashIp, resolveClientIp } from "@/lib/security/ip";
import { AppError } from "@/domain/auth/errors";
import { getServiceClient } from "@/lib/supabase/service";
import { isStorageConfigured, putObject } from "@/lib/r2/client";
import { resolvePublicLink } from "@/lib/share/public-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Formats an edit link may rewrite. Anything else is refused, not silently ignored. */
const EDITABLE = new Set(["text", "code"]);

const MAX_EDIT_BYTES = 2 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handle(async () => {
    const { token } = await params;

    const limited = await enforceRateLimit(
      ipBucket("share.edit", hashIp(resolveClientIp(request.headers).ip)),
      LIMITS.renameItem,
    );
    if (limited) return limited;

    const item = await resolvePublicLink(token);
    if (!item) throw new AppError("not_found", "This link isn't available.");

    if (item.permission !== "editor") {
      throw new AppError("forbidden", "This link can't edit.");
    }

    if (item.kind !== "file" || !EDITABLE.has(item.category)) {
      throw new AppError(
        "validation_failed",
        "Only text and code files can be edited through a link.",
      );
    }

    if (!isStorageConfigured()) {
      throw new AppError("not_configured", "Storage isn't connected, so nothing was saved.");
    }

    const body = await readJson(request);
    const content = typeof body.body === "string" ? body.body : null;

    if (content === null) {
      throw new AppError("validation_failed", "Nothing to save.");
    }

    const bytes = Buffer.from(content, "utf8");
    if (bytes.byteLength > MAX_EDIT_BYTES) {
      throw new AppError("validation_failed", "That edit is larger than 2 MB.");
    }

    const supabase = getServiceClient();
    const { data } = await supabase
      .from("files")
      .select("storage_key, mime_type, deleted_at, status")
      .eq("id", item.id)
      .maybeSingle();

    if (!data?.storage_key || data.deleted_at !== null || data.status !== "available") {
      throw new AppError("not_found", "That file isn't available any more.");
    }

    /*
     * Overwrite in place. The content type is preserved from the row so an edit
     * cannot turn a `.txt` into something the browser would treat differently, and
     * the size on the row is updated so a quota figure stays honest.
     */
    try {
      await putObject(data.storage_key as string, bytes, {
        contentType: (data.mime_type as string | null) ?? "text/plain; charset=utf-8",
      });
    } catch {
      throw new AppError("unknown", "That edit wasn't saved. Nothing was changed.");
    }

    const { error } = await supabase
      .from("files")
      .update({ size_bytes: bytes.byteLength, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    if (error) {
      throw new AppError("unknown", "The file was saved but its size could not be updated.");
    }

    return ok({ saved: true, bytes: bytes.byteLength, versioned: false });
  });
}

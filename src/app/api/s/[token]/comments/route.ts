/**
 * GET /api/s/:token/comments — the conversation on a shared file.
 *
 * The read half of the comment surface. `POST /api/s/:token` writes a comment, and
 * without this the written comment was unreadable: the public page could only ever
 * show a thank-you, and the next visitor saw an empty page whether ten people had
 * commented or none.
 *
 * The read is a database function (`link_comments`) rather than a table select, for
 * the same reason link resolution is: the caller has no session, `file_comments` is
 * guarded by `has_file_access`, and loosening that policy to admit anonymous readers
 * would expose every comment on every file. The function is scoped to the token.
 *
 * The author name arrives already normalised — a blank name is rendered as "User" by
 * the function — so this handler passes it through untouched.
 */

import "server-only";

import { enforceRateLimit, handle, ok } from "@/lib/api";
import { LIMITS, ipBucket } from "@/lib/rate-limit";
import { hashIp, resolveClientIp } from "@/lib/security/ip";
import { AppError } from "@/domain/auth/errors";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  external: boolean;
  created_at: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return handle(async () => {
    const limited = await enforceRateLimit(
      ipBucket("share.comments", hashIp(resolveClientIp(request.headers).ip)),
      LIMITS.download,
    );
    if (limited) return limited;

    const { token } = await params;

    /*
     * An unconfigured deployment answers with an empty list rather than an error, on
     * the same reasoning as link resolution: the page has no comments to show either
     * way, and a 500 here would turn a working share page into a broken one because
     * a secret is missing.
     */
    if (!isServiceConfigured()) return ok({ comments: [] });

    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("link_comments", { p_token: token });

    if (error) throw new AppError("unknown", "Comments couldn't be loaded.");

    const rows = (data ?? []) as CommentRow[];
    return ok({
      comments: rows.map((row) => ({
        id: row.id,
        authorName: row.author_name || "User",
        body: row.body,
        external: row.external,
        createdAt: row.created_at,
      })),
    });
  });
}

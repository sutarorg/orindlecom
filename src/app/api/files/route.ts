/**
 * GET /api/files — list the caller's items.
 *
 * The scope and filters come from the query string and are validated against a
 * closed set. No user id appears anywhere in the request: the repository resolves
 * the actor from the session, and RLS restricts the rows regardless.
 */

import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import type { FileCategory, ListQuery, SortDirection, SortKey } from "@/lib/drive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = ["files", "folders", "recent", "starred", "shared", "trash"] as const;
const SORTS = ["name", "modified", "size", "type"] as const;
const DIRECTIONS = ["asc", "desc"] as const;
const CATEGORIES = [
  "documents",
  "images",
  "video",
  "audio",
  "archives",
  "other",
] as const;

function pick<T extends readonly string[]>(
  raw: string | null,
  allowed: T,
  fallback: T[number],
): T[number] {
  return raw && (allowed as readonly string[]).includes(raw)
    ? (raw as T[number])
    : fallback;
}

export async function GET(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const params = url.searchParams;

    const scope = params.get("scope");
    if (scope && !(SCOPES as readonly string[]).includes(scope)) {
      // An unknown scope is a client bug, not a filter that matches nothing. Say so.
      throw new AppError("validation_failed", "That isn't a view we have.");
    }

    const categories = params
      .getAll("category")
      .filter((value): value is FileCategory =>
        (CATEGORIES as readonly string[]).includes(value),
      );

    const query: ListQuery = {
      scope: (scope as ListQuery["scope"]) ?? "files",
      parentId: params.get("parentId") || null,
      search: params.get("search")?.slice(0, 200) ?? undefined,
      sort: pick(params.get("sort"), SORTS, "name") as SortKey,
      direction: pick(params.get("direction"), DIRECTIONS, "asc") as SortDirection,
      categories,
    };

    const repo = getDriveRepository();
    const result = await repo.list(query);

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

/**
 * The folder tree, as the database stores it and as a breadcrumb needs it.
 *
 * `folders.path` is maintained by the `folders_path` trigger as `/id/id/id/` — every
 * ancestor's id, ending with the folder's own. It carries no names, so it answers
 * "where does this sit" and nothing else.
 *
 * This lives in its own module because the parsing is the interesting part and it has
 * no dependency on the database: the repository calls it with a row's column, and a
 * test calls it with a string. It was a private helper inside the server-only
 * repository file, which meant the one piece of real logic in that file could not be
 * tested without a Supabase client.
 */

/**
 * The ids in a folder's path, outermost first.
 *
 * A malformed or empty path yields an empty list rather than throwing: a breadcrumb
 * without crumbs is a cosmetic loss, and a folder page that cannot render because its
 * path column is odd is not.
 */
export function pathIds(path: string | null | undefined): string[] {
  if (!path) return [];
  return path.split("/").filter(Boolean);
}

/**
 * The ancestors that lead *to* a folder — its chain without the folder itself.
 *
 * The stored path ends with the row's own id, so a breadcrumb trail that used the raw
 * list would repeat the page title as its own final crumb.
 */
export function ancestorPathIds(path: string | null | undefined): string[] {
  const ids = pathIds(path);
  return ids.slice(0, -1);
}

/**
 * Turn ancestor ids into labelled crumbs.
 *
 * A missing name becomes an empty string rather than the id. An id in a breadcrumb is
 * a database detail on screen; a blank crumb is merely unhelpful, and the caller can
 * decide how to render it.
 */
export function ancestorCrumbs(
  path: string | null | undefined,
  names: Map<string, string>,
): Array<{ id: string; name: string }> {
  return ancestorPathIds(path).map((id) => ({ id, name: names.get(id) ?? "" }));
}

/**
 * The folder tree, as the database stores it and as a URL and a breadcrumb need it.
 *
 * `folders.path` is maintained by the `folders_path` trigger as `/id/id/id/` — every
 * ancestor's id, ending with the folder's own. It carries no names, so it answers
 * "where does this sit" and nothing else.
 *
 * This is a pure module on purpose. Two of the three things that went wrong with the
 * hierarchy were in here — a path that was thrown away, and URLs built from a single
 * id — and both are string transformations, so both can be tested without a database.
 */

/** One step from the root: the folder's id and the name to show for it. */
export interface FolderCrumb {
  id: string;
  name: string;
}

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
 * a database detail on screen; a blank crumb is merely unhelpful, and the caller
 * decides how to render it.
 */
export function ancestorCrumbs(
  path: string | null | undefined,
  names: Map<string, string>,
): FolderCrumb[] {
  return ancestorPathIds(path).map((id) => ({ id, name: names.get(id) ?? "" }));
}

/**
 * The canonical URL path for a folder.
 *
 * Every folder in the hierarchy appears in the URL, in order — `/dashboard/folders/a`,
 * `/dashboard/folders/a/b`, `/dashboard/folders/a/b/c`. The alternative, which the app
 * used, was `/dashboard/folders/<leaf>` for every folder: the URL carried no
 * information about where the folder was, so two folders with the same name in
 * different branches produced indistinguishable addresses, and nothing about the
 * hierarchy could be inferred from a link or a refresh.
 *
 * `crumbs` is the chain *including* the folder itself, root first.
 */
export function folderHref(crumbs: FolderCrumb[]): string {
  return `/dashboard/folders/${crumbs.map((crumb) => crumb.id).join("/")}`;
}

/** The same address for a chain given as ids. */
export function folderHrefFromIds(ids: string[]): string {
  return `/dashboard/folders/${ids.join("/")}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the ids a URL claims to walk through.
 *
 * Returns `null` for anything that is not one or more uuids, so a caller can answer
 * with a 404 before touching the database. This is *shape* validation only: whether
 * the chain is real, and whether the caller may see it, is decided by comparing it
 * against the stored path, never by trusting the URL.
 */
export function parseFolderPath(segments: string[]): string[] | null {
  if (segments.length === 0) return null;
  if (!segments.every((segment) => UUID.test(segment))) return null;
  return segments;
}

/**
 * Does the URL's chain match the stored ancestry exactly?
 *
 * This is the whole of the URL's authority. A folder's stored path lists every
 * ancestor in order, so a URL that names the same folders in the same order is a
 * *description* of where the folder is; one that does not is a guess, and is answered
 * with a redirect to the canonical address rather than by pretending it worked.
 *
 * Comparing ids rather than only checking "is the last one the folder" is what stops
 * `/dashboard/folders/<someone-elses-id>/<your-id>` from rendering: the first segment
 * is not in your folder's chain, so the chain does not match. The id is never used as
 * proof of access — the folder is read through RLS and a folder the caller cannot see
 * simply has no ancestry to match against.
 */
export function matchesAncestry(urlIds: string[], storedPath: string | null | undefined): boolean {
  const stored = pathIds(storedPath);
  if (stored.length === 0) return false;
  if (urlIds.length !== stored.length) return false;
  return urlIds.every((id, index) => id === stored[index]);
}

/**
 * The canonical chain for a folder, from its stored path and a name lookup.
 *
 * Falls back to the id-derived chain when a name is missing, so the URL is still
 * correct even when the label is not — the two are independent, and a breadcrumb that
 * cannot name a folder should not be a breadcrumb that cannot link to it.
 */
export function canonicalCrumbs(
  path: string | null | undefined,
  names: Map<string, string>,
): FolderCrumb[] {
  return pathIds(path).map((id) => ({ id, name: names.get(id) ?? "" }));
}

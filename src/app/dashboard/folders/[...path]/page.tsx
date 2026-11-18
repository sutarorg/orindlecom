import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { FolderDetail } from "@/components/dashboard/folder-detail";
import { getDriveRepository } from "@/lib/drive/service";
import { folderHrefFromIds, parseFolderPath } from "@/lib/drive/folder-path";
import type { DriveItem } from "@/lib/drive/types";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Cached across `generateMetadata` and the page in one request.
 *
 * Both need the folder, and both used to fetch it — two identical queries, serialised
 * because metadata is awaited before the page runs. `cache()` dedupes them within the
 * request, so opening a folder costs one lookup, not two.
 */
const getFolder = cache((id: string) => getDriveRepository().get(id));

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

/**
 * Resolve the URL's chain against the stored hierarchy.
 *
 * The URL is `/dashboard/folders/{root}/{child}/{grandchild}/…`, at any depth. Three
 * separate questions are answered here, in order, and they are deliberately not the
 * same question:
 *
 *   1. **Shape.** Is every segment a uuid? No → 404, before the database is touched.
 *   2. **Existence and access.** Read the leaf folder through the repository, which
 *      runs under the caller's session and RLS. A folder that does not exist, or that
 *      belongs to somebody else, is indistinguishable from here — which is the point.
 *   3. **Truth.** Compare the URL's ids against the folder's stored ancestry.
 *
 * The third step is what the URL cannot skip. Trusting the segments would let
 * `/dashboard/folders/<any-id>/<your-folder>` render somebody else's id as if it were
 * an ancestor, and trusting only the last segment would make every nested URL
 * meaningless. The stored path is the authority: it is written by the database from
 * `parent_id`, and it lists the real ancestors in order.
 *
 * A chain that does not match is *redirected*, not rejected: the leaf may be perfectly
 * valid and the visitor may simply have followed an old one-id link, or hand-edited the
 * middle. Sending them to the canonical address is the useful answer, and it keeps
 * every existing `/dashboard/folders/<id>` link working.
 */
type Resolved =
  | { kind: "not-found" }
  | { kind: "redirect"; folder: DriveItem }
  | { kind: "ok"; folder: DriveItem };

async function resolveFolder(segments: string[]): Promise<Resolved> {
  const ids = parseFolderPath(segments);
  if (!ids) return { kind: "not-found" };

  const leafId = ids[ids.length - 1];
  const result = await getFolder(leafId);

  if (!result.ok || result.data.kind !== "folder") return { kind: "not-found" };

  const folder = result.data;

  if (!matchesChain(ids, chainIds(folder))) {
    /*
     * Either a one-id URL for a nested folder, or a URL whose middle segments do not
     * belong to this folder's chain. The canonical address is derived from the folder's
     * own row, so the redirect target is correct even when the request was a guess.
     */
    return { kind: "redirect", folder };
  }

  return { kind: "ok", folder };
}

/**
 * The ids of a folder and its ancestors, outermost first.
 *
 * `DriveItem.path` is the chain *above* the folder, so the folder's own id is appended.
 * This is the single place those two halves are joined; every comparison and every URL
 * on this page is built from the result.
 */
function chainIds(folder: DriveItem): string[] {
  return [...folder.path.map((crumb) => crumb.id), folder.id];
}

/**
 * Is the URL's chain exactly this folder's chain?
 *
 * Length and order both matter. A URL naming a real folder of yours but skipping a
 * level is not "close enough" — it would render a breadcrumb that does not match the
 * hierarchy, and the point of the hierarchy is that it does.
 */
function matchesChain(urlIds: string[], chain: string[]): boolean {
  return urlIds.length === chain.length && urlIds.every((id, index) => id === chain[index]);
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { path: segments } = await params;
  const resolved = await resolveFolder(segments);
  const name = resolved.kind === "not-found" ? "Folder" : resolved.folder.name;

  return pageMetadata({
    title: name,
    description: `Contents of ${name} in your Orindle library.`,
    // The canonical form, whatever was requested — a nested folder has one address.
    path:
      resolved.kind === "not-found"
        ? `/dashboard/folders/${segments.join("/")}`
        : folderHrefFromIds(chainIds(resolved.folder)),
    noIndex: true,
  });
}

/**
 * A folder page.
 *
 * The listing asks for `scope: "all"` — files *and* subfolders directly inside this
 * folder. It asked for `"files"` until now, so a folder containing only subfolders
 * rendered as "This folder is empty" while those subfolders existed. There was no
 * scope that could express "the contents of this folder"; that is what this one is.
 *
 * A folder that does not exist, or is not a folder, is a 404 rather than an empty
 * list: "this folder is empty" and "this folder is gone" are different messages and
 * deserve different screens.
 */
export default async function FolderPage({ params }: RouteParams) {
  const { path: segments } = await params;
  const resolved = await resolveFolder(segments);

  if (resolved.kind === "not-found") notFound();

  if (resolved.kind === "redirect") {
    /*
     * Derived from the stored path, so the destination is the folder's real address.
     *
     * `replace` semantics matter: the bad URL should not stay in the history, or the
     * back button bounces the visitor into the redirect again.
     */
    redirect(folderHrefFromIds(chainIds(resolved.folder)));
  }

  const { folder } = resolved;

  /*
   * One round of concurrency, not two serial steps.
   *
   * The folder row is already loaded; the listing does not depend on it — it is scoped
   * by the id from the URL — so fetching them one after the other would only add the
   * second query's latency to the first.
   */
  const listResult = await getDriveRepository().list({ scope: "all", parentId: folder.id });

  /*
   * The breadcrumb chain: the folder's ancestry, root first, *including* this folder.
   * `FolderDetail` drops the last entry when rendering the links so the page title is
   * not repeated, and uses the full list to build cumulative URLs.
   *
   * Built from the stored chain rather than from the URL, so a request that arrived
   * with the wrong middle segments — and was redirected above — cannot produce a trail
   * naming folders that are not really above this one.
   */
  const ancestors = [...folder.path, { id: folder.id, name: folder.name }];

  return (
    <FolderDetail
      folder={folder}
      ancestors={ancestors}
      items={listResult.ok ? listResult.data.items : []}
    />
  );
}

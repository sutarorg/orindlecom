import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderDetail } from "@/components/dashboard/folder-detail";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/**
 * Cached across `generateMetadata` and the page in one request.
 *
 * Both need the folder, and both used to fetch it — two identical queries, serialised
 * because metadata is awaited before the page runs. `cache()` from React dedupes them
 * within the request, so opening a folder costs one lookup for the folder, not two.
 */
const getFolder = cache((id: string) => getDriveRepository().get(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getFolder(id);
  const name = result.ok ? result.data.name : "Folder";
  return pageMetadata({
    title: name,
    description: `Contents of ${name} in your Orindle library.`,
    path: `/dashboard/folders/${id}`,
    noIndex: true,
  });
}

/**
 * A folder page.
 *
 * `path` on the item is the ancestry — the repository resolves the chain, so
 * the page doesn't walk a tree itself. A folder that doesn't exist, or isn't a
 * folder, is a 404 rather than an empty list: "this folder is empty" and "this
 * folder is gone" are different messages and deserve different screens.
 */
export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getDriveRepository();

  /*
   * One round of concurrency, not two serial steps.
   *
   * The listing does not depend on the folder row — it is scoped by the id from the
   * URL — so fetching them one after the other only added the second query's latency
   * to the first. The only thing the folder row decides is whether this is a 404, and
   * that is still checked before anything is rendered.
   */
  const [folderResult, listResult] = await Promise.all([
    getFolder(id),
    repo.list({ scope: "files", parentId: id }),
  ]);

  if (!folderResult.ok || folderResult.data.kind !== "folder") notFound();

  const folder = folderResult.data;

  // The record already carries its ancestry (id + name per level), so the
  // breadcrumb needs no extra round-trips.
  return (
    <FolderDetail
      folder={folder}
      ancestors={folder.path}
      items={listResult.ok ? listResult.data.items : []}
    />
  );
}

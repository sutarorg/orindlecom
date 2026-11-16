import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolderDetail } from "@/components/dashboard/folder-detail";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getDriveRepository().get(id);
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

  const folderResult = await repo.get(id);
  if (!folderResult.ok || folderResult.data.kind !== "folder") notFound();

  const folder = folderResult.data;
  const listResult = await repo.list({ scope: "files", parentId: id });

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

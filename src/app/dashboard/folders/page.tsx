import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardActions } from "@/components/dashboard/dashboard-header-actions";
import { FileManager } from "@/components/dashboard/file-manager";
import { EmptyFoldersArt } from "@/components/dashboard/empty-art";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Folders",
  description: "The folder structure of your Orindle library.",
  path: "/dashboard/folders",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Folders.
 *
 * Lists folders only — the one structural difference from My Files. Nested
 * navigation lives at /dashboard/folders/[id], which shows a breadcrumb trail
 * and the folder's contents.
 */
export default async function FoldersPage() {
  const result = await getDriveRepository().list({ scope: "folders" });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Folders"
        description="Your folder tree. Open one to see what's inside."
        action={<DashboardActions />}
        className="mb-4"
      />

      <FileManager
        items={items}
        showFilters={false}
        searchPlaceholder="Search folders…"
        empty={{
          variant: "first-use",
          art: <EmptyFoldersArt />,
          title: "No folders yet.",
          description:
            "Folders keep related files together and let you share a whole set of work with one permission.",
          action: <DashboardActions showFolderOnly />,
          footnote: "You can always move files into a folder later.",
        }}
      />
    </div>
  );
}

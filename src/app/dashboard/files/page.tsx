import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardActions } from "@/components/dashboard/dashboard-header-actions";
import { FileManager } from "@/components/dashboard/file-manager";
import { EmptyLibraryArt } from "@/components/dashboard/empty-art";
import { UploadTrigger } from "@/components/dashboard/upload-trigger";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "My Files",
  description: "Everything stored in your Orindle library.",
  path: "/dashboard/files",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * My Files.
 *
 * The canonical file manager. Folder navigation goes through
 * /dashboard/folders/[id] rather than client-side state, so a folder is a real
 * URL that can be bookmarked and reloaded into the same view.
 */
export default async function FilesPage() {
  const result = await getDriveRepository().list({ scope: "files", parentId: null });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="My Files"
        description="Everything you've stored, in one place. Folders come first, then files."
        action={<DashboardActions />}
        className="mb-4"
      />

      <FileManager
        items={items}
        showUploadZone
        searchPlaceholder="Search files…"
        empty={{
          variant: "first-use",
          art: <EmptyLibraryArt />,
          title: "Your files start here.",
          description: "Upload your first file to make Orindle your home for digital storage.",
          action: <UploadTrigger />,
          footnote: "Files you upload appear here immediately, newest first.",
        }}
      />
    </div>
  );
}

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
 * My Files — everything, everywhere in the tree.
 *
 * This page used to ask for `parentId: null`, which means the *root*: only the files
 * sitting at the top level. Every file inside a folder was therefore absent from the one
 * page named after "My Files", and the more organised an account was, the emptier that
 * page looked. A file could be uploaded, be present, be found by its folder, and still
 * be invisible here — which reads as data loss.
 *
 * The page now omits `parentId` entirely, which is a different request: the whole
 * drive, at any depth. Each item's `path` is resolved so a nested file can say which
 * folder it lives in — otherwise two files called `report.pdf` would be
 * indistinguishable rows.
 *
 * `scope: "all"` is deliberate: folders appear here too. The description says "folders
 * come first, then files", and it was describing something the query did not return.
 */
export default async function FilesPage() {
  const result = await getDriveRepository().list({ scope: "all", withPaths: true });
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
        // No `parentId`: this view is the whole drive, so an upload from here lands at
        // the root, which is the only place a global view can honestly put it.
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

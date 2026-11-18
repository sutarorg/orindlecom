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
 * My Files — every file in the account, at every depth, and nothing else.
 *
 * Two separate mistakes had to be undone here, and they cancelled each other out just
 * enough to look deliberate:
 *
 *   1. `parentId: null` means the **root**. The page asked for it, so every file inside
 *      a folder was absent from the one page named after "My Files" — and the more
 *      organised an account was, the emptier that page looked. A file could be uploaded,
 *      be present, be found through its folder, and still be invisible here, which reads
 *      as data loss. The fix is to omit `parentId`: that means the whole drive.
 *   2. `scope: "all"` means **files and folders**. So the page that showed too little
 *      also showed the wrong kind of thing — directory cards under a heading whose
 *      subtext said "folders come first, then files". A file browser's main view is not
 *      a place to list directories as rows; folders are navigated, and this page is the
 *      index of files.
 *
 * `scope: "files"` with no parent is exactly the question: every available file this
 * account owns, wherever it sits, and no folder records at all — enforced in the query,
 * not by filtering the array afterwards.
 *
 * `withPaths` resolves each file's ancestor chain so a nested row can say which folder
 * it lives in. Without it, two files called `report.pdf` in different branches are
 * indistinguishable lines.
 */
export default async function FilesPage() {
  const result = await getDriveRepository().list({ scope: "files", withPaths: true });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="My Files"
        description="Every file you've stored, wherever it lives. Folders open from the Folders page."
        action={<DashboardActions />}
        className="mb-4"
      />

      <FileManager
        items={items}
        /*
         * No `parentId`: this view is the whole drive, so an upload from here lands at
         * the root — the only destination a global view can honestly choose, and where
         * the file will be visible on the page that accepted it.
         */
        showUploadZone
        searchPlaceholder="Search files…"
        empty={{
          variant: "first-use",
          art: <EmptyLibraryArt />,
          title: "Your files start here.",
          description: "Upload your first file to make Orindle your home for digital storage.",
          action: <UploadTrigger />,
          footnote: "Every file you upload appears here, wherever you file it.",
        }}
      />
    </div>
  );
}

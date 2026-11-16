import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileManager } from "@/components/dashboard/file-manager";
import { EmptyCollectionArt } from "@/components/dashboard/empty-art";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Starred",
  description: "Files and folders you've starred in Orindle.",
  path: "/dashboard/starred",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Starred.
 *
 * Files and folders together — a starred folder is as useful to jump to as a
 * starred file, so this is the one collection that mixes the two.
 */
export default async function StarredPage() {
  const result = await getDriveRepository().list({ scope: "starred" });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Starred"
        description="The files and folders you've marked to find quickly."
        className="mb-4"
      />

      <FileManager
        items={items}
        mode="starred"
        showFilters={false}
        searchPlaceholder="Search starred…"
        empty={{
          variant: "first-use",
          art: <EmptyCollectionArt />,
          title: "Nothing starred yet.",
          description:
            "Star a file or folder and it lands here — a shortcut for the things you return to.",
          footnote: "Starring doesn't move or copy anything.",
          action: (
            <Link
              href="/dashboard/files"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Star className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Browse your files
            </Link>
          ),
        }}
      />
    </div>
  );
}

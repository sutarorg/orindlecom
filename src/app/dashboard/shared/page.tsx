import type { Metadata } from "next";
import { Share2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileManager } from "@/components/dashboard/file-manager";
import { EmptyCollectionArt } from "@/components/dashboard/empty-art";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shared",
  description: "Files shared with you and by you in Orindle.",
  path: "/dashboard/shared",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Shared.
 *
 * Two directions in one list: items somebody shared with you, and items you
 * have shared out. The record carries `owned` for the distinction, and the
 * empty state explains both halves rather than only one.
 */
export default async function SharedPage() {
  const result = await getDriveRepository().list({ scope: "shared" });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Shared"
        description="Files shared with you, and files you've shared with others."
        className="mb-4"
      />

      <FileManager
        items={items}
        mode="shared"
        showFilters={false}
        searchPlaceholder="Search shared…"
        empty={{
          variant: "first-use",
          art: <EmptyCollectionArt />,
          title: "Nothing shared yet.",
          description:
            "When someone shares a file with you it appears here. Files you share with others appear here too, with who can see them.",
          footnote: "You control access at any time from the Share dialog.",
          action: (
            <a
              href="/dashboard/files"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Open My Files
            </a>
          ),
        }}
      />
    </div>
  );
}

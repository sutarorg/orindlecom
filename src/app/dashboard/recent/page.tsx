import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { FileManager } from "@/components/dashboard/file-manager";
import { EmptyCollectionArt } from "@/components/dashboard/empty-art";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recent",
  description: "Files you opened recently in Orindle.",
  path: "/dashboard/recent",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Recent.
 *
 * Ordered by open time, which is a different ordering from every other view —
 * so it is the one collection where the default sort is `modifiedAt` desc
 * rather than name.
 *
 * The empty state is honest about the rule: this list is built from files you
 * have actually opened. It cannot be pre-populated, and it should not pretend
 * to be.
 */
export default async function RecentPage() {
  const result = await getDriveRepository().list({ scope: "recent" });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Recent"
        description="Files you've opened recently, most recent first."
        className="mb-4"
      />

      <FileManager
        items={items}
        showFilters={false}
        searchPlaceholder="Search recent files…"
        empty={{
          variant: "first-use",
          art: <EmptyCollectionArt />,
          title: "Nothing opened yet.",
          description:
            "Files you open show up here, newest first. This list is built from your actual activity — it can't be filled in for you.",
          footnote: "Opening a file doesn't move or copy it.",
          action: (
            <a
              href="/dashboard/files"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Clock className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Go to My Files
            </a>
          ),
        }}
      />
    </div>
  );
}

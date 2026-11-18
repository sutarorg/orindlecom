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
 * Recent — files at the top level only.
 *
 * Two rules, both enforced in the query rather than by filtering rows afterwards:
 *
 *   **Files only.** `scope: "recent"` reads the files table and not the folders table.
 *   It used to read both, so this page listed directory cards under a heading that
 *   promised "files you've opened" — and a folder has no open event to be recent from.
 *
 *   **Root only.** A file inside a folder belongs to that folder. Recent is a shortcut
 *   to what is sitting in plain sight, not a second unnamed window onto the whole tree;
 *   nested files stay reachable through the hierarchy they actually live in. Applied as
 *   `folder_id is null`, so a nested file is never fetched and then discarded.
 *
 * Ordering is unchanged: newest first by creation time. The empty state is honest about
 * the rule — this list is built from real files, and it cannot be pre-populated.
 */
export default async function RecentPage() {
  const result = await getDriveRepository().list({ scope: "recent", withPaths: true });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Recent"
        description="Recent files in your top level. Files inside folders stay in those folders."
        className="mb-4"
      />

      <FileManager
        items={items}
        showFilters={false}
        searchPlaceholder="Search recent files…"
        empty={{
          variant: "first-use",
          art: <EmptyCollectionArt />,
          title: "Nothing here yet.",
          description:
            "Recent lists the files in your top level, newest first. Files you've filed inside a folder stay with that folder — you'll find them from the Folders page.",
          footnote: "This list never moves or copies a file, and never changes where it lives.",
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

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { TrashView } from "@/components/dashboard/trash-view";
import { getDriveRepository } from "@/lib/drive/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Trash",
  description: "Deleted files, recoverable for a limited time.",
  path: "/dashboard/trash",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const result = await getDriveRepository().list({ scope: "trash" });
  const items = result.ok ? result.data.items : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Trash"
        description="Deleted items stay here until the retention window runs out."
        className="mb-4"
      />
      <TrashView items={items} />
    </div>
  );
}

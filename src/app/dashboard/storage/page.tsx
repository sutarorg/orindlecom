import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { StorageView } from "@/components/dashboard/storage-view";
import { getDriveRepository } from "@/lib/drive/service";
import type { StorageUsage } from "@/lib/drive/types";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Storage",
  description: "Your Orindle plan, capacity and usage.",
  path: "/dashboard/storage",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  const result = await getDriveRepository().usage();

  const usage: StorageUsage = result.ok
    ? result.data
    : {
        planId: "free",
        planName: "Free",
        used: 0,
        total: 0,
        byCategory: {},
        fileCount: 0,
        folderCount: 0,
        authoritative: false,
      };

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Storage"
        description="What your plan allows, and what's actually in use."
        className="mb-4"
      />
      <StorageView usage={usage} />
    </div>
  );
}

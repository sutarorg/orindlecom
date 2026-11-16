import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { BusinessStorageCard } from "@/components/business/business-storage-card";
import { OrganizationHeader } from "@/components/business/organization-header";
import { getBusinessRepository } from "@/lib/business/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Team storage",
  description: "Your organization's storage allowance and usage.",
  path: "/dashboard/business/storage",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BusinessStoragePage() {
  const repo = getBusinessRepository();
  const [orgs, storageResult] = await Promise.all([
    repo.organizations(),
    repo.storage("workspace"),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Team storage"
        description="One allowance for the whole organization. Everyone's uploads count against it."
        className="mb-4"
      />
      {organization && <OrganizationHeader organization={organization} compact className="mb-4" />}
      {storageResult.ok ? (
        <BusinessStorageCard storage={storageResult.data} />
      ) : (
        <div className="rounded-xl border border-[#F3D2CD] bg-[#FDF3F2] px-4 py-6 text-center">
          <p className="text-[13px] font-semibold text-[#8F2D20]">Couldn&rsquo;t load storage</p>
          <p className="mt-1 text-[11.5px] text-[#8F2D20]/80">{storageResult.message}</p>
        </div>
      )}
    </div>
  );
}

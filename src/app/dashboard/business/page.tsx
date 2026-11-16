import type { Metadata } from "next";
import { BusinessOverview } from "@/components/business/business-overview";
import { getBusinessRepository } from "@/lib/business/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Overview",
  description: "Your organization's team and storage.",
  path: "/dashboard/business",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Business overview.
 *
 * Every figure on this page comes from the repository. On a deployment with no
 * organization service the counts are genuinely zero and the getting-started
 * path renders — which is the state a new organization sees anyway.
 */
export default async function BusinessOverviewPage() {
  const repo = getBusinessRepository();
  const [summaryResult, membersResult, foldersResult] = await Promise.all([
    repo.summary("workspace"),
    repo.members("workspace"),
    repo.folders("workspace"),
  ]);

  const summary = summaryResult.ok ? summaryResult.data : null;
  const members = membersResult.ok ? membersResult.data : [];
  const folders = foldersResult.ok ? foldersResult.data : [];

  // A failed summary is a real error, not an empty page.
  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6">
        <div className="rounded-xl border border-[#F3D2CD] bg-[#FDF3F2] px-4 py-6 text-center">
          <p className="text-[13px] font-semibold text-[#8F2D20]">Couldn&rsquo;t load the organization</p>
          <p className="mx-auto mt-1 max-w-[380px] text-[11.5px] leading-relaxed text-[#8F2D20]/80">
            {summaryResult.ok ? "" : summaryResult.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <BusinessOverview
      organization={summary.organization}
      storage={summary.storage}
      members={members}
      pendingInvitations={members.filter((m) => m.status === "invited").length}
      folders={folders}
      events={summary.recentActivity}
    />
  );
}

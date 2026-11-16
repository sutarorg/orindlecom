import type { Metadata } from "next";
import { Suspense } from "react";
import { BusinessSettingsView } from "@/components/business/settings-view";
import { CreateOrganizationCard } from "@/components/business/create-organization-card";
import { getBusinessRepository } from "@/lib/business/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Organization settings",
  description: "Your organization profile, team defaults and governance.",
  path: "/dashboard/business/settings",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const repo = getBusinessRepository();
  const [orgs, members] = await Promise.all([
    repo.organizations(),
    repo.members("workspace"),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;
  const list = members.ok ? members.data : [];
  const active = list.filter((member) => member.status === "active").length;

  if (!organization) {
    return (
      <Suspense fallback={null}>
        <CreateOrganizationCard />
      </Suspense>
    );
  }

  return (
    <BusinessSettingsView
      organization={organization}
      memberCount={list.length}
      activeMemberCount={active}
    />
  );
}

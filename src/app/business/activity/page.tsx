import type { Metadata } from "next";
import { ActivityView } from "@/components/business/activity-view";
import { getBusinessRepository } from "@/lib/business/service";
import { can } from "@/lib/business/roles";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Activity",
  description: "What's changed in your organization.",
  path: "/business/activity",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BusinessActivityPage() {
  const repo = getBusinessRepository();
  const [orgs, activity] = await Promise.all([
    repo.organizations(),
    repo.activity("workspace", { limit: 200 }),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;
  const events = activity.ok ? activity.data : [];

  return (
    <ActivityView events={events} canFilter={can(organization?.viewerRole ?? "member", "activity.view")} />
  );
}

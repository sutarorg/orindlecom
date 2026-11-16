import type { Metadata } from "next";
import { PermissionsView } from "@/components/business/permissions-view";
import { getBusinessRepository } from "@/lib/business/service";
import type { BusinessRole } from "@/lib/business/types";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Roles & permissions",
  description: "What each role in your organization can do.",
  path: "/dashboard/business/permissions",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BusinessPermissionsPage() {
  const repo = getBusinessRepository();
  const [orgs, members] = await Promise.all([
    repo.organizations(),
    repo.members("workspace"),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;
  const list = members.ok ? members.data : [];

  // Counts come from the real member list. The viewer is counted from their own
  // role record, because the member list is org-wide and a viewer whose record
  // isn't in it still belongs to exactly one of these roles.
  const memberCounts = list.reduce(
    (acc, member) => {
      acc[member.role] = (acc[member.role] ?? 0) + 1;
      return acc;
    },
    { owner: 0, admin: 0, member: 0 } as Record<BusinessRole, number>,
  );

  // The viewer holds exactly one of these roles. If their own member record isn't
  // in the list yet (a fresh organization, or a service that hasn't synced), the
  // count still has to include them — otherwise the page says nobody is an owner
  // while the header says the viewer is one.
  const viewerListed = list.some((member) => member.isViewer);
  const viewerRole = organization?.viewerRole ?? "member";
  if (!viewerListed) memberCounts[viewerRole] = (memberCounts[viewerRole] ?? 0) + 1;

  return (
    <PermissionsView viewerRole={viewerRole} memberCounts={memberCounts} />
  );
}

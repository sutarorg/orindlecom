import type { Metadata } from "next";
import { MembersView } from "@/components/business/members-view";
import { getBusinessRepository } from "@/lib/business/service";
import { getViewer } from "@/lib/drive/viewer";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Members",
  description: "People with access to your organization.",
  path: "/dashboard/business/members",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Members.
 *
 * The viewer's role comes from the organization record rather than being
 * inferred here — the page must not be the place that decides what somebody is
 * allowed to do.
 */
export default async function BusinessMembersPage() {
  const repo = getBusinessRepository();
  const [orgs, members, folders, viewer] = await Promise.all([
    repo.organizations(),
    repo.members("workspace"),
    repo.folders("workspace"),
    getViewer(),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;
  const list = members.ok ? members.data : [];

  return (
    <MembersView
      members={list}
      viewerRole={organization?.viewerRole ?? "member"}
      viewerId={viewer.authenticated ? viewer.email : null}
      folders={folders.ok ? folders.data : []}
    />
  );
}

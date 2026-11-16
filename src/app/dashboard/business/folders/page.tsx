import type { Metadata } from "next";
import { FoldersView } from "@/components/business/folders-view";
import { getBusinessRepository } from "@/lib/business/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Shared folders",
  description: "Folders your team can reach.",
  path: "/dashboard/business/folders",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BusinessFoldersPage() {
  const repo = getBusinessRepository();
  const [orgs, folders, members] = await Promise.all([
    repo.organizations(),
    repo.folders("workspace"),
    repo.members("workspace"),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;

  return (
    <FoldersView
      organizationId={organization?.id ?? "workspace"}
      folders={folders.ok ? folders.data : []}
      members={members.ok ? members.data : []}
      viewerRole={organization?.viewerRole ?? "member"}
    />
  );
}

import type { Metadata } from "next";
import { BusinessSettingsView } from "@/components/business/settings-view";
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
      <div className="mx-auto w-full max-w-[900px] px-4 py-5 sm:px-6">
        <div className="rounded-xl border border-[var(--brand-border)] bg-white px-4 py-8 text-center">
          <p className="text-[13px] font-semibold text-ink">No organization yet</p>
          <p className="mx-auto mt-1 max-w-[360px] text-[11.5px] leading-relaxed text-text-muted">
            There&rsquo;s nothing to configure until an organization exists.
          </p>
        </div>
      </div>
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

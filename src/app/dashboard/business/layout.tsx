import type { Metadata } from "next";
import { getDriveRepository } from "@/lib/drive/service";
import { formatBytes } from "@/lib/drive/format";
import { getViewer } from "@/lib/drive/viewer";
import { getBusinessRepository } from "@/lib/business/service";
import { BusinessClient } from "./business-client";

export const metadata: Metadata = {
  title: { default: "Organization", template: "%s · Orindle" },
  description: "Your team, its shared folders and its storage.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Business workspace layout.
 *
 * Loads the organization once per request and hands it to the shell, so every
 * business route renders with the same identity in the switcher and the same
 * role-derived navigation. Adding a business route means adding a page — not
 * re-fetching the organization.
 *
 * The storage figure in the sidebar is the organization's allowance, not the
 * viewer's personal plan. A team dashboard showing personal quota in the corner
 * would be quietly wrong on every screen.
 */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const [viewer, orgs, businessStorage, personalUsage] = await Promise.all([
    getViewer(),
    getBusinessRepository().organizations(),
    getBusinessRepository().storage("workspace"),
    getDriveRepository().usage(),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;

  const workspaceUsage = businessStorage.ok
    ? {
        used: businessStorage.data.used,
        total: businessStorage.data.total,
        label: `${formatBytes(businessStorage.data.used)} of ${formatBytes(businessStorage.data.total)}`,
      }
    : personalUsage.ok
      ? {
          used: personalUsage.data.used,
          total: personalUsage.data.total,
          label: `${formatBytes(personalUsage.data.used)} of ${formatBytes(personalUsage.data.total)}`,
        }
      : null;

  return (
    <BusinessClient
      user={{ name: viewer.name, email: viewer.email, initials: viewer.initials }}
      organization={
        organization
          ? {
              id: organization.id,
              name: organization.name,
              shortName: organization.shortName,
              initials: organization.initials,
              viewerRole: organization.viewerRole,
            }
          : null
      }
      usage={workspaceUsage}
    >
      {children}
    </BusinessClient>
  );
}

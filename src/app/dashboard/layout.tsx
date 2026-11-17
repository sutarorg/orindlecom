import type { Metadata } from "next";
import { formatBytes } from "@/lib/drive/format";
import { getDriveRepository } from "@/lib/drive/service";
import { getViewer } from "@/lib/drive/viewer";
import { getBusinessRepository } from "@/lib/business/service";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Orindle" },
  description: "Your files, storage and account with Orindle.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Dashboard layout.
 *
 * Fetches the things the shell needs on every route — the viewer and the
 * storage figure — once, here, so no page has to. The remaining data is
 * per-route.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  /*
   * The organization is fetched here too, and it is what the sidebar's account card
   * shows.
   *
   * The card is the answer to "which workspace am I in", and it used to answer
   * "Personal" only — because the personal layout never loaded the organization it
   * belongs to. So a customer whose workspace is called Orindle saw an entry offering
   * to *create* one, which reads as "your workspace is gone". It exists; the shell
   * just never asked.
   *
   * The organization list is already scoped to memberships by RLS, so this is one
   * cheap query alongside two others, not a permission decision.
   */
  const [viewer, usageResult, orgs] = await Promise.all([
    getViewer(),
    getDriveRepository().usage(),
    getBusinessRepository().organizations(),
  ]);

  const organization = orgs.ok ? (orgs.data[0] ?? null) : null;

  const usage = usageResult.ok
    ? {
        used: usageResult.data.used,
        total: usageResult.data.total,
        label: `${formatBytes(usageResult.data.used)} of ${formatBytes(usageResult.data.total)}`,
      }
    : null;

  return (
    <DashboardClient
      user={{ name: viewer.name, email: viewer.email, initials: viewer.initials }}
      usage={usage}
      organization={
        organization
          ? {
              name: organization.name,
              shortName: organization.shortName,
              initials: organization.initials ?? "OR",
              viewerRole: organization.viewerRole,
            }
          : null
      }
    >
      {children}
    </DashboardClient>
  );
}

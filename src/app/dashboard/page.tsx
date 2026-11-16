import type { Metadata } from "next";
import { Overview } from "@/components/dashboard/overview";
import { getDriveRepository } from "@/lib/drive/service";
import { getViewer } from "@/lib/drive/viewer";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Overview",
  description: "Your Orindle storage at a glance.",
  path: "/dashboard",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Overview route.
 *
 * Every list on this page is fetched, never seeded. With no storage connected
 * the repository returns empty arrays, which is exactly what renders the
 * first-use state — the state a real new account will see first.
 */
export default async function DashboardOverviewPage() {
  const repo = getDriveRepository();

  const [viewer, usage, recent, activity, starred] = await Promise.all([
    getViewer(),
    repo.usage(),
    repo.list({ scope: "recent" }),
    repo.activity(8),
    repo.list({ scope: "starred" }),
  ]);

  // A real account greets by first name; the placeholder identity is used whole
  // so it never renders as "Welcome, Your."
  const firstName = viewer.authenticated ? viewer.name.split(/\s+/)[0] : viewer.name;

  return (
    <Overview
      firstName={firstName}
      usage={
        usage.ok
          ? usage.data
          : {
              planId: "free",
              planName: "Free",
              used: 0,
              total: 0,
              byCategory: {},
              fileCount: 0,
              folderCount: 0,
              authoritative: false,
            }
      }
      recent={recent.ok ? recent.data.items : []}
      activity={activity.ok ? activity.data : []}
      starred={starred.ok ? starred.data.items : []}
    />
  );
}

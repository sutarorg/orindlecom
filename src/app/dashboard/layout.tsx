import type { Metadata } from "next";
import { formatBytes } from "@/lib/drive/format";
import { getDriveRepository } from "@/lib/drive/service";
import { getViewer } from "@/lib/drive/viewer";
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
  const [viewer, usageResult] = await Promise.all([
    getViewer(),
    getDriveRepository().usage(),
  ]);

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
    >
      {children}
    </DashboardClient>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsView } from "@/components/dashboard/settings-view";
import { getViewer } from "@/lib/drive/viewer";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Settings",
  description: "Manage your Orindle profile and account security.",
  path: "/dashboard/settings",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const viewer = await getViewer();

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Settings"
        description="Your profile, how you sign in, and the controls that can't be undone."
        className="mb-4"
      />
      <SettingsView
        user={{ name: viewer.name, email: viewer.email }}
        authenticated={viewer.authenticated}
      />
    </div>
  );
}

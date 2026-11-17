"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { businessEntryFor } from "@/config/business";

/**
 * Business shell wrapper.
 *
 * Breadcrumbs start at "Organization" rather than "Dashboard", because the
 * person is in a different workspace — the trail should say so, not imply they
 * are still one level inside their personal files.
 */
export function BusinessClient({
  children,
  user,
  organization,
  usage,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; initials: string };
  organization: {
    id: string;
    name: string;
    shortName: string;
    initials: string;
    viewerRole: "owner" | "admin" | "member";
  } | null;
  usage: { used: number; total: number; label: string } | null;
}) {
  const pathname = usePathname();
  const entry = businessEntryFor(pathname);

  const crumbs = entry
    ? [{ label: "Organization", href: "/business" }, { label: entry.label }]
    : [{ label: "Organization", href: "/business" }];

  return (
    <DashboardShell
      crumbs={crumbs}
      user={user}
      usage={usage}
      workspace={{
        kind: "business",
        organization: organization
          ? {
              name: organization.name,
              shortName: organization.shortName,
              initials: organization.initials,
            }
          : null,
        viewerRole: organization?.viewerRole ?? null,
      }}
    >
      {children}
    </DashboardShell>
  );
}

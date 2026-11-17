"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { NAV_GROUPS } from "@/config/dashboard";

/**
 * Route-aware shell wrapper.
 *
 * Breadcrumbs and the search field are derived from the current path here
 * rather than being passed by each page — pages shouldn't have to know what the
 * nav bar above them says.
 */
export function DashboardClient({
  children,
  user,
  usage,
  organization,
}: {
  children: React.ReactNode;
  user: { name: string; email: string; initials: string };
  usage: { used: number; total: number; label: string } | null;
  /**
   * The organization this account belongs to, if any.
   *
   * The switcher shows its name beside "Personal" so the card states both workspaces
   * by name rather than offering to create the one that already exists.
   */
  organization: {
    name: string;
    shortName: string;
    initials: string;
    viewerRole: "owner" | "admin" | "member";
  } | null;
}) {
  const pathname = usePathname();

  const entry = NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href),
  );

  const crumbs = entry
    ? [{ label: "Dashboard", href: "/dashboard" }, { label: entry.label }]
    : [{ label: "Dashboard", href: "/dashboard" }];

  return (
    <DashboardShell
      crumbs={crumbs}
      user={user}
      usage={usage}
      workspace={{ kind: "personal", organization, viewerRole: organization?.viewerRole ?? null }}
      // The search field appears only when a list registers itself with the
      // search bridge, so there is never a field with nothing to act on.
    >
      {children}
    </DashboardShell>
  );
}

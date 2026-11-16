/**
 * Business workspace navigation.
 *
 * Kept separate from `dashboard.ts` because the two navigations answer different
 * questions. The personal sidebar is "where are my files"; this one is "who is
 * on my team and what can they reach". Sharing one config would force one of
 * them into a shape that doesn't fit.
 *
 * Both render through the same `Sidebar` component with the same geometry, so
 * the visual identity is identical — only the information architecture differs.
 */

export type BusinessNavKey =
  | "business"
  | "members"
  | "folders"
  | "permissions"
  | "storage"
  | "activity"
  | "settings";

export type BusinessNavIcon =
  | "building"
  | "users"
  | "folder"
  | "shield"
  | "database"
  | "activity"
  | "settings";

export interface BusinessNavEntry {
  key: BusinessNavKey;
  label: string;
  href: string;
  icon: BusinessNavIcon;
  description: string;
  /** Only shown when the viewer's role satisfies this. */
  requiresRole?: "owner" | "admin";
}

/**
 * Groups, in the order a team admin actually works:
 * the overview first, then the people, then what they can reach, then the
 * rules, then the two cost/compliance views.
 */
export const BUSINESS_NAV_GROUPS: Array<{ label: string; items: BusinessNavEntry[] }> = [
  {
    label: "Organization",
    items: [
      {
        key: "business",
        label: "Overview",
        href: "/dashboard/business",
        icon: "building",
        description: "Your team and its storage at a glance",
      },
      {
        key: "members",
        label: "Members",
        href: "/dashboard/business/members",
        icon: "users",
        description: "People on the team and their invitations",
      },
      {
        key: "folders",
        label: "Shared folders",
        href: "/dashboard/business/folders",
        icon: "folder",
        description: "Folders the team can reach",
      },
    ],
  },
  {
    label: "Access",
    items: [
      {
        key: "permissions",
        label: "Roles & permissions",
        href: "/dashboard/business/permissions",
        icon: "shield",
        description: "What each role can do",
      },
      {
        key: "activity",
        label: "Activity",
        href: "/dashboard/business/activity",
        icon: "activity",
        description: "What's changed and who changed it",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        key: "storage",
        label: "Storage",
        href: "/dashboard/business/storage",
        icon: "database",
        description: "Team capacity and usage",
      },
      {
        key: "settings",
        label: "Settings",
        href: "/dashboard/business/settings",
        icon: "settings",
        description: "Organization profile and defaults",
      },
    ],
  },
];

export const ALL_BUSINESS_NAV: BusinessNavEntry[] = BUSINESS_NAV_GROUPS.flatMap(
  (group) => group.items,
);

/**
 * Which business route a pathname belongs to.
 *
 * `/dashboard/business` is an exact match, or it would claim every child route.
 */
export function businessEntryFor(pathname: string): BusinessNavEntry | undefined {
  return ALL_BUSINESS_NAV.find((entry) =>
    entry.href === "/dashboard/business"
      ? pathname === "/dashboard/business"
      : pathname === entry.href || pathname.startsWith(`${entry.href}/`),
  );
}

/** True when the path is anywhere inside the business workspace. */
export function isBusinessPath(pathname: string): boolean {
  return pathname === "/dashboard/business" || pathname.startsWith("/dashboard/business/");
}

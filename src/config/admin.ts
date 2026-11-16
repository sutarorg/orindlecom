/**
 * Admin navigation.
 *
 * One list, consumed by the sidebar, the mobile sheet, the breadcrumbs and the
 * docs. The order is prescribed by the specification and is not alphabetical:
 * Overview first because it is where a shift starts, Settings near the end
 * because it is where you go once, not often.
 */

export type AdminNavKey =
  | "overview"
  | "users"
  | "billing"
  | "storage"
  | "teams"
  | "support"
  | "analytics"
  | "logs"
  | "settings";

export interface AdminNavEntry {
  key: AdminNavKey;
  label: string;
  href: string;
  icon:
    | "overview"
    | "users"
    | "billing"
    | "storage"
    | "teams"
    | "support"
    | "analytics"
    | "logs"
    | "settings";
  description: string;
}

export const ADMIN_NAV: AdminNavEntry[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/admin",
    icon: "overview",
    description: "Platform totals, growth and recent activity",
  },
  {
    key: "users",
    label: "Users",
    href: "/admin/users",
    icon: "users",
    description: "Every registered account, searchable",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/admin/billing",
    icon: "billing",
    description: "Recurring revenue, subscriptions and invoices",
  },
  {
    key: "storage",
    label: "Storage",
    href: "/admin/storage",
    icon: "storage",
    description: "Committed, reserved and trashed bytes",
  },
  {
    key: "teams",
    label: "Teams",
    href: "/admin/teams",
    icon: "teams",
    description: "Business organizations and their members",
  },
  {
    key: "support",
    label: "Support",
    href: "/admin/support",
    icon: "support",
    description: "Tickets, replies and internal notes",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/admin/analytics",
    icon: "analytics",
    description: "Website traffic, acquisition and conversions",
  },
  {
    key: "logs",
    label: "Logs",
    href: "/admin/logs",
    icon: "logs",
    description: "Operator audit trail and operational history",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: "settings",
    description: "Integrations, price catalogue and administrators",
  },
];

/** Sidebar widths, matching the dashboard shell so the two feel like one product. */
export const ADMIN_SIDEBAR_WIDTH = 248;
export const ADMIN_SIDEBAR_COLLAPSED_WIDTH = 68;

/** The prefix that must be excluded from the sitemap and disallowed in robots.txt. */
export const ADMIN_PREFIX = "/admin";

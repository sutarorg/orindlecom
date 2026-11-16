/**
 * Dashboard navigation and copy configuration.
 *
 * Routes, labels and icons live here so the sidebar, the mobile nav, the
 * command palette and the docs can't drift apart. Adding a section means
 * editing this file, not four components.
 */

export type NavKey =
  | "overview"
  | "files"
  | "folders"
  | "recent"
  | "starred"
  | "shared"
  | "trash"
  | "storage"
  | "billing"
  | "settings"
  | "profile";

export interface NavEntry {
  key: NavKey;
  label: string;
  href: string;
  /** Lucide icon name resolved in the sidebar, kept as a string for config purity. */
  icon:
    | "home"
    | "files"
    | "folder"
    | "clock"
    | "star"
    | "share"
    | "trash"
    | "database"
    | "card"
    | "settings"
    | "user";
  /** Short description used by search and mobile nav. */
  description: string;
}

/**
 * Primary navigation.
 *
 * Grouped the way people think about a drive rather than alphabetically:
 * everything that is "my files in some arrangement" first, then account-level
 * things. Storage and Billing sit together because one answers "how much room"
 * and the other "what am I paying for it".
 */
export const NAV_GROUPS: Array<{ label: string; items: NavEntry[] }> = [
  {
    label: "Library",
    items: [
      { key: "overview", label: "Overview", href: "/dashboard", icon: "home", description: "Your storage at a glance" },
      { key: "files", label: "My Files", href: "/dashboard/files", icon: "files", description: "Everything you've stored" },
      { key: "folders", label: "Folders", href: "/dashboard/folders", icon: "folder", description: "Your folder tree" },
    ],
  },
  {
    label: "Collections",
    items: [
      { key: "recent", label: "Recent", href: "/dashboard/recent", icon: "clock", description: "Recently opened" },
      { key: "starred", label: "Starred", href: "/dashboard/starred", icon: "star", description: "Files you've marked" },
      { key: "shared", label: "Shared", href: "/dashboard/shared", icon: "share", description: "Shared with you and by you" },
      { key: "trash", label: "Trash", href: "/dashboard/trash", icon: "trash", description: "Deleted, still recoverable" },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "storage", label: "Storage", href: "/dashboard/storage", icon: "database", description: "How much space you're using" },
      { key: "billing", label: "Billing", href: "/dashboard/billing", icon: "card", description: "Plan and invoices" },
      { key: "settings", label: "Settings", href: "/dashboard/settings", icon: "settings", description: "Account and security" },
    ],
  },
];

export const ALL_NAV_ITEMS: NavEntry[] = NAV_GROUPS.flatMap((group) => group.items);

export function navEntryFor(key: NavKey): NavEntry {
  const entry = ALL_NAV_ITEMS.find((item) => item.key === key);
  if (!entry) throw new Error(`Unknown nav key: ${key}`);
  return entry;
}

/** Sidebar width, in px. Referenced by the shell's grid and the collapse logic. */
export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_COLLAPSED_WIDTH = 68;

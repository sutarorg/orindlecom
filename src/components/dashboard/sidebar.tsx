"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  CloudUpload,
  CreditCard,
  Database,
  Folder,
  FolderUp,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Share2,
  Star,
  Trash2,
  Plus,
  Building2,
  Users,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { CloudGlyph } from "@/components/brand/logo";
import { NAV_GROUPS, type NavEntry } from "@/config/dashboard";
import { BUSINESS_NAV_GROUPS, type BusinessNavEntry, type BusinessNavIcon } from "@/config/business";
import { formatPercent } from "@/lib/drive/format";
import { WorkspaceSwitcher } from "@/components/business/workspace-switcher";
import type { BusinessRole } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Application sidebar.
 *
 * The active state is a soft blue pill plus a 2px inset rail — enough to locate
 * yourself instantly at a glance across a 248px column, without the full
 * saturated fill that would fight every file tile on the page.
 *
 * Collapsible to a 68px icon rail, and that preference persists: a person who
 * collapses it once is telling us they want the width back on a small laptop.
 */

const ICONS = {
  home: Home,
  files: Folder,
  folder: FolderUp,
  clock: Clock,
  star: Star,
  share: Share2,
  trash: Trash2,
  database: Database,
  card: CreditCard,
  settings: Settings,
  user: Settings,
} as const;

const BUSINESS_ICONS: Record<BusinessNavIcon, React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  building: Building2,
  users: Users,
  folder: Folder,
  shield: ShieldCheck,
  database: Database,
  activity: Activity,
  settings: Settings,
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNewUpload,
  onNewFolder,
  usage,
  workspace,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewUpload: () => void;
  onNewFolder: () => void;
  usage: { used: number; total: number; label: string } | null;
  /**
   * Which navigation to render. The shell derives the active workspace from
   * the pathname, so this is a display decision only — but it is passed
   * explicitly rather than re-derived here so the nav and the switcher can
   * never disagree about which workspace is active.
   */
  workspace: {
    kind: "personal" | "business";
    organization: { name: string; shortName: string; initials: string } | null;
    viewerRole: BusinessRole | null;
  };
}) {
  const pathname = usePathname();
  const inBusiness = workspace.kind === "business";

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-[var(--brand-border-soft)] bg-white",
        collapsed ? "items-center" : "",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-[60px] shrink-0 items-center border-b border-[var(--brand-border-soft)]",
          collapsed ? "justify-center px-2" : "justify-between px-4",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Orindle dashboard"
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <CloudGlyph className="h-[17px] w-[25px] text-primary" />
          {!collapsed && (
            <span className="text-[17px] font-bold tracking-[-0.02em] text-ink">Orindle</span>
          )}
        </Link>
      </div>

      {/* Workspace switcher — always visible, states the active context. */}
      <div className={cn("shrink-0 pt-3", collapsed ? "px-2" : "px-3")}>
        <WorkspaceSwitcher
          collapsed={collapsed}
          organization={workspace.organization}
          viewerRole={workspace.viewerRole}
        />
      </div>

      {/* Primary actions */}
      <div className={cn("shrink-0 pt-3", collapsed ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={onNewUpload}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl bg-primary text-white shadow-[var(--brand-shadow-primary)]",
            "text-[13px] font-semibold transition-[background-color,transform] duration-150",
            "hover:bg-primary-hover active:translate-y-px",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            collapsed ? "h-10 justify-center" : "h-10 px-3.5",
          )}
          aria-label="Upload files"
        >
          <CloudUpload className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
          {!collapsed && <span>Upload</span>}
        </button>

        {/* Secondary action sits under the primary, quieter. */}
        <button
          type="button"
          onClick={onNewFolder}
          className={cn(
            "mt-1.5 flex w-full items-center gap-2 rounded-xl border border-transparent text-text",
            "text-[12.5px] font-medium transition-colors hover:border-[var(--brand-border)] hover:bg-[var(--brand-surface-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed ? "h-9 justify-center" : "h-9 px-3",
          )}
          aria-label="New folder"
        >
          <Plus className="h-4 w-4 shrink-0 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
          {!collapsed && <span>New folder</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav
        aria-label={inBusiness ? "Organization" : "Dashboard"}
        className={cn(
          "mt-3 min-h-0 flex-1 overflow-y-auto pb-3",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {inBusiness
          ? BUSINESS_NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                {!collapsed ? (
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                    {group.label}
                  </p>
                ) : (
                  <div aria-hidden="true" className="mx-auto mb-1.5 h-px w-6 bg-[var(--brand-border-soft)]" />
                )}
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.key}>
                      <BusinessNavItem
                        item={item}
                        active={isActive(pathname, item.href)}
                        collapsed={collapsed}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : null}
        {!inBusiness && NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed ? (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
                {group.label}
              </p>
            ) : (
              <div aria-hidden="true" className="mx-auto mb-1.5 h-px w-6 bg-[var(--brand-border-soft)]" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.key}>
                  <NavItem item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Storage meter + collapse */}
      <div
        className={cn(
          "shrink-0 border-t border-[var(--brand-border-soft)]",
          collapsed ? "flex flex-col items-center gap-2 px-2 py-3" : "px-3 py-3",
        )}
      >
        {usage && !collapsed && (
          <Link
            href={inBusiness ? "/dashboard/business/storage" : "/dashboard/storage"}
            className="group block rounded-xl border border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] p-3 transition-colors hover:border-[var(--brand-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-semibold text-ink">Storage</span>
              <span className="text-[10.5px] tabular-nums text-text-subtle">
                {formatPercent(usage.used, usage.total)}
              </span>
            </div>
            <div
              className="mt-2 overflow-hidden rounded-full bg-[#E3E8F5]"
              style={{ height: 4 }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((usage.used / Math.max(1, usage.total)) * 100)}
              aria-label="Storage used"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.min(100, (usage.used / Math.max(1, usage.total)) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10.5px] tabular-nums text-text-muted">
              {usage.label}
            </p>
          </Link>
        )}

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "mt-1 flex h-8 items-center gap-1.5 rounded-lg text-[11.5px] font-medium text-text-subtle transition-colors",
            "hover:bg-[var(--brand-surface-muted)] hover:text-text",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed ? "w-8 justify-center" : "w-full px-2",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ item, active, collapsed }: { item: NavEntry; active: boolean; collapsed: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center rounded-lg text-[12.5px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        collapsed ? "h-9 w-9 justify-center" : "h-8 gap-2.5 px-2",
        active
          ? "bg-primary-soft text-primary-ink"
          : "text-text hover:bg-[var(--brand-surface-muted)] hover:text-ink",
      )}
    >
      {/* Active rail: a 2px bar pinned to the left edge of the pill. */}
      {active && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary",
            collapsed && "hidden",
          )}
        />
      )}
      <Icon
        className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-text-subtle")}
        strokeWidth={active ? 2.2 : 1.9}
        aria-hidden="true"
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <span className="sr-only">{item.label}</span>}
    </Link>
  );
}

export { ICONS as NAV_ICONS };

function BusinessNavItem({
  item,
  active,
  collapsed,
}: {
  item: BusinessNavEntry;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = BUSINESS_ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center rounded-lg text-[12.5px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        collapsed ? "h-9 w-9 justify-center" : "h-8 gap-2.5 px-2",
        active
          ? "bg-primary-soft text-primary-ink"
          : "text-text hover:bg-[var(--brand-surface-muted)] hover:text-ink",
      )}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary"
        />
      )}
      <Icon
        className={cn("shrink-0", active ? "text-primary" : "text-text-subtle")}
        strokeWidth={active ? 2.2 : 1.9}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

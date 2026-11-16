"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  CreditCard,
  Database,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ADMIN_NAV, type AdminNavEntry } from "@/config/admin";
import { cn } from "@/lib/utils";

/**
 * Admin navigation rail.
 *
 * Visually the sibling of the dashboard sidebar — same width, same soft-blue
 * active pill, same 2px inset rail — because this is the same product, not a
 * second one. It differs in one deliberate way: the footer shows the operator's
 * platform role. Someone with `owner` should never be unsure whether a button
 * they cannot see is missing or forbidden.
 */

const ICONS: Record<AdminNavEntry["icon"], React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>> = {
  overview: LayoutDashboard,
  users: Users,
  billing: CreditCard,
  storage: Database,
  teams: Building2,
  support: LifeBuoy,
  analytics: BarChart3,
  logs: ScrollText,
  settings: Settings,
};

export function AdminSidebar({
  collapsed,
  onToggleCollapsed,
  admin,
  onLogout,
  loggingOut,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  admin: { email: string; role: "owner" | "admin" };
  onLogout: () => void;
  loggingOut: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-r border-[var(--brand-border)] bg-white">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-[var(--brand-border-soft)]",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        {!collapsed && (
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.1} aria-hidden />
            </span>
            <span className="min-w-0 truncate text-[13px] font-extrabold tracking-[-0.02em] text-ink">
              Orindle Admin
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={2.1} aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={2.1} aria-hidden />
          )}
        </button>
      </div>

      <nav aria-label="Administration" className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((entry) => {
            const Icon = ICONS[entry.icon];
            // `/admin` must match exactly; every other entry matches its subtree
            // so a detail page still highlights its section.
            const active =
              entry.href === "/admin" ? pathname === "/admin" : pathname.startsWith(entry.href);

            return (
              <li key={entry.key}>
                <Link
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? entry.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg py-2 text-[13px] font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    collapsed ? "justify-center px-0" : "px-2.5",
                    active
                      ? "bg-primary-soft text-primary-ink"
                      : "text-text hover:bg-[var(--brand-surface-muted)] hover:text-ink",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <Icon
                    className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-text-subtle")}
                    strokeWidth={active ? 2.2 : 1.9}
                    aria-hidden
                  />
                  {!collapsed && <span className="min-w-0 truncate">{entry.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-[var(--brand-border-soft)] p-2">
        {!collapsed && (
          <div className="mb-1.5 rounded-lg bg-[var(--brand-surface-muted)] px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
              <Activity className="h-3 w-3" strokeWidth={2.2} aria-hidden />
              {admin.role === "owner" ? "Platform owner" : "Platform admin"}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-text-muted" title={admin.email}>
              {admin.email}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] font-semibold text-text-muted transition-colors",
            "hover:bg-[#FDF3F2] hover:text-[#C93B2B] disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            collapsed ? "justify-center px-0" : "px-2.5",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
          {!collapsed && <span>{loggingOut ? "Signing out…" : "Logout"}</span>}
        </button>
      </div>
    </div>
  );
}

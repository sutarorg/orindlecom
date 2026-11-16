"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, X } from "lucide-react";
import { AdminSidebar } from "./admin-sidebar";
import { ADMIN_NAV } from "@/config/admin";
import { signOutAdminAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

/**
 * Admin shell.
 *
 * Same responsive strategy as the customer dashboard shell — 248px rail, then a
 * 68px icon rail on tablet, then a full-height overlay sheet on a phone — because
 * a 68px rail on a 390px screen spends a fifth of the width on icons nobody can
 * read.
 *
 * The mobile sheet is a real dialog: scrim, Escape, scroll lock, focus moved in
 * and restored on close, and Tab cycling trapped inside. Those four behaviours are
 * what separate a drawer from a div that covers the page.
 */

export function AdminShell({
  children,
  admin,
}: {
  children: React.ReactNode;
  admin: { email: string; role: "owner" | "admin" };
}) {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Restore the collapse preference, auto-collapsing once on tablet.
  React.useEffect(() => {
    const stored = window.localStorage.getItem("orindle:admin-sidebar");
    if (stored === "collapsed" || stored === "expanded") {
      setCollapsed(stored === "collapsed");
    } else if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("orindle:admin-sidebar", next ? "collapsed" : "expanded");
      } catch {
        // Preference simply will not persist.
      }
      return next;
    });
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      ).filter((el) => el.offsetParent !== null);

    const raf = requestAnimationFrame(() => focusables()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [mobileOpen]);

  /**
   * Logout.
   *
   * Uses the existing server action rather than a browser Supabase client. The
   * session is httpOnly and the teardown belongs on the server; a client-side
   * sign-out would have to be duplicated here and could drift from the one the
   * rest of the app uses. The action redirects, so there is no client navigation
   * to get wrong.
   */
  const [pendingLogout, startLogout] = React.useTransition();
  const logout = React.useCallback(() => {
    setLoggingOut(true);
    startLogout(async () => {
      await signOutAdminAction();
    });
  }, []);
  const loggingOutCombined = loggingOut || pendingLogout;

  const current =
    ADMIN_NAV.filter((entry) =>
      entry.href === "/admin" ? pathname === "/admin" : pathname.startsWith(entry.href),
    ).at(-1) ?? ADMIN_NAV[0];

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--brand-canvas)]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[400] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <div
        className="flex flex-1 items-stretch"
        style={{ ["--admin-sidebar-w" as string]: `${collapsed ? 68 : 248}px` }}
      >
        <aside
          className="sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 ease-[var(--brand-ease-out)] lg:block"
          style={{ width: "var(--admin-sidebar-w)" }}
        >
          <AdminSidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            admin={admin}
            onLogout={logout}
            loggingOut={loggingOutCombined}
          />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-[120] lg:hidden">
            <div
              className="absolute inset-0 bg-[rgba(14,20,48,0.42)]"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Administration navigation"
              className="absolute inset-y-0 left-0 w-[min(84vw,288px)] bg-white shadow-[0_24px_60px_-12px_rgba(23,29,58,0.3)]"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-text-subtle hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" strokeWidth={2.2} aria-hidden />
              </button>
              <AdminSidebar
                collapsed={false}
                onToggleCollapsed={() => setMobileOpen(false)}
                admin={admin}
                onLogout={logout}
                loggingOut={loggingOutCombined}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--brand-border)] bg-[var(--brand-surface-glass)] px-3 backdrop-blur-md sm:px-5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
              aria-label="Open administration navigation"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                <li className="shrink-0">
                  {/*
                    inline-flex + min-h-6 gives the link a 24px pointer target. A bare
                    text link is 16px tall, which fails WCAG 2.5.8 (AA) for pointer
                    targets and is genuinely hard to hit on a phone.
                  */}
                  <Link
                    href="/admin"
                    className="inline-flex min-h-6 items-center font-semibold text-text-muted transition-colors hover:text-ink"
                  >
                    Admin
                  </Link>
                </li>
                <li aria-hidden="true" className="shrink-0 text-text-subtle">
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                </li>
                <li className="min-w-0 truncate font-semibold text-ink" aria-current="page">
                  {current.label}
                </li>
              </ol>
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] sm:inline-flex",
                  admin.role === "owner"
                    ? "bg-[#EFE9FD] text-[#5B3BB8]"
                    : "bg-primary-soft text-primary-ink",
                )}
              >
                {admin.role}
              </span>
              {/*
                No Logout button here: the sidebar already has one, and the
                specification places it there. Two controls that do the same thing
                is one too many — on a narrow screen the header copy also competes
                with the breadcrumb for the few pixels available.
              */}
            </div>
          </header>

          <main id="admin-main" className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-7">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

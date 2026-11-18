"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, X } from "lucide-react";
import { ToastProvider } from "@/components/ui/toast";
import { SearchBridgeProvider } from "./search-bridge";
import { Sidebar } from "./sidebar";
import { Topbar, type Crumb } from "./topbar";
import { NewFolderDialog } from "./new-folder-dialog";
import { UploadChooser, useUploadPicker } from "./upload-chooser";
import { UploadTray, UploadManagerProvider } from "./upload-manager";
import { UploadDropzone } from "./upload-dropzone";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "@/config/dashboard";
import type { BusinessRole } from "@/lib/business/types";
import { cn } from "@/lib/utils";

/**
 * Dashboard shell.
 *
 * Desktop: persistent sidebar in a CSS grid, so content width never depends on
 * JavaScript having run.
 * Tablet (768–1023): sidebar collapses to the 68px icon rail automatically.
 * Mobile (<768): the sidebar leaves the flow entirely and becomes an overlay
 * sheet with a scrim — not a shrunken rail, because a 68px rail on a phone
 * steals a fifth of the screen to show icons nobody can read.
 *
 * The upload manager and drop zone live here rather than in the files page so
 * that "upload" works from every route, which is what the sidebar button
 * promises.
 */

export function DashboardShell({
  children,
  crumbs,
  user,
  usage,
  workspace = { kind: "personal", organization: null, viewerRole: null },
}: {
  children: React.ReactNode;
  crumbs: Crumb[];
  user: { name: string; email: string; initials: string };
  usage: { used: number; total: number; label: string } | null;
  /**
   * Which workspace's navigation the sidebar renders. Defaults to personal so
   * every existing call site keeps working unchanged.
   */
  workspace?: {
    kind: "personal" | "business";
    organization: { name: string; shortName: string; initials: string } | null;
    viewerRole: BusinessRole | null;
  };
}) {
  return (
    <ToastProvider>
      <UploadManagerProvider>
        <SearchBridgeProvider>
          <ShellInner crumbs={crumbs} user={user} usage={usage} workspace={workspace}>
            {children}
          </ShellInner>
        </SearchBridgeProvider>
      </UploadManagerProvider>
    </ToastProvider>
  );
}

function ShellInner({
  children,
  crumbs,
  user,
  usage,
  workspace,
}: {
  children: React.ReactNode;
  crumbs: Crumb[];
  user: { name: string; email: string; initials: string };
  usage: { used: number; total: number; label: string } | null;
  workspace: {
    kind: "personal" | "business";
    organization: { name: string; shortName: string; initials: string } | null;
    viewerRole: BusinessRole | null;
  };
}) {
  const pathname = usePathname();

  /*
   * The folder the sidebar's "New folder" creates inside.
   *
   * Read from the route rather than passed in, because the shell is the *layout* —
   * it does not re-render for a navigation between two folder routes with the props
   * of the page it happens to be wrapping, and the button lives in the shell. It
   * used to pass no parent at all, so "New folder" while looking at
   * My Files > folder 1 created a sibling at the top level: the folder appeared to
   * vanish, because the list on screen is the one it was not put in.
   *
   * `/dashboard/folders/<uuid>` is the only route that shows a folder's contents, so
   * it is the only one where a parent applies. Everywhere else — My Files, Starred,
   * Shared, Trash — the top level is the honest answer.
   */
  /*
   * The folder being viewed, at any depth.
   *
   * The old pattern matched exactly one uuid, so on `/dashboard/folders/a/b` — a
   * nested folder's canonical URL — it matched nothing and `currentFolderId` was null.
   * Everything the shell does with that value then silently targeted the account root:
   * the sidebar's Upload button, New folder, and the mobile button. A nested folder's
   * own contents could not be added to from the shell at all.
   *
   * The last segment is the folder; the earlier ones are its ancestry and are checked
   * by the page, not here. This is a route-shape read, not an authorization decision.
   */
  const currentFolderId = React.useMemo(() => {
    const match = /^\/dashboard\/folders\/(.+?)\/?$/i.exec(pathname ?? "");
    if (!match) return null;
    const ids = match[1].split("/").filter(Boolean);
    return ids.length > 0 ? ids[ids.length - 1] : null;
  }, [pathname]);

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [mobileChooserOpen, setMobileChooserOpen] = React.useState(false);

  /*
   * One picker, two modes, one destination.
   *
   * The shell hosts the hidden inputs so the sidebar, the mobile menu and the floating
   * button share a single code path, and `useUploadPicker` resolves the destination
   * from `currentFolderId` — the folder this route is showing. There used to be a
   * file-only picker here, opened by every upload entry point with no parent at all,
   * which is why "Upload" could neither upload a folder nor add to the folder you were
   * looking at.
   */
  const picker = useUploadPicker(currentFolderId);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  // Restore the collapse preference. Auto-collapse on tablet widths the first
  // time, then respect whatever the visitor chose.
  React.useEffect(() => {
    const stored = window.localStorage.getItem("orindle:sidebar");
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
        window.localStorage.setItem("orindle:sidebar", next ? "collapsed" : "expanded");
      } catch {
        // Storage unavailable; the preference just won't persist.
      }
      return next;
    });
  }, []);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  // Mobile drawer: scroll lock, Escape, focus move and restore.
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

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--brand-canvas)]">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[400] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <div
        className="flex flex-1 items-stretch"
        style={{ ["--sidebar-w" as string]: `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px` }}
      >
        {/* Desktop / tablet sidebar */}
        <aside
          className="sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 ease-[var(--brand-ease-out)] lg:block"
          style={{ width: "var(--sidebar-w)" }}
        >
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onUploadFiles={() => picker.openFiles()}
            onUploadFolder={() => picker.openFolder()}
            onNewFolder={() => setNewFolderOpen(true)}
            usage={usage}
            workspace={workspace}
          />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[120] lg:hidden">
            <div
              className="absolute inset-0 bg-[rgba(14,20,48,0.42)] motion-safe:animate-[fadeIn_140ms_ease-out]"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[min(84vw,288px)] bg-white shadow-[0_24px_60px_-12px_rgba(23,29,58,0.3)] motion-safe:animate-[sheetUp_180ms_cubic-bezier(0.22,0.68,0.28,1)]"
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-text-subtle hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </button>
              <Sidebar
                collapsed={false}
                onToggleCollapsed={() => setMobileOpen(false)}
                onUploadFiles={() => {
                  setMobileOpen(false);
                  picker.openFiles();
                }}
                onUploadFolder={() => {
                  setMobileOpen(false);
                  picker.openFolder();
                }}
                onNewFolder={() => {
                  setMobileOpen(false);
                  setNewFolderOpen(true);
                }}
                usage={usage}
                workspace={workspace}
              />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            crumbs={crumbs}
            user={user}
            onOpenNav={() => setMobileOpen(true)}
          />
          {/* Bottom padding on small screens keeps the last row of content
              clear of the floating upload button. */}
          <main id="dashboard-main" className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0">
            {/*
              * Suspense is mandatory here, not cosmetic.
              *
              * `DeletionCancelledNotice` reads `useSearchParams`, which opts its
              * enclosing tree into client-side rendering. Next.js requires a
              * Suspense boundary above any such component inside a statically
              * prerenderable route; without one the prerender is cancelled and the
              * route throws at runtime, unmounting the tree. That is a blank page
              * with a correct document title — exactly the symptom this fixes.
              *
              * `fallback={null}` is right because the banner is absent from almost
              * every visit: there is nothing to reserve space for, and rendering a
              * placeholder would shift the page.
              */}
            <Suspense fallback={null}>
              <DeletionCancelledNotice />
            </Suspense>
            {children}
          </main>
        </div>
      </div>

      {/*
        * Mobile upload: the same two choices as the sidebar.
        *
        * The button used to open the file picker directly, which on a phone meant a
        * folder could not be uploaded at all — the sidebar is behind a drawer, and the
        * FAB was the only upload control in reach. The chooser opens above the button
        * so the two options are visible without covering the thumb target.
        */}
      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 lg:hidden">
        <UploadChooser
          open={mobileChooserOpen}
          onClose={() => setMobileChooserOpen(false)}
          onPickFiles={() => picker.openFiles()}
          onPickFolder={() => picker.openFolder()}
          align="end"
        />
        <button
          type="button"
          onClick={() => setMobileChooserOpen((value) => !value)}
          aria-haspopup="menu"
          aria-expanded={mobileChooserOpen}
          className={cn(
            "flex h-13 w-13 items-center justify-center rounded-full",
            "bg-primary text-white shadow-[0_10px_24px_-6px_rgba(49,120,251,0.55)]",
            "transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            // Hidden while a dialog is open so it can't sit on top of one.
            (newFolderOpen || mobileChooserOpen) && "hidden",
          )}
          style={{ height: 52, width: 52 }}
          aria-label="Upload"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path
              d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M4.5 17.5v1A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5v-1"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* The global overlay targets the folder this route is showing. */}
      <UploadDropzone parentId={currentFolderId} />
      <UploadTray />
      <NewFolderDialog
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        parentId={currentFolderId}
      />
      {/*
        * The hidden inputs for the desktop sidebar and the mobile menu. Mounted once,
        * here, so both entry points pick into the folder the shell resolved from the
        * route — one code path, one destination.
        */}
      {picker.inputs}
    </div>
  );
}

/**
 * "Your account was saved from deletion."
 *
 * Shown once, on the redirect that follows a sign-in which cancelled a pending
 * deletion. That event is exactly the kind of thing a person needs confirming —
 * the alternative is silence after an irreversible request, which reads as "it is
 * still scheduled".
 *
 * Reads the flag from the query string rather than the database so it is a
 * one-shot message: dismissing it strips the parameter, and a reload does not
 * resurrect it. `router.replace` is used deliberately so the back button does not
 * return to a URL that re-shows the banner.
 */
function DeletionCancelledNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get("deletion_cancelled") === "1";

  const dismiss = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("deletion_cancelled");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  if (!cancelled) return null;

  return (
    <div className="px-4 pt-4 sm:px-6">
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-primary-soft)] px-3.5 py-3">
        <ShieldCheck
          className="mt-px h-4 w-4 shrink-0 text-[var(--brand-primary-ink)]"
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 text-[12px] leading-relaxed text-text">
          <p className="font-semibold text-ink">Your account was saved from deletion</p>
          <p className="mt-0.5 text-text-muted">
            Signing in cancelled the deletion request. Nothing was removed, and your
            account is back to normal.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-text-subtle transition-colors hover:bg-white/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { ToastProvider } from "@/components/ui/toast";
import { SearchBridgeProvider } from "./search-bridge";
import { Sidebar } from "./sidebar";
import { Topbar, type Crumb } from "./topbar";
import { NewFolderDialog } from "./new-folder-dialog";
import { UploadTray, useUploadManager, UploadManagerProvider } from "./upload-manager";
import { UploadDropzone } from "./upload-dropzone";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "@/config/dashboard";
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
}: {
  children: React.ReactNode;
  crumbs: Crumb[];
  user: { name: string; email: string; initials: string };
  usage: { used: number; total: number; label: string } | null;
}) {
  return (
    <ToastProvider>
      <UploadManagerProvider>
        <SearchBridgeProvider>
          <ShellInner crumbs={crumbs} user={user} usage={usage}>
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
}: {
  children: React.ReactNode;
  crumbs: Crumb[];
  user: { name: string; email: string; initials: string };
  usage: { used: number; total: number; label: string } | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const upload = useUploadManager();

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
            onNewUpload={() => setPickerOpen(true)}
            onNewFolder={() => setNewFolderOpen(true)}
            usage={usage}
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
                onNewUpload={() => {
                  setMobileOpen(false);
                  setPickerOpen(true);
                }}
                onNewFolder={() => {
                  setMobileOpen(false);
                  setNewFolderOpen(true);
                }}
                usage={usage}
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
          <main id="dashboard-main" className="min-w-0 flex-1 pb-24 lg:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Floating upload button on mobile — the sidebar's primary action isn't
          visible there, and upload is the one thing that must always be one tap. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className={cn(
          "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full",
          "bg-primary text-white shadow-[0_10px_24px_-6px_rgba(49,120,251,0.55)]",
          "transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 lg:hidden",
          // Hide while a dialog is open so it can't sit on top of one.
          (newFolderOpen || pickerOpen) && "hidden",
        )}
        style={{ height: 52, width: 52 }}
        aria-label="Upload files"
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

      <UploadDropzone />
      <UploadTray />
      <NewFolderDialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} />
      <FilePickerHost open={pickerOpen} onClose={() => setPickerOpen(false)} onPicked={upload.addFiles} />
    </div>
  );
}

/**
 * The system file picker, triggered from the shell.
 *
 * Kept as a bare hidden input rather than a styled dropzone because this path
 * is "I know what file I want" — the visual affordance is the drop zone on the
 * files page, and duplicating it in a dialog would be a second way to do the
 * same thing with a different look.
 */
function FilePickerHost({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (files: File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.click();
    // The change event may not fire if the visitor cancels, so close on the
    // next focus of the window either way.
    const onFocus = () => setTimeout(onClose, 400);
    window.addEventListener("focus", onFocus, { once: true });
    return () => window.removeEventListener("focus", onFocus);
  }, [open, onClose]);

  return (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length) onPicked(files);
        event.target.value = "";
        onClose();
      }}
    />
  );
}

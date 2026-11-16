"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  CircleHelp,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
} from "lucide-react";
import { Menu as ActionMenu, type MenuItem } from "@/components/ui/menu";
import { useSearchBridge } from "./search-bridge";
import { cn } from "@/lib/utils";

/**
 * Application top bar.
 *
 * Three zones: breadcrumb (left, where you are), search (centre, what you're
 * looking for), account (right, who you are). Search is the only element that
 * expands — it grows into the centre gap on focus, because search is the thing
 * people reach for most in a file manager.
 *
 * Keyboard: `/` focuses search from anywhere that isn't a text field, Escape
 * blurs and clears. That shortcut is advertised in the field itself rather than
 * hidden in a docs page.
 */

export interface Crumb {
  label: string;
  href?: string;
}

export function Topbar({
  crumbs,
  user,
  onOpenNav,
}: {
  crumbs: Crumb[];
  user: { name: string; email: string; initials: string };
  onOpenNav: () => void;
}) {
  const router = useRouter();

  // Search is driven by whichever list has registered itself. On a page with
  // no list the field is absent rather than present-but-inert.
  const bridge = useSearchBridge();
  const [searchValue, setSearchValue] = React.useState("");
  const showSearch = bridge.active;
  const onSearchChange = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      bridge.setValue(value);
    },
    [bridge],
  );

  // Leaving a list route should not leave a stale query behind in the shell.
  const pathname = usePathname();
  React.useEffect(() => {
    setSearchValue("");
  }, [pathname]);

  const [menuOpen, setMenuOpen] = React.useState(false);
  const accountRef = React.useRef<HTMLButtonElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);

  // `/` focuses search unless the visitor is already typing somewhere.
  React.useEffect(() => {
    if (!showSearch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.getAttribute("role") === "combobox";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showSearch]);

  const accountItems: MenuItem[] = [
    { key: "profile", label: "Profile", icon: User, onSelect: () => router.push("/dashboard/profile") },
    { key: "settings", label: "Settings", icon: Settings, onSelect: () => router.push("/dashboard/settings") },
    {
      key: "signout",
      label: "Sign out",
      icon: LogOut,
      destructive: true,
      separatorBefore: true,
      onSelect: () => router.push("/login"),
    },
  ];

  return (
    <header className="sticky top-0 z-40 flex h-[60px] shrink-0 items-center gap-2 border-b border-[var(--brand-border-soft)] bg-white/85 px-3 backdrop-blur-md sm:gap-3 sm:px-5">
      {/* Mobile nav trigger */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      </button>

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1 overflow-hidden">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-text-subtle/70"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="inline-flex min-h-[28px] max-w-[160px] items-center truncate rounded px-1 py-0.5 text-[12.5px] font-medium text-text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn(
                      "truncate px-1 py-0.5 text-[12.5px]",
                      last ? "font-semibold text-ink" : "font-medium text-text-muted",
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Search */}
      {showSearch && (
        <div
          className={cn(
            "relative hidden items-center transition-[width] duration-200 ease-[var(--brand-ease-out)] sm:flex",
            focused ? "w-[240px] lg:w-[300px]" : "w-[172px] lg:w-[210px]",
          )}
        >
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-text-subtle"
            strokeWidth={2.1}
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (searchValue) onSearchChange("");
                else event.currentTarget.blur();
              }
            }}
            placeholder="Search your files…"
            aria-label="Search files"
            className="h-8.5 w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] pl-8 pr-14 text-[12.5px] text-ink placeholder:text-text-subtle transition-[border-color,box-shadow,background-color] focus:border-primary focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.14)] [&::-webkit-search-cancel-button]:hidden"
            style={{ height: 34 }}
          />
          {/* Shortcut hint, replaced by a clear button once there's a query. */}
          {searchValue ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                searchRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded text-text-subtle transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : (
            !focused && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-2 rounded border border-[var(--brand-border-strong)] bg-white px-1.5 font-mono text-[10px] leading-[16px] text-text-subtle"
              >
                /
              </kbd>
            )
          )}
        </div>
      )}

      {/* Help */}
      <Link
        href="/faq"
        aria-label="Help and FAQ"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex"
      >
        <CircleHelp className="h-[17px] w-[17px]" strokeWidth={1.9} aria-hidden="true" />
      </Link>

      {/* Account */}
      <button
        ref={accountRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn(
          "flex h-8 shrink-0 items-center gap-2 rounded-full pl-0.5 pr-1 transition-colors sm:pr-2",
          "hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          menuOpen && "bg-[var(--brand-surface-muted)]",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8B5CF6,#3178FB)] text-[11px] font-bold text-white">
          {user.initials}
        </span>
        <span className="hidden max-w-[110px] truncate text-[12.5px] font-semibold text-ink lg:block">
          {user.name}
        </span>
      </button>
      <ActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchor={accountRef.current}
        items={accountItems}
        label="Account"
        width={196}
      />
    </header>
  );
}

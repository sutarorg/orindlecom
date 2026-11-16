"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PRIMARY_NAV, SITE } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Frosted background appears only after the page has moved, mirroring the
  // reference's transparent header over the hero wash.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the sheet when the route changes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Body scroll lock + focus trap + Escape handling for the mobile sheet.
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const raf = requestAnimationFrame(() => focusables()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
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
      body.style.overflow = prevOverflow;
      (previouslyFocused ?? triggerRef.current)?.focus?.();
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "sticky top-0 z-50 w-full transition-[background-color,box-shadow,backdrop-filter] duration-200",
          scrolled
            ? "bg-white/80 shadow-[0_1px_0_0_var(--brand-border-soft)] backdrop-blur-xl"
            : "bg-transparent",
        )}
      >
        <div className="container-or flex h-[var(--brand-header-height)] items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={`${SITE.name} — home`}
            className="-ml-1 rounded-lg px-1 py-1 transition-opacity hover:opacity-80"
          >
            <Wordmark glyphClassName="h-[17px] w-[26px]" />
          </Link>

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative inline-flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium tracking-[-0.004em] transition-colors duration-150",
                      isActive(item.href)
                        ? "text-ink"
                        : "text-text hover:bg-primary-soft/60 hover:text-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full px-3 text-[14px] font-medium text-text transition-colors hover:text-ink sm:inline-flex"
            >
              Sign in
            </Link>
            <Button asChild size="sm" pill className="h-[30px] px-[13px] text-[12.5px] tracking-[-0.01em] md:h-[32px] md:px-4 md:text-[13px]">
              <Link href="/signup">Get started</Link>
            </Button>
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label="Open menu"
              className="-mr-1.5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-primary-soft/70 md:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        className={cn(
          // When closed the panel is translated off-screen but still laid out,
          // which makes the document horizontally scrollable on mobile.
          // overflow-hidden clips it at the viewport edge so the slide
          // transition is untouched but no sideways scroll can appear.
          "fixed inset-0 z-[70] overflow-hidden md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-[rgba(14,20,48,0.32)] transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          id="mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={cn(
            "absolute right-0 top-0 flex h-full w-[min(88vw,380px)] flex-col bg-white shadow-[var(--brand-shadow-xl)] transition-transform duration-[280ms] ease-[var(--brand-ease-out)]",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-[64px] items-center justify-between px-5">
            <Wordmark />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface-muted"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item, i) => (
                <li
                  key={item.href}
                  style={{ transitionDelay: open ? `${60 + i * 40}ms` : "0ms" }}
                  className={cn(
                    "transition-all duration-300 ease-[var(--brand-ease-out)]",
                    open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  )}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-14 items-center rounded-xl px-3 text-[19px] font-bold tracking-[-0.018em] transition-colors",
                      isActive(item.href)
                        ? "bg-primary-soft text-primary-ink"
                        : "text-ink hover:bg-surface-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="my-5 hairline" />
            <ul className="space-y-1">
              {[
                { label: "Security", href: "/security" },
                { label: "FAQ", href: "/faq" },
                { label: "Contact", href: "/contact" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex h-12 items-center rounded-xl px-3 text-[15px] font-medium text-text transition-colors hover:bg-surface-muted hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[var(--brand-border-soft)] p-5">
            <div className="flex flex-col gap-2">
              <Button asChild variant="primary" size="lg" full>
                <Link href="/signup">Get 10 GB Free</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" full>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-3 text-center text-[12px] text-text-subtle">
              No credit card required
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

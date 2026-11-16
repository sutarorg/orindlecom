import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Auth layout.
 *
 * Mirrors the marketing shell without the marketing navigation: the same
 * 1280px container, the same 58–76px header band, the same pastel wash sitting
 * behind the card. The header is deliberately minimal — a visitor halfway
 * through sign-up should not be handed a nav bar that invites them to leave.
 *
 * Composition follows the reference's card-on-wash treatment rather than a
 * generic split screen: the reference has no full-height photograph, so neither
 * do we. The right-hand column carries a quiet aside that only exists on wide
 * viewports, where the whitespace would otherwise be empty.
 */
export function AuthLayout({
  children,
  aside,
  /** Shown under the card, e.g. the sign-in link on the signup screen. */
  footer,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Atmosphere: two pastel washes, matching the hero and legal pages. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_18%_-10%,rgba(231,226,253,0.85),rgba(231,226,253,0)_58%),radial-gradient(110%_75%_at_92%_6%,rgba(223,244,242,0.72),rgba(223,244,242,0)_62%),radial-gradient(90%_60%_at_76%_96%,rgba(255,230,220,0.55),rgba(255,230,220,0)_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(23,29,58,0.07),transparent)]"
      />

      <header className="container-or flex h-[var(--brand-header-height)] shrink-0 items-center justify-between">
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
          aria-label="Orindle home"
        >
          <Wordmark />
        </Link>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
        >
          Back to site
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      <main
        id="main"
        className="container-or flex flex-1 flex-col justify-center py-8 sm:py-10 lg:py-14"
      >
        <div
          className={cn(
            "mx-auto grid w-full items-center gap-12",
            aside ? "max-w-[420px] lg:max-w-[920px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]" : "max-w-[440px]",
          )}
        >
          <div className="w-full">
            {children}
            {footer && <div className="mt-6 text-center text-[13px] text-text-muted">{footer}</div>}
          </div>
          {aside && (
            <div className="hidden lg:block" aria-hidden={false}>
              {aside}
            </div>
          )}
        </div>
      </main>

      <footer className="container-or shrink-0 py-5">
        <div className="mx-auto flex max-w-[920px] flex-col items-center justify-between gap-2 border-t border-[var(--brand-border-soft)] pt-4 text-[11.5px] text-text-subtle sm:flex-row">
          <p>© {new Date().getFullYear()} Orindle</p>
          <nav aria-label="Legal" className="-mr-2 flex items-center gap-1">
            <Link href="/privacy" className="rounded px-2 py-1.5 transition-colors hover:text-text">
              Privacy
            </Link>
            <Link href="/terms" className="rounded px-2 py-1.5 transition-colors hover:text-text">
              Terms
            </Link>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="rounded px-2 py-1.5 transition-colors hover:text-text"
            >
              Support
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

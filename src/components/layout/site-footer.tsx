import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { FOOTER_NAV, SITE } from "@/config/site";

/**
 * Footer.
 *
 * Measured from the reference: hairline at y 1455, wordmark at x 30 with 20px
 * type, four link columns at x 228 / 364 / 500 / 635, a 1px vertical rule at
 * x 763, and three 18px social glyphs at x 800–908. Column headings 11px/600,
 * links 11px/400 muted on a 20px pitch.
 *
 * Only links that resolve to a real page are listed. Social icons come from
 * SITE.social, which holds the project's own accounts.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--brand-border-soft)] bg-white">
      <div className="container-or py-10 lg:py-14">
        <div className="grid gap-9 md:grid-cols-[minmax(0,200px)_1fr] lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:items-start lg:gap-10">
          {/* brand */}
          <div className="max-w-[260px]">
            <Link href="/" aria-label={`${SITE.name} — home`} className="inline-block">
              <Wordmark />
            </Link>
            <p className="mt-3 text-[12px] leading-[1.6] tracking-[-0.01em] text-text-muted">
              Store, access and share your files from anywhere. One simple place for everything
              you keep.
            </p>
          </div>

          {/* link columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 lg:gap-x-8">
            {FOOTER_NAV.map((group) => (
              <div key={group.title}>
                <h2 className="text-[11px] font-semibold leading-none tracking-[-0.005em] text-ink">
                  {group.title}
                </h2>
                <ul className="mt-3.5 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-[28px] items-center text-[11.5px] leading-[1.35] tracking-[-0.005em] text-text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* vertical rule + social, as in the reference */}
          <div className="flex items-center gap-6 md:col-span-2 lg:col-span-1 lg:items-start lg:gap-8">
            <span aria-hidden="true" className="hidden h-[76px] w-px bg-[var(--brand-border)] lg:block" />
            <ul className="flex items-center gap-4">
              {[
                {
                  label: "Instagram",
                  href: SITE.social.instagram,
                  path: "M7.6 2.5h8.8a5.1 5.1 0 0 1 5.1 5.1v8.8a5.1 5.1 0 0 1-5.1 5.1H7.6a5.1 5.1 0 0 1-5.1-5.1V7.6a5.1 5.1 0 0 1 5.1-5.1Zm4.4 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm4.9-2.7a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z",
                },
                {
                  label: "X",
                  href: SITE.social.x,
                  path: "M17.3 3h2.9l-6.4 7.3L21.5 21h-5.9l-4.6-6-5.3 6H2.8l6.8-7.8L2.5 3h6l4.2 5.5L17.3 3Zm-1 16.2h1.6L7.8 4.7H6.1l10.2 14.5Z",
                },
                {
                  label: "LinkedIn",
                  href: SITE.social.linkedin,
                  path: "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.5h4v11H3v-11Zm6.5 0h3.8v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.3-1.96 2.66v5.14h-3.74v-11Z",
                },
              ].map(({ label, href, path }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${SITE.name} on ${label}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--brand-text)] transition-colors hover:text-ink lg:h-6 lg:w-6"
                  >
                    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" aria-hidden="true">
                      <path d={path} fill="currentColor" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-[var(--brand-border-soft)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] tracking-[-0.005em] text-text-subtle">
            © {new Date().getFullYear()} Orindle. All rights reserved.
          </p>
          <p className="text-[11px] tracking-[-0.005em] text-text-subtle">
            Support:{" "}
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="underline decoration-[var(--brand-border-strong)] underline-offset-2 transition-colors hover:text-ink"
            >
              {SITE.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

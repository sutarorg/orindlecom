import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { FOOTER_NAV, SITE } from "@/config/site";

/**
 * Footer.
 *
 * Brand summary beside four link columns, followed by copyright and the
 * published support email. Only links that resolve to real pages are listed.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--brand-border-soft)] bg-white">
      <div className="container-or py-10 lg:py-14">
        <div className="grid gap-9 md:grid-cols-[minmax(0,220px)_1fr] lg:items-start lg:gap-12">
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

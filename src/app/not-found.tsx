import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";

export default function NotFound() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(231,226,253,0.6),rgba(255,255,255,0)_72%)]"
        />
        <div className="container-or">
          <div className="mx-auto max-w-[440px] text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
              <Compass className="h-5 w-5 text-primary" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-ink">
              404
            </p>
            <h1 className="mt-2 text-[length:var(--brand-h2-size)] font-extrabold leading-tight tracking-[var(--brand-h2-tracking)] text-ink">
              That page is not here
            </h1>
            <p className="mx-auto mt-2.5 max-w-[38ch] text-[13.5px] leading-relaxed text-text-muted">
              The link may be outdated, or the page may not have been built yet. Nothing of yours
              was affected.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <Link
                href="/"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-[13.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover"
              >
                Back to home
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.3} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-10 items-center rounded-full border border-[var(--brand-border-strong)] px-5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)]"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

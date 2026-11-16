import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { Wordmark } from "@/components/brand/logo";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Create your account",
  description: "Create a free Orindle account with 10 GB of storage. No credit card required.",
  path: "/sign-up",
  noIndex: true,
});

/**
 * Sign-up entry point.
 *
 * Registration opens alongside storage in the next phase. This page sets out
 * exactly what a free account includes and is explicit that the form is not yet
 * live, rather than presenting inputs that silently fail.
 */
const INCLUDED = [
  "10 GB of storage, shared across every device",
  "Folders, search, sharing and trash recovery",
  "Upgrade or cancel whenever you like",
  "No credit card required",
];

export default function SignUpPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden py-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(223,244,242,0.7),rgba(231,226,253,0.4)_48%,rgba(255,255,255,0)_76%)]"
        />
        <div className="container-or">
          <div className="mx-auto max-w-[440px] rounded-[18px] border border-[var(--brand-border)] bg-white p-6 shadow-[var(--brand-shadow-md)] sm:p-8">
            <div className="flex justify-center">
              <Wordmark />
            </div>
            <h1 className="mt-5 text-center text-[length:var(--brand-h2-size)] font-extrabold leading-tight tracking-[var(--brand-h2-tracking)] text-ink">
              Start with 10 GB free
            </h1>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-text-muted">
              Account creation opens with the first release of storage. Here is exactly what you
              will get.
            </p>

            <ul className="mt-5 space-y-2.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px] text-text">
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34C77B]"
                    strokeWidth={2.6}
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2.5">
              <Link
                href="/contact?subject=sales"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover"
              >
                Ask to be notified
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--brand-border-strong)] text-[14px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)]"
              >
                See all six plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

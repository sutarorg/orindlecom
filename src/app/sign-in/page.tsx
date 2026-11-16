import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { Wordmark } from "@/components/brand/logo";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to your Orindle account.",
  path: "/sign-in",
  noIndex: true,
});

/**
 * Sign-in entry point.
 *
 * Authentication is delivered in a later phase. Rather than a form that cannot
 * submit, this page is explicit about the current stage and routes people to the
 * two things that do work: creating a free account and reading the plans.
 */
export default function SignInPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden py-14 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(231,226,253,0.7),rgba(223,244,242,0.36)_45%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <div className="mx-auto max-w-[420px] rounded-[18px] border border-[var(--brand-border)] bg-white p-6 shadow-[var(--brand-shadow-md)] sm:p-8">
            <div className="flex justify-center">
              <Wordmark />
            </div>
            <h1 className="mt-5 text-center text-[length:var(--brand-h2-size)] font-extrabold leading-tight tracking-[var(--brand-h2-tracking)] text-ink">
              Sign in
            </h1>
            <p className="mt-2 text-center text-[13px] leading-relaxed text-text-muted">
              Accounts open with the first release of storage. Until then you can explore the
              product and the plans without signing up.
            </p>

            <div className="mt-6 space-y-2.5">
              <Link
                href="/sign-up"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover"
              >
                Create a free account
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--brand-border-strong)] text-[14px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)]"
              >
                Browse plans
              </Link>
            </div>

            <p className="mt-5 text-center text-[11.5px] text-text-subtle">
              10 GB free · no credit card required
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

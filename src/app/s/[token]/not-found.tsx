import Link from "next/link";
import { Link2Off } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";

/**
 * The page a dead share link lands on.
 *
 * Every failure looks the same here on purpose: unknown token, revoked link,
 * expired link and a file that has since been moved to the bin all produce this.
 * A distinct "this link expired" message would confirm to someone guessing tokens
 * that they had found a real one, and the visitor cannot act on the difference
 * anyway. It is also the standing rule not to tell somebody a link expired when the
 * real reason may be that it was revoked or never existed.
 *
 * It uses the marketing shell so a recipient who arrived from an email stays inside
 * the product they were told about, with a route out that is not the back button.
 */
export default function SharedLinkNotFound() {
  return (
    <SiteShell>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[560px] flex-col items-center justify-center px-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-surface-muted)] text-text-subtle">
          <Link2Off className="h-6 w-6" strokeWidth={1.7} aria-hidden />
        </span>

        <h1 className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-ink-strong sm:text-[26px]">
          This link isn&apos;t available
        </h1>

        <p className="mt-2 max-w-[380px] text-[13px] leading-relaxed text-text-muted">
          It may have been turned off by the person who shared it, or it may
          simply be wrong. Ask them to send a new one.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Go to Orindle
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </SiteShell>
  );
}

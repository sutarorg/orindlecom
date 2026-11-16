import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { SITE } from "@/config/site";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.about);

/**
 * About page.
 *
 * Deliberately contains no invented founding story, no fabricated team roster
 * and no made-up milestones — there is nothing here the project cannot stand
 * behind. It states the product thesis, the principles, and the current stage.
 */
const PRINCIPLES = [
  {
    title: "Familiar software, not a novelty",
    body: "Orindle should feel like it needs no explanation. That means a folder tree you already understand, a search that behaves like search, and buttons that mean what they say.",
  },
  {
    title: "Say what is true",
    body: "If a capability is not built, it is not on the pricing page. If a certification is not held, it is not on the security page. Trust is a consequence of accuracy, not of confident copy.",
  },
  {
    title: "Space is the product",
    body: "Everything else serves storage you can rely on: clear capacity, honest pricing, and no surprise limits. A storage product that hides its limits is not doing its job.",
  },
  {
    title: "No dark patterns",
    body: "No forced annual lock-in, no subscription you cannot leave, no fee to get your own files out. Cancelling returns you to the free tier rather than locking you out.",
  },
] as const;

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.7),rgba(255,230,220,0.35)_48%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="About"
            title="A simpler way to keep everything together."
            description="Orindle is personal and business cloud storage for people who want their files to simply be there — on every device, organised the way they think, priced honestly."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <h2 className="text-[length:var(--brand-h2-size)] font-extrabold leading-[1.22] tracking-[var(--brand-h2-tracking)] text-ink">
                Why it exists
              </h2>
              <div className="mt-3 space-y-3 text-[length:var(--brand-body-size)] leading-[1.68] tracking-[var(--brand-body-tracking)] text-text-muted">
                <p>
                  Storage should be the least interesting part of your digital life. In practice it
                  is often the opposite: capacity you have to calculate, tiers that stop at the size
                  you need, prices that change with the exchange rate, and a nagging worry about what
                  happens to a file when a device dies.
                </p>
                <p>
                  Orindle is an attempt to make that whole category forgettable. One library. One
                  allowance, shared across every device you sign in on. A free tier that is genuinely
                  usable at 10 GB, and paid tiers that go up to 5 TB in one flat step each.
                </p>
                <p>
                  It is built as a web product first, because that is the one client every device
                  already has. No plugin, no sync daemon, no desktop install required to reach a file.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {PRINCIPLES.map(({ title, body }) => (
                <div
                  key={title}
                  className="rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4"
                >
                  <p className="text-[13px] font-bold leading-tight text-ink">{title}</p>
                  <p className="mt-2 text-[12px] leading-[1.65] text-text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-12">
        <div className="container-or">
          <div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-5 sm:p-7">
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Built with
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.7] text-text">
                  Next.js and TypeScript on Vercel, Supabase for Postgres and authentication,
                  Cloudflare R2 for object storage, Razorpay for payments and Resend for email.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Where we are
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.7] text-text">
                  The public site and the product interface are live. Payments and storage go live
                  with the first paid accounts. We would rather say that plainly than imply
                  otherwise.
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Get in touch
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.7] text-text">
                  Questions, bug reports and objections are all welcome at{" "}
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    {SITE.supportEmail}
                  </a>
                  .
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--brand-border-soft)] pt-5">
              <Link
                href="/contact"
                className="inline-flex min-h-[28px] items-center gap-1.5 text-[13px] font-semibold text-primary-ink hover:text-primary"
              >
                Open the contact form
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.3} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </SiteShell>
  );
}

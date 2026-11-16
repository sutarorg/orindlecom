import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { FaqSearch } from "@/components/marketing/faq-section";
import { ALL_FAQ } from "@/config/faq";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Frequently asked questions",
  description:
    "Answers about Orindle plans, storage, sharing, billing, privacy and business accounts — with open questions named rather than guessed at.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.6),rgba(255,255,255,0)_72%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Help centre"
            title="Questions, answered plainly."
            description="Search across every answer, or read by topic. Where a policy is still open, the answer says so instead of inventing a rule."
          />
        </div>
      </section>

      <section className="pb-16 pt-9 sm:pb-20 sm:pt-12">
        <div className="container-or">
          <div className="mx-auto max-w-[760px]">
            <FaqSearch items={ALL_FAQ} />

            <div className="mt-8 rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-5">
              <p className="text-[13px] font-bold text-ink">Still need an answer?</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
                Send it through the{" "}
                <Link href="/contact" className="font-semibold text-primary-ink underline underline-offset-2">
                  contact form
                </Link>{" "}
                or email{" "}
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="font-semibold text-primary-ink underline underline-offset-2"
                >
                  {SITE.supportEmail}
                </a>
                . If a question comes up often enough, it is added to this page.
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

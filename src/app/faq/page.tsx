import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, MessageCircleQuestion } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { FaqExplorer } from "@/components/help/faq-explorer";
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
  const categoriesWithAnswers = new Set(ALL_FAQ.map((item) => item.category)).size;

  return (
    <SiteShell>
      <section className="relative overflow-hidden border-b border-[var(--brand-border-soft)] pt-10 pb-9 sm:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.6),rgba(255,255,255,0)_72%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="FAQ"
            title="Questions, answered plainly."
            description={`${ALL_FAQ.length} answers across ${categoriesWithAnswers} topics. Where a policy is still open, the answer says so instead of inventing a rule.`}
          />
        </div>
      </section>

      <section className="pb-14 pt-8 sm:pb-20 sm:pt-10">
        <div className="container-or">
          <div className="mx-auto max-w-[820px]">
            <FaqExplorer items={ALL_FAQ} />

            {/* Where to go next */}
            <div className="mt-12 grid gap-3 sm:grid-cols-2">
              <Link
                href="/help"
                className="group flex items-start gap-3 rounded-[14px] border border-[var(--brand-border)] bg-white p-4 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink"
                >
                  <BookOpen className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
                    Help centre
                    <ArrowRight
                      className="h-3.5 w-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.55] text-text-muted">
                    Longer walkthroughs for the tasks that need steps rather than a sentence.
                  </span>
                </span>
              </Link>

              <Link
                href="/contact?subject=support"
                className="group flex items-start gap-3 rounded-[14px] border border-[var(--brand-border)] bg-white p-4 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pastel-mint text-ink"
                >
                  <MessageCircleQuestion className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
                    Ask a person
                    <ArrowRight
                      className="h-3.5 w-3.5 text-text-subtle transition-transform group-hover:translate-x-0.5"
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-[1.55] text-text-muted">
                    If the answer is not here, write to{" "}
                    <span className="font-medium text-ink">{SITE.supportEmail}</span> and a person
                    replies.
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleAlert, Scale } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { LEGAL_DOCUMENTS } from "@/config/legal";
import { OPEN_PLACEHOLDER_COUNT, PLACEHOLDER_DEFINITIONS } from "@/config/legal/placeholders";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Legal",
  description:
    "Orindle's legal documents: privacy, terms, cookies, acceptable use and data deletion. Drafts, with every open question visible.",
  path: "/legal",
});

/**
 * Legal index.
 *
 * A directory rather than a wall of links, because two things need saying before
 * a reader opens any policy: these are drafts, and this is exactly what is still
 * undecided. Burying that in a footer is how a placeholder becomes a claim.
 */
export default function LegalIndexPage() {
  return (
    <SiteShell>
      <section className="border-b border-[var(--brand-border-soft)] pt-10 pb-9 sm:pt-14">
        <div className="container-or">
          <PageIntro
            eyebrow="Legal"
            title="The rules, in plain language."
            description="Five documents covering what we hold, what you may store, and what happens when you leave. They are drafts: every undecided question is shown as open rather than filled in."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="mx-auto max-w-[880px]">
            <ul className="grid gap-3 sm:grid-cols-2">
              {LEGAL_DOCUMENTS.map((doc) => {
                const reviewCount = doc.sections.filter((section) => section.review).length;
                return (
                  <li key={doc.id}>
                    <Link
                      href={doc.path}
                      className="group flex h-full flex-col rounded-[14px] border border-[var(--brand-border)] bg-white p-4 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">
                          {doc.title}
                        </h2>
                        <ArrowRight
                          className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-1.5 flex-1 text-[12.5px] leading-[1.6] text-text-muted">
                        {doc.summary}
                      </p>
                      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-text-subtle">
                        <span>{doc.sections.length} sections</span>
                        {reviewCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#8A5A0A]">{reviewCount} need review</span>
                          </>
                        )}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <section className="mt-10 rounded-[14px] border border-[#F1D9A8] bg-[#FEFBF3] p-4 sm:p-5">
              <h2 className="flex flex-wrap items-center gap-2 text-[14px] font-bold tracking-[-0.02em] text-[#5C3D06]">
                <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                {OPEN_PLACEHOLDER_COUNT} decisions are still open
              </h2>
              <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-[1.65] text-[#7A5209]">
                These are business and legal facts Orindle has not settled. Each one appears in the
                relevant policy as a marked placeholder. Nothing here has been filled in with a
                plausible guess.
              </p>

              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {PLACEHOLDER_DEFINITIONS.map((item) => (
                  <li
                    key={item.key}
                    className="rounded-[10px] border border-[#EBD9AE] bg-white/70 px-3 py-2"
                  >
                    <p className="text-[12px] font-semibold text-[#5C3D06]">{item.label}</p>
                    <p className="mt-0.5 text-[11px] leading-[1.55] text-[#7A5209]">{item.owner}</p>
                  </li>
                ))}
              </ul>

              <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-[1.6] text-[#7A5209]">
                <Scale className="mt-px h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                No policy on this site has been reviewed by a qualified lawyer. Sections requiring
                review are marked inside each document.
              </p>
            </section>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

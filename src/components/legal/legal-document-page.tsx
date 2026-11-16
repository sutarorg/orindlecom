import Link from "next/link";
import { CalendarClock, FileText, Scale } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { LEGAL_DOCUMENTS } from "@/config/legal";
import type { LegalDocument } from "@/config/legal/types";
import { SITE } from "@/config/site";
import { LegalBlocks, LegalCrossLinks } from "./legal-blocks";
import { TableOfContents, type TocEntry } from "./table-of-contents";
import { cn } from "@/lib/utils";

/**
 * Editorial shell shared by all five policies.
 *
 * The layout is a 260px TOC rail beside a 68-character measure, which is the
 * whole design decision: legal text is read in lines, so the content column is
 * sized by character count rather than by grid fraction, and the rail lives in
 * the space that would otherwise be margin.
 *
 * The draft banner is not a nicety. A policy that has not been reviewed by a
 * lawyer should say so on the page, in the reader's eyeline, not in a code
 * comment.
 */
export function LegalDocumentPage({ document: doc }: { document: LegalDocument }) {
  const entries: TocEntry[] = doc.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
    gist: section.gist,
    needsReview: Boolean(section.review),
  }));

  const reviewCount = doc.sections.filter((section) => section.review).length;

  return (
    <SiteShell>
      {/* Header */}
      <section className="border-b border-[var(--brand-border-soft)] pt-10 pb-8 sm:pt-14 sm:pb-10">
        <div className="container-or">
          <div className="mx-auto max-w-[980px]">
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-text-subtle">
                <li>
                  <Link
                    href="/legal"
                    className="rounded underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Legal
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li className="font-medium text-text-muted">{doc.title}</li>
              </ol>
            </nav>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-[620px]">
                <h1 className="text-[30px] font-extrabold leading-[1.12] tracking-[-0.035em] text-ink sm:text-[38px]">
                  {doc.title}
                </h1>
                <p className="mt-3 text-[15px] leading-[1.6] tracking-[-0.01em] text-text-muted">
                  {doc.summary}
                </p>
              </div>

              <div className="shrink-0 rounded-[12px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                  <CalendarClock className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
                  Last updated
                </p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-ink">
                  <time dateTime={doc.updated}>{formatUpdated(doc.updated)}</time>
                </p>
              </div>
            </div>

            {/* Draft notice */}
            <div className="mt-5 rounded-[12px] border border-[#F1D9A8] bg-[#FEFBF3] px-3.5 py-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] font-bold text-[#7A4E06]">
                <Scale className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                Draft — not yet reviewed by a lawyer
                {reviewCount > 0 && (
                  <span className="rounded bg-[#F5E4BE] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]">
                    {reviewCount} {reviewCount === 1 ? "section needs" : "sections need"} review
                  </span>
                )}
              </p>
              <p className="mt-1.5 max-w-[70ch] text-[12px] leading-[1.6] text-[#7A5209]">
                Every factual statement here matches how the product is built. Anything Orindle has
                not decided appears as a visible placeholder rather than a plausible guess.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="pb-16 pt-8 sm:pb-20">
        <div className="container-or">
          <div className="mx-auto grid max-w-[980px] gap-8 lg:grid-cols-[228px_minmax(0,1fr)] lg:gap-12">
            {/* Mobile navigator — above the article, where a reader needs it */}
            <div className="lg:hidden">
              <TableOfContents entries={entries} variant="disclosure" />
            </div>

            {/* Sticky rail */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
                <TableOfContents entries={entries} variant="rail" />
              </div>
            </aside>

            <article>
              <div className="space-y-9">
                {doc.sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={section.id}
                    aria-labelledby={`${section.id}-heading`}
                    className="scroll-mt-24 focus:outline-none"
                  >
                    <h2
                      id={`${section.id}-heading`}
                      className="flex items-baseline gap-2.5 text-[19px] font-extrabold leading-[1.25] tracking-[-0.03em] text-ink sm:text-[21px]"
                    >
                      <span className="shrink-0 text-[12px] font-bold tabular-nums text-text-subtle">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">{section.heading}</span>
                    </h2>
                    {section.gist && (
                      <p className="mt-1 pl-[34px] text-[12.5px] text-text-subtle">{section.gist}</p>
                    )}
                    <div className={cn("mt-3.5", "pl-0 sm:pl-[34px]")}>
                      <LegalBlocks blocks={section.blocks} />
                    </div>
                    {section.review && <ReviewNote text={section.review} />}
                  </section>
                ))}
              </div>

              <LegalCrossLinks
                currentId={doc.id}
                documents={LEGAL_DOCUMENTS.map((entry) => ({
                  id: entry.id,
                  path: entry.path,
                  title: entry.title,
                  purpose: entry.purpose,
                }))}
              />

              <div className="mt-8 rounded-[12px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                  <FileText className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2.2} aria-hidden="true" />
                  Questions about this document
                </p>
                <p className="mt-1 max-w-[60ch] text-[12.5px] leading-[1.65] text-text-muted">
                  Write through the{" "}
                  <Link
                    href="/contact?subject=privacy"
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    contact form
                  </Link>{" "}
                  or email{" "}
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    {SITE.supportEmail}
                  </a>
                  .
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ReviewNote({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-[10px] border border-dashed border-[#D9A63E] bg-[#FEFBF3] px-3 py-2.5 sm:ml-[34px]">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#8A5A0A]">
        <Scale className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
        Requires legal review
      </p>
      <p className="mt-1 text-[12px] leading-[1.6] text-[#7A5209]">{text}</p>
    </div>
  );
}

function formatUpdated(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

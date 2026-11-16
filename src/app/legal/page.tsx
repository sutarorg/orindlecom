import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { LEGAL_DOCUMENTS } from "@/config/legal";
import { SITE } from "@/config/site";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.legal);

/**
 * Legal index.
 *
 * A directory of Orindle's five published policies, written in plain language
 * so readers can find what we store, what rules apply, and how deletion works.
 */
export default function LegalIndexPage() {
  return (
    <SiteShell>
      <section className="border-b border-[var(--brand-border-soft)] pt-10 pb-9 sm:pt-14">
        <div className="container-or">
          <PageIntro
            eyebrow="Legal"
            title="Legal information and policies."
            description="Five published policies covering how Orindle handles personal data, the terms for using the service, cookies, acceptable use, and how deletion works."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="mx-auto max-w-[880px]">
            <ul className="grid gap-3 sm:grid-cols-2">
              {LEGAL_DOCUMENTS.map((doc) => (
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
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#1B7F4B]">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.3} aria-hidden="true" />
                        Published
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            <section className="mt-10 rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-[14px] font-bold tracking-[-0.02em] text-ink">
                <Mail className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.1} aria-hidden="true" />
                Privacy, legal and grievance contact
              </h2>
              <p className="mt-1.5 max-w-[66ch] text-[12.5px] leading-[1.65] text-text-muted">
                Questions about these policies, data access or erasure requests, copyright notices,
                and consumer grievances can be sent through our{" "}
                <Link
                  href="/contact?subject=privacy"
                  className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                >
                  contact form
                </Link>{" "}
                or directly by email to{" "}
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                >
                  {SITE.supportEmail}
                </a>
                . Messages are acknowledged within 48 hours and resolved within one month.
              </p>
            </section>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

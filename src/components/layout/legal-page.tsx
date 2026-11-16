import { SiteShell } from "./site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { SITE } from "@/config/site";

export interface LegalSection {
  heading: string;
  body: string[];
}

/**
 * Shared legal page layout.
 *
 * Used by /privacy and /terms. The copy is deliberately factual and marks the
 * policy as under review rather than presenting invented clauses as final
 * legal terms.
 */
export function LegalPage({
  eyebrow,
  title,
  description,
  updated,
  sections,
  pendingNotice,
}: {
  eyebrow: string;
  title: string;
  description: string;
  updated: string;
  sections: LegalSection[];
  pendingNotice: string;
}) {
  return (
    <SiteShell>
      <section className="pt-10 sm:pt-14 lg:pt-16">
        <div className="container-or">
          <PageIntro eyebrow={eyebrow} title={title} description={description} />
        </div>
      </section>

      <section className="pb-16 pt-9 sm:pb-20 sm:pt-12">
        <div className="container-or">
          <div className="mx-auto max-w-[720px]">
            <div className="rounded-[14px] border border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Status
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-text">{pendingNotice}</p>
              <p className="mt-2 text-[11px] text-text-subtle">Last reviewed {updated}</p>
            </div>

            <div className="mt-8 space-y-7">
              {sections.map((section, index) => (
                <section key={section.heading}>
                  <h2 className="text-[length:var(--brand-body-size)] font-bold tracking-[-0.02em] text-ink">
                    {index + 1}. {section.heading}
                  </h2>
                  <div className="mt-2 space-y-2.5">
                    {section.body.map((paragraph, i) => (
                      <p
                        key={i}
                        className="text-[13px] leading-[1.72] tracking-[-0.01em] text-text-muted"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-9 rounded-[14px] border border-[var(--brand-border)] p-4">
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                Questions about this document can go to{" "}
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="font-semibold text-primary-ink underline underline-offset-2"
                >
                  {SITE.supportEmail}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

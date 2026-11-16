import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { BLOG_ARTICLES, readingMinutes } from "@/config/blog";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";

/**
 * Blog index.
 *
 * The first article is rendered larger than the rest. A uniform grid of ten cards
 * gives a reader no idea where to start; one lead article plus a list does, and it
 * costs nothing in crawlability because every card links to its article directly.
 */

export const metadata: Metadata = approvedMetadata(PAGE_SEO.blog);

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(`${iso}T00:00:00Z`));
}

export default function BlogIndexPage() {
  const [lead, ...rest] = BLOG_ARTICLES;

  return (
    <SiteShell>
      <section className="border-b border-[var(--brand-border-soft)] pt-12 pb-10 sm:pt-16">
        <div className="container-or">
          <PageIntro
            eyebrow="Blog"
            title={PAGE_SEO.blog.h1}
            description="Guides, comparisons and practical advice about cloud storage — written to be checked, with dates on the facts that change."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          {/* Lead article */}
          <Link
            href={`/blog/${lead.slug}`}
            className="group grid overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-surface transition-shadow hover:shadow-[0_18px_44px_rgba(23,29,58,0.09)] lg:grid-cols-[1.05fr_1fr]"
          >
            <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted lg:aspect-auto lg:h-full">
              <Image
                src={lead.image.src}
                alt={lead.image.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-9">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink">
                Latest
              </p>
              <h2 className="mt-3 text-[24px] font-extrabold leading-[1.18] tracking-[-0.03em] text-ink sm:text-[29px]">
                {lead.title}
              </h2>
              <p className="mt-3 text-[15px] leading-[1.65] text-text-muted">{lead.summary}</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-text-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  {formatDate(lead.published)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {readingMinutes(lead)} min read
                </span>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary-ink">
                Read the article
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </Link>

          {/* Remaining articles */}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/blog/${article.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-surface transition-shadow hover:shadow-[0_14px_34px_rgba(23,29,58,0.08)]"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-surface-muted">
                    <Image
                      src={article.image.src}
                      alt={article.image.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="text-[17px] font-bold leading-[1.3] tracking-[-0.02em] text-ink">
                      {article.title}
                    </h2>
                    <p className="mt-2 flex-1 text-[13.5px] leading-[1.6] text-text-muted">
                      {article.summary}
                    </p>
                    <div className="mt-4 flex items-center gap-3 text-[12px] text-text-subtle">
                      <span>{formatDate(article.published)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{readingMinutes(article)} min read</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
    </SiteShell>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { ArticleBlocks } from "@/components/blog/article-blocks";
import { BLOG_ARTICLES, articleBySlug, readingMinutes, relatedArticles } from "@/config/blog";
import { articleSections } from "@/config/blog/types";
import { CANONICAL_ORIGIN } from "@/config/seo";
import { SITE } from "@/config/site";
import { formatDate } from "../page";
import { pageMetadata } from "@/lib/seo";

/**
 * Article page.
 *
 * Structured data is emitted here rather than in a shared component because it has
 * to describe *this* article: a BlogPosting with a real headline, datePublished,
 * dateModified, image and author. Nothing in it is invented — the publisher is the
 * site, and the author is an editorial attribution the company stands behind. There
 * is no fabricated reviewer, no fake credentials and no aggregateRating.
 */

export function generateStaticParams() {
  return BLOG_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articleBySlug(slug);

  if (!article) {
    return pageMetadata({
      title: "Article not found",
      description: "",
      path: `/blog/${slug}`,
      noIndex: true,
    });
  }

  const base = pageMetadata({
    title: article.metaTitle,
    description: article.metaDescription,
    path: `/blog/${article.slug}`,
    keywords: article.metaKeywords,
    image: {
      path: article.image.src,
      width: article.image.width,
      height: article.image.height,
      alt: article.image.alt,
    },
    type: "article",
  });

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: `${article.published}T00:00:00Z`,
      modifiedTime: `${article.updated}T00:00:00Z`,
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) notFound();

  const sections = articleSections(article);
  const related = relatedArticles(article);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${CANONICAL_ORIGIN}/blog/${article.slug}#article`,
        headline: article.title,
        description: article.metaDescription,
        image: [`${CANONICAL_ORIGIN}${article.image.src}`],
        datePublished: `${article.published}T00:00:00Z`,
        dateModified: `${article.updated}T00:00:00Z`,
        inLanguage: "en",
        wordCount: undefined,
        author: {
          "@type": "Organization",
          name: SITE.name,
          url: CANONICAL_ORIGIN,
        },
        publisher: {
          "@type": "Organization",
          name: SITE.name,
          url: CANONICAL_ORIGIN,
          logo: {
            "@type": "ImageObject",
            url: `${CANONICAL_ORIGIN}/icon.png`,
            width: 512,
            height: 512,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${CANONICAL_ORIGIN}/blog/${article.slug}`,
        },
        isPartOf: {
          "@type": "Blog",
          "@id": `${CANONICAL_ORIGIN}/blog#blog`,
          name: `${SITE.name} blog`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${CANONICAL_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${CANONICAL_ORIGIN}/blog` },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: `${CANONICAL_ORIGIN}/blog/${article.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        // Content is built from typed data in this repository, not from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <article>
        {/* Header */}
        <header className="border-b border-[var(--brand-border-soft)] pt-9 pb-8 sm:pt-12">
          <div className="container-or">
            <div className="mx-auto max-w-[760px]">
              <nav aria-label="Breadcrumb" className="mb-5">
                <ol className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-text-subtle">
                  <li>
                    <Link
                      href="/"
                      className="inline-flex min-h-[24px] items-center rounded underline-offset-2 hover:text-ink hover:underline"
                    >
                      Home
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li>
                    <Link
                      href="/blog"
                      className="inline-flex min-h-[24px] items-center rounded underline-offset-2 hover:text-ink hover:underline"
                    >
                      Blog
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                  <li className="font-medium text-text-muted">{article.primaryKeyword}</li>
                </ol>
              </nav>

              <h1 className="text-[30px] font-extrabold leading-[1.14] tracking-[-0.035em] text-ink sm:text-[40px]">
                {article.title}
              </h1>

              <p className="mt-4 text-[16.5px] leading-[1.6] tracking-[-0.012em] text-text-muted">
                {article.summary}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-text-subtle">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                  Published {formatDate(article.published)}
                </span>
                {article.updated !== article.published && (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                    Updated {formatDate(article.updated)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {readingMinutes(article)} min read
                </span>
                {article.factsChecked && (
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    Facts checked {article.factsChecked}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero image */}
        <div className="container-or pt-8">
          <div className="mx-auto max-w-[900px]">
            <div className="relative aspect-[16/9] overflow-hidden rounded-3xl border border-[var(--brand-border)] bg-surface-muted">
              <Image
                src={article.image.src}
                alt={article.image.alt}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 900px"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Body + TOC */}
        <div className="container-or py-10 sm:py-14">
          <div className="mx-auto grid max-w-[1040px] gap-10 lg:grid-cols-[minmax(0,700px)_240px] lg:gap-14">
            <div className="min-w-0">
              <ArticleBlocks blocks={article.body} />

              {article.faqs && article.faqs.length > 0 && (
                <section className="mt-12 border-t border-[var(--brand-border-soft)] pt-8">
                  <h2 className="text-[22px] font-extrabold leading-[1.25] tracking-[-0.03em] text-ink">
                    Frequently asked questions
                  </h2>
                  <dl className="mt-5 space-y-5">
                    {article.faqs.map((faq) => (
                      <div key={faq.question}>
                        <dt className="text-[15.5px] font-semibold leading-[1.5] text-ink">
                          {faq.question}
                        </dt>
                        <dd className="mt-1.5 text-[15px] leading-[1.7] text-text">{faq.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {/* Editorial attribution */}
              <div className="mt-12 rounded-2xl border border-[var(--brand-border)] bg-surface-muted p-5">
                <p className="text-[13px] leading-[1.6] text-text-muted">
                  <span className="font-semibold text-ink">Written and reviewed by the Orindle team.</span>{" "}
                  This article is editorial content published by Orindle, which sells cloud storage.
                  Where a competitor is discussed, the figures come from the provider&apos;s own
                  published pages and are dated in the text. Prices and allowances change; re-check
                  before relying on them.
                </p>
              </div>

              <Link
                href="/blog"
                className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary-ink"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                All articles
              </Link>
            </div>

            {/* Table of contents */}
            {sections.length > 2 && (
              <aside className="hidden lg:block">
                <nav aria-label="On this page" className="sticky top-24">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-subtle">
                    On this page
                  </p>
                  <ul className="mt-3 space-y-2 border-l border-[var(--brand-border)] pl-3.5">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block text-[13px] leading-[1.45] text-text-muted transition-colors hover:text-ink"
                        >
                          {section.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            )}
          </div>
        </div>
      </article>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-[var(--brand-border-soft)] py-12">
          <div className="container-or">
            <div className="mx-auto max-w-[1040px]">
              <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-ink">
                Related reading
              </h2>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {related.map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      href={`/blog/${entry.slug}`}
                      className="group flex items-start gap-3 rounded-2xl border border-[var(--brand-border)] bg-surface p-4 transition-shadow hover:shadow-[0_10px_28px_rgba(23,29,58,0.07)]"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-semibold leading-[1.4] text-ink">
                          {entry.title}
                        </span>
                        <span className="mt-1 block text-[13px] leading-[1.55] text-text-muted">
                          {entry.summary}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary-ink"
              >
                Compare Orindle&#39;s plans
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </SiteShell>
  );
}

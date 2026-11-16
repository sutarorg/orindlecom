import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarClock, ChevronRight, MessageCircleQuestion } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { ArticleBlocks } from "@/components/help/article-blocks";
import { ArticleFeedback } from "@/components/help/article-feedback";
import { HELP_ARTICLES, articleBySlug, articleNeighbours } from "@/config/help/articles";
import { helpCategory } from "@/config/help/categories";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

/**
 * Article page.
 *
 * generateStaticParams runs over the article registry, so a slug that is not in
 * the registry 404s rather than rendering an empty shell — an article URL that
 * exists but says nothing is worse than a clean 404.
 *
 * Reading width is 68ch and the type is one step larger than the marketing site,
 * because help content is read mid-task.
 */

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) return pageMetadata({ title: "Article not found", description: "", path: `/help/articles/${slug}`, noIndex: true });

  return pageMetadata({
    title: article.title,
    description: article.summary,
    path: `/help/articles/${article.slug}`,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) notFound();

  const category = helpCategory(article.category);
  const { previous, next } = articleNeighbours(article.slug);
  const related = (article.related ?? [])
    .map((relatedSlug) => articleBySlug(relatedSlug))
    .filter((entry): entry is NonNullable<ReturnType<typeof articleBySlug>> => Boolean(entry));

  return (
    <SiteShell>
      <section className="border-b border-[var(--brand-border-soft)] pt-8 pb-7 sm:pt-11">
        <div className="container-or">
          <div className="mx-auto max-w-[760px]">
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex flex-wrap items-center gap-1 text-[11.5px] text-text-subtle">
                <li>
                  <Link
                    href="/help"
                    className="rounded underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Help centre
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
                </li>
                <li>
                  <Link
                    href={`/help#${article.category}`}
                    className="rounded underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {category?.title ?? "Articles"}
                  </Link>
                </li>
              </ol>
            </nav>

            <h1 className="text-[27px] font-extrabold leading-[1.16] tracking-[-0.035em] text-ink sm:text-[34px]">
              {article.title}
            </h1>
            <p className="mt-3 max-w-[62ch] text-[15.5px] leading-[1.6] tracking-[-0.01em] text-text-muted">
              {article.summary}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-text-subtle">
              <CalendarClock className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
              Updated{" "}
              <time dateTime={article.updated}>
                {new Date(article.updated).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </p>
          </div>
        </div>
      </section>

      <section className="pb-16 pt-8 sm:pb-20">
        <div className="container-or">
          <div className="mx-auto max-w-[760px]">
            <article className="max-w-[68ch]">
              <ArticleBlocks blocks={article.body} />
            </article>

            <ArticleFeedback slug={article.slug} title={article.title} />

            {related.length > 0 && (
              <section className="mt-9 border-t border-[var(--brand-border)] pt-6">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                  Related articles
                </h2>
                <ul className="mt-3 space-y-1.5">
                  {related.map((entry) => (
                    <li key={entry.slug}>
                      <Link
                        href={`/help/articles/${entry.slug}`}
                        className="group inline-flex min-h-[28px] items-center gap-1.5 text-[13.5px] text-text-muted transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <ArrowRight
                          className="h-3 w-3 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5"
                          strokeWidth={2.4}
                          aria-hidden="true"
                        />
                        {entry.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Prev / next */}
            <nav
              aria-label="Article navigation"
              className="mt-8 grid gap-2 border-t border-[var(--brand-border)] pt-6 sm:grid-cols-2"
            >
              {previous ? (
                <Link
                  href={`/help/articles/${previous.slug}`}
                  className="group flex flex-col rounded-[12px] border border-[var(--brand-border)] p-3.5 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                    <ArrowLeft className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                    Previous
                  </span>
                  <span className="mt-1 text-[13px] font-semibold text-ink">{previous.title}</span>
                </Link>
              ) : (
                <span aria-hidden="true" className="hidden sm:block" />
              )}

              {next && (
                <Link
                  href={`/help/articles/${next.slug}`}
                  className="group flex flex-col items-end rounded-[12px] border border-[var(--brand-border)] p-3.5 text-right transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:col-start-2"
                >
                  <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
                    Next
                    <ArrowRight className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span className="mt-1 text-[13px] font-semibold text-ink">{next.title}</span>
                </Link>
              )}
            </nav>

            <div className="mt-8 flex flex-col gap-3 rounded-[12px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-[12.5px] leading-[1.6] text-text-muted">
                <MessageCircleQuestion
                  className="mt-0.5 h-4 w-4 shrink-0 text-text-subtle"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span>
                  This article didn&rsquo;t answer it? Write to{" "}
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    {SITE.supportEmail}
                  </a>{" "}
                  and a person replies.
                </span>
              </p>
              <Link
                href="/contact?subject=support"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

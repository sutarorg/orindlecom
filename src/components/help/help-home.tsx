import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CreditCard,
  FolderTree,
  HardDrive,
  HelpCircle,
  Share2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { HELP_ARTICLES, articlesInCategory, featuredArticles } from "@/config/help/articles";
import { HELP_CATEGORIES } from "@/config/help/categories";
import type { HelpCategoryId } from "@/config/help/types";
import { SITE } from "@/config/site";
import { HelpSearch } from "./help-search";

/**
 * Help home.
 *
 * One search box, then categories, then the small set of pinned articles. The
 * order is the order people actually need: the search box handles the person who
 * knows the word they want, categories handle the person who doesn't, and the
 * featured list is for the questions that arrive before anybody knows what to
 * search for.
 */

const CATEGORY_ICONS: Record<HelpCategoryId, typeof BookOpen> = {
  "getting-started": Sparkles,
  account: UserRound,
  storage: HardDrive,
  files: FolderTree,
  sharing: Share2,
  billing: CreditCard,
  business: Building2,
};

export function HelpHome() {
  const featured = featuredArticles();

  return (
    <SiteShell>
      {/* Hero with search */}
      <section className="relative overflow-hidden border-b border-[var(--brand-border-soft)] pt-12 pb-10 sm:pt-16 sm:pb-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.6),rgba(223,244,242,0.3)_52%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <div className="mx-auto max-w-[680px] text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink">
              Help centre
            </p>
            <h1 className="mt-3 text-[32px] font-extrabold leading-[1.1] tracking-[-0.04em] text-ink sm:text-[42px]">
              How can we help?
            </h1>
            <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-[1.6] text-text-muted">
              {HELP_ARTICLES.length} articles across {HELP_CATEGORIES.length} topics. Every one
              describes what the product actually does.
            </p>
            <div className="mx-auto mt-6 max-w-[600px] text-left">
              <HelpSearch />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-subtle">
              Browse by topic
            </h2>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HELP_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.id];
                const count = articlesInCategory(category.id).length;
                return (
                  <li key={category.id}>
                    <Link
                      href={`/help#${category.id}`}
                      className="group flex h-full flex-col rounded-[14px] border border-[var(--brand-border)] bg-white p-4 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary-ink"
                      >
                        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      </span>
                      <span className="mt-2.5 flex items-center gap-1.5 text-[14px] font-bold tracking-[-0.02em] text-ink">
                        {category.title}
                        <ArrowRight
                          className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                          strokeWidth={2.2}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-0.5 flex-1 text-[12.5px] leading-[1.55] text-text-muted">
                        {category.description}
                      </span>
                      <span className="mt-2 text-[10.5px] font-medium text-text-subtle">
                        {count} {count === 1 ? "article" : "articles"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="border-t border-[var(--brand-border-soft)] py-10 sm:py-12">
          <div className="container-or">
            <div className="mx-auto max-w-[1000px]">
              <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-text-subtle">
                <BookOpen className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                Start here
              </h2>
              <ul className="mt-4 divide-y divide-[var(--brand-border)] border-y border-[var(--brand-border)]">
                {featured.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/help/articles/${article.slug}`}
                      className="group flex items-center gap-3 py-3 transition-colors hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink transition-colors group-hover:text-primary-ink">
                          {article.title}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-[1.55] text-text-muted">
                          {article.summary}
                        </span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5"
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Every article, by category */}
      <section className="border-t border-[var(--brand-border-soft)] py-10 sm:py-14">
        <div className="container-or">
          <div className="mx-auto max-w-[1000px]">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-subtle">
              All articles
            </h2>

            <div className="mt-5 grid gap-8 sm:grid-cols-2 lg:gap-x-12">
              {HELP_CATEGORIES.map((category) => {
                const articles = articlesInCategory(category.id);
                if (articles.length === 0) return null;
                return (
                  <section key={category.id} id={category.id} className="scroll-mt-24">
                    <h3 className="text-[13px] font-bold tracking-[-0.02em] text-ink">
                      {category.title}
                    </h3>
                    <p className="mt-0.5 text-[11.5px] text-text-subtle">{category.description}</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {articles.map((article) => (
                        <li key={article.slug}>
                          <Link
                            href={`/help/articles/${article.slug}`}
                            className="inline-flex min-h-[26px] items-center gap-1.5 text-[13px] text-text-muted underline-offset-2 transition-colors hover:text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {article.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Not answered */}
      <section className="pb-16 sm:pb-20">
        <div className="container-or">
          <div className="mx-auto max-w-[1000px]">
            <div className="flex flex-col gap-4 rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-bold tracking-[-0.02em] text-ink">
                  <HelpCircle className="h-4 w-4 text-text-subtle" strokeWidth={2.1} aria-hidden="true" />
                  Still stuck?
                </p>
                <p className="mt-1 max-w-[52ch] text-[13px] leading-[1.6] text-text-muted">
                  Send it through the contact form and a person answers. Or email{" "}
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    {SITE.supportEmail}
                  </a>
                  .
                </p>
              </div>
              <Link
                href="/contact?subject=support"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[13.5px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Contact support
                <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

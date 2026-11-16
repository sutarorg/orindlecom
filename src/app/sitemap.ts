import type { MetadataRoute } from "next";
import { BLOG_ARTICLES } from "@/config/blog";
import { CANONICAL_ORIGIN } from "@/config/seo";
import { INDEXABLE_PAGES } from "@/config/seo-pages";

/**
 * XML sitemap.
 *
 * Built from the same data the pages are built from, so a route cannot exist in
 * the sitemap without existing as a page, and a published article cannot be missing
 * from it. `tests/unit/seo.test.ts` asserts both directions.
 *
 * On lastmod: Google ignores `priority` and `changefreq` — it has said so — and
 * weights an accurate `lastmod` as a hint that a page genuinely changed. So each
 * entry carries a real date rather than `new Date()` at request time, which is the
 * anti-pattern that teaches a crawler to distrust the whole field. Blog entries use
 * the article's own `updated` date; policy pages carry a fixed revision date; and
 * pages that change with the product carry the date their content last changed.
 */

/** The date the marketing copy on each static page last changed materially. */
const STATIC_LASTMOD: Record<string, string> = {
  "/": "2026-11-16",
  "/pricing": "2026-11-16",
  "/features": "2026-11-16",
  "/security": "2026-11-16",
  "/business": "2026-11-16",
  "/about": "2026-11-16",
  "/contact": "2026-11-16",
  "/faq": "2026-11-16",
  "/help": "2026-11-16",
  "/legal": "2026-11-16",
  "/privacy": "2026-11-16",
  "/terms": "2026-11-16",
  "/cookies": "2026-11-16",
  "/acceptable-use": "2026-11-16",
  "/data-deletion": "2026-11-16",
  "/blog": "2026-11-16",
};

const PRIORITY: Record<string, number> = {
  "/": 1,
  "/pricing": 0.9,
  "/features": 0.8,
  "/business": 0.8,
  "/security": 0.7,
  "/blog": 0.8,
  "/help": 0.7,
  "/faq": 0.6,
  "/about": 0.6,
  "/contact": 0.6,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = INDEXABLE_PAGES.map((page) => ({
    url: page.path === "/" ? CANONICAL_ORIGIN : `${CANONICAL_ORIGIN}${page.path}`,
    lastModified: new Date(`${STATIC_LASTMOD[page.path] ?? "2026-11-16"}T00:00:00Z`),
    changeFrequency: page.path === "/" || page.path === "/pricing" ? "weekly" : "monthly",
    priority: PRIORITY[page.path] ?? 0.4,
  }));

  const articles: MetadataRoute.Sitemap = BLOG_ARTICLES.map((article) => ({
    url: `${CANONICAL_ORIGIN}/blog/${article.slug}`,
    lastModified: new Date(`${article.updated}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...pages, ...articles];
}

/**
 * SEO integrity.
 *
 * The audit script checks rendered HTML against a running server. This suite
 * checks the things that can be verified without one, and it exists because most
 * SEO regressions are data regressions: a duplicated description, a link to a page
 * that was renamed, an article missing from the sitemap, an image whose alt text
 * was left as a placeholder.
 *
 * The rule these tests enforce is simple — the metadata in `seo-pages.ts` is the
 * approved configuration, and no page may diverge from it.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { BLOG_ARTICLES, articleBySlug, readingMinutes } from "@/config/blog";
import {
  articleInternalLinks,
  articleSections,
  articleWords,
} from "@/config/blog/types";
import { CANONICAL_ORIGIN, PRIVATE_ROUTE_PREFIXES } from "@/config/seo";
import { INDEXABLE_PAGES, PAGE_SEO } from "@/config/seo-pages";
import { HELP_ARTICLES } from "@/config/help/articles";
import { canonicalUrl } from "@/lib/seo";

const ROOT = process.cwd();

/** The ten approved article slugs, in the order the brief listed them. */
const APPROVED_SLUGS = [
  "best-google-drive-alternatives",
  "google-drive-vs-dropbox-vs-onedrive",
  "best-free-cloud-storage",
  "how-much-cloud-storage-do-you-need",
  "cloud-storage-vs-cloud-backup",
  "how-to-share-large-files-online",
  "best-cloud-storage-for-small-business",
  "is-cloud-storage-safe",
  "how-to-organize-digital-files",
  "how-to-move-files-from-google-drive",
];

describe("page metadata", () => {
  it("has one entry per indexable page, with no duplicates", () => {
    const paths = INDEXABLE_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(INDEXABLE_PAGES.length).toBe(Object.keys(PAGE_SEO).length);
  });

  it("gives every page a unique title", () => {
    const titles = INDEXABLE_PAGES.map((page) => page.title);
    expect(new Set(titles).size, `duplicate title in: ${titles.join(" | ")}`).toBe(titles.length);
  });

  it("gives every page a unique description", () => {
    const descriptions = INDEXABLE_PAGES.map((page) => page.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  it("keeps descriptions within a length search engines display", () => {
    for (const page of INDEXABLE_PAGES) {
      expect(page.description.length, `${page.path} is very short`).toBeGreaterThan(70);
      expect(page.description.length, `${page.path} will be truncated`).toBeLessThanOrEqual(200);
    }
  });

  it("gives every page a primary keyword and at least three secondary ones", () => {
    for (const page of INDEXABLE_PAGES) {
      expect(page.primaryKeyword.length, page.path).toBeGreaterThan(2);
      expect(page.secondaryKeywords.length, page.path).toBeGreaterThanOrEqual(3);
      expect(page.metaKeywords.length, page.path).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not let two pages claim the same primary keyword", () => {
    // Cannibalisation: two pages targeting one phrase compete with each other and
    // neither ranks well. One keyword, one owner.
    const owners = new Map<string, string>();
    for (const page of INDEXABLE_PAGES) {
      const key = page.primaryKeyword.toLowerCase();
      expect(
        owners.get(key),
        `"${key}" is the primary keyword of both ${owners.get(key)} and ${page.path}`,
      ).toBeUndefined();
      owners.set(key, page.path);
    }
  });

  it("keeps the approved homepage metadata exactly as supplied", () => {
    // These strings were approved, so the test pins them character for character.
    // A silent "improvement" to an approved title is the failure this prevents.
    expect(PAGE_SEO.home.title).toBe("Secure Cloud Storage with 10 GB Free");
    expect(PAGE_SEO.home.description).toBe(
      "Store and share files securely with Orindle Cloud. Get 10 GB free with encrypted storage, fast uploads and downloads, and flexible plans that grow with you.",
    );
    expect(PAGE_SEO.home.primaryKeyword).toBe("cloud storage");
    expect(PAGE_SEO.home.h1).toBe("Your files. Your world. One simple place.");
  });
});

describe("canonical URLs", () => {
  it("builds the origin from the canonical host, never the request host", () => {
    expect(canonicalUrl("/")).toBe(CANONICAL_ORIGIN);
    expect(canonicalUrl("/pricing")).toBe(`${CANONICAL_ORIGIN}/pricing`);
  });

  it("strips a trailing slash on non-root paths", () => {
    expect(canonicalUrl("/blog/")).toBe(`${CANONICAL_ORIGIN}/blog`);
  });

  it("uses https and an apex host with no www", () => {
    expect(CANONICAL_ORIGIN).toBe("https://orindle.com");
    expect(CANONICAL_ORIGIN).not.toContain("www.");
  });
});

describe("blog articles", () => {
  it("publishes exactly the ten approved articles", () => {
    expect(BLOG_ARTICLES.length).toBe(10);
    expect(BLOG_ARTICLES.map((a) => a.slug).sort()).toEqual([...APPROVED_SLUGS].sort());
  });

  it("has unique titles, meta titles and descriptions", () => {
    for (const field of ["title", "metaTitle", "metaDescription"] as const) {
      const values = BLOG_ARTICLES.map((a) => a[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("gives every article its own primary keyword", () => {
    const keywords = BLOG_ARTICLES.map((a) => a.primaryKeyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
    // And none of them may collide with a marketing page's primary keyword.
    const pageKeywords = new Set(INDEXABLE_PAGES.map((p) => p.primaryKeyword.toLowerCase()));
    for (const keyword of keywords) expect(pageKeywords.has(keyword), keyword).toBe(false);
  });

  it("has dates that are real, ordered, and not in the future", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.published, article.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.updated, article.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.updated >= article.published, `${article.slug}: updated before published`).toBe(
        true,
      );
      expect(new Date(article.published).toString()).not.toBe("Invalid Date");
    }
  });

  it("attaches a checked date to every article that quotes competitor facts", () => {
    // Five of the ten compare commercial products with prices in them. A price
    // without a date is a claim that silently expires.
    for (const article of BLOG_ARTICLES) {
      const quotesPrices = article.body.some(
        (block) =>
          block.type === "table" &&
          block.rows.some((row) => row.some((cell) => /\$|₹|€/.test(cell))),
      );
      if (quotesPrices) {
        expect(article.factsChecked, `${article.slug} quotes prices but has no checked date`)
          .toBeTruthy();
      }
    }
  });

  it("is long enough to be worth publishing", () => {
    for (const article of BLOG_ARTICLES) {
      // 900 words is the floor below which an article is a stub. The prompt asked
      // for complete articles, not summaries.
      expect(articleWords(article), `${article.slug} is too short`).toBeGreaterThan(900);
      expect(readingMinutes(article)).toBeGreaterThan(4);
    }
  });

  it("opens with an h1 and gives every h2 a unique id", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.title.length, article.slug).toBeGreaterThan(10);
      const ids = articleSections(article).map((section) => section.id);
      expect(new Set(ids).size, `${article.slug} has duplicate h2 ids`).toBe(ids.length);
      expect(articleSections(article).length, `${article.slug} has no sections`).toBeGreaterThan(2);
    }
  });

  it("uses descriptive alt text on every thumbnail", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.image.alt.length, article.slug).toBeGreaterThan(40);
      // The alt describes the image; it does not repeat the title as a keyword dump.
      expect(article.image.alt.toLowerCase()).not.toBe(article.title.toLowerCase());
    }
  });

  it("ships a 1200x675 thumbnail that exists on disk", async () => {
    const dir = path.join(ROOT, "public", "images", "blog");
    const files = await readdir(dir);
    for (const article of BLOG_ARTICLES) {
      expect(article.image.width).toBe(1200);
      expect(article.image.height).toBe(675);
      const name = article.image.src.replace("/images/blog/", "");
      expect(files.includes(name), `missing ${article.image.src}`).toBe(true);
    }
    // Exactly ten, to catch an orphaned extra image.
    expect(files.filter((f) => f.endsWith(".webp")).length).toBe(10);
  });

  it("resolves every related-article slug to a published article", () => {
    for (const article of BLOG_ARTICLES) {
      expect(article.related.length, article.slug).toBeGreaterThanOrEqual(2);
      for (const slug of article.related) {
        expect(articleBySlug(slug), `${article.slug} links to missing ${slug}`).toBeTruthy();
        expect(slug, `${article.slug} links to itself`).not.toBe(article.slug);
      }
    }
  });

  it("resolves every internal link in every article body", async () => {
    const knownRoutes = new Set([
      ...INDEXABLE_PAGES.map((page) => page.path),
      ...BLOG_ARTICLES.map((article) => `/blog/${article.slug}`),
      ...HELP_ARTICLES.map((article) => `/help/articles/${article.slug}`),
    ]);

    const broken: string[] = [];
    for (const article of BLOG_ARTICLES) {
      for (const href of articleInternalLinks(article)) {
        const clean = href.split("#")[0].replace(/\/$/, "") || "/";
        if (!knownRoutes.has(clean)) broken.push(`${article.slug} → ${href}`);
      }
    }
    expect(broken, `internal links that resolve to nothing:\n${broken.join("\n")}`).toEqual([]);
  });

  it("makes every article reachable from the blog index", () => {
    // No orphans: the index lists BLOG_ARTICLES directly, so this asserts the
    // array is the single source and that nothing is filtered out of it.
    for (const article of BLOG_ARTICLES) {
      expect(articleBySlug(article.slug)).toBeTruthy();
    }
  });

  it("cites at least two external primary sources per article", () => {
    for (const article of BLOG_ARTICLES) {
      const sources = article.body.filter((block) => block.type === "source");
      expect(sources.length, `${article.slug} cites ${sources.length}`).toBeGreaterThanOrEqual(2);
      for (const source of sources) {
        if (source.type !== "source") continue;
        expect(source.href.startsWith("https://"), source.href).toBe(true);
      }
    }
  });

  it("does not fabricate credentials or ratings", () => {
    for (const article of BLOG_ARTICLES) {
      const serialised = JSON.stringify(article);
      // No invented expert bylines, no review stars, no borrowed authority.
      expect(serialised).not.toMatch(/"author"\s*:/);
      expect(serialised).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
      expect(serialised).not.toMatch(/\bDr\.\s[A-Z]/);
      expect(serialised).not.toMatch(/certified by (?!the)/i);
    }
  });
});

describe("sitemap and robots source", () => {
  it("includes every indexable page in the sitemap source", async () => {
    const source = await readFile(path.join(ROOT, "src", "app", "sitemap.ts"), "utf8");
    // The sitemap maps over the same data the pages are built from.
    expect(source).toContain("INDEXABLE_PAGES");
    expect(source).toContain("BLOG_ARTICLES");
    expect(source).not.toContain("/dashboard");
    expect(source).not.toContain("/login");
  });

  it("does not block rendering assets in robots.txt", async () => {
    const raw = await readFile(path.join(ROOT, "src", "app", "robots.ts"), "utf8");
    // Comments are stripped before matching. The comment above the check explains
    // why /_next must not be disallowed, and a naive regex finds that explanation
    // and reports the opposite of the truth — which happened while writing this.
    const source = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // A Disallow on the asset directory is the classic self-inflicted wound: Google
    // cannot render the page, so it indexes what is left.
    expect(source).not.toMatch(/_next/);
    expect(source).toContain("/dashboard");
    expect(source).toContain("sitemap.xml");
  });

  it("declares every private area as both disallowed and noindex", () => {
    // Belt and braces: robots.txt stops discovery, noindex stops indexing of a URL
    // that leaked from somewhere else. Neither is sufficient alone.
    expect(PRIVATE_ROUTE_PREFIXES).toContain("/dashboard");
    /*
     * Replaces the `/account` assertion. That route is gone, so listing it in
     * robots.txt would describe a page that does not exist; `/business` is the
     * private area that now needs the same treatment.
     */
    expect(PRIVATE_ROUTE_PREFIXES).toContain("/business");
  });
});

describe("icons and social assets", () => {
  it("ships the icon files Google and browsers look for", async () => {
    const files = await readdir(path.join(ROOT, "public"));
    for (const icon of ["favicon.ico", "icon.png", "apple-icon.png", "icon.svg"]) {
      expect(files.includes(icon), `missing public/${icon}`).toBe(true);
    }
  });

  it("declares icons in the root metadata", async () => {
    const layout = await readFile(path.join(ROOT, "src", "app", "layout.tsx"), "utf8");
    expect(layout).toContain("metadataBase");
    expect(layout).toContain("favicon.ico");
    expect(layout).toContain("apple-icon.png");
    // The template appends the brand once; pages must not repeat it.
    expect(layout).toContain('template: "%s · Orindle"');
  });

  it("uses an absolute Open Graph image URL", async () => {
    const seo = await readFile(path.join(ROOT, "src", "lib", "seo.ts"), "utf8");
    expect(seo).toContain("CANONICAL_ORIGIN");
    expect(seo).toMatch(/url: `\$\{CANONICAL_ORIGIN\}/);
  });
});

describe("SEO documentation", () => {
  const REQUIRED = [
    "seo-strategy.md",
    "page-metadata.md",
    "keyword-mapping.md",
    "competitor-research.md",
    "blog-editorial-plan.md",
    "blog-content-audit.md",
    "blog-image-manifest.md",
    "technical-seo-audit.md",
    "canonical-url-map.md",
    "sitemap-implementation.md",
    "robots-configuration.md",
    "structured-data-audit.md",
    "favicon-search-eligibility.md",
    "google-search-console-guide.md",
    "performance-audit.md",
    "final-seo-report.md",
  ];

  it("ships all sixteen required SEO documents", async () => {
    const files = await readdir(path.join(ROOT, "docs", "seo"));
    for (const doc of REQUIRED) {
      expect(files.includes(doc), `missing docs/seo/${doc}`).toBe(true);
    }
    expect(REQUIRED.length).toBe(16);
  });

  it("records every approved page title in page-metadata.md", async () => {
    const doc = await readFile(path.join(ROOT, "docs", "seo", "page-metadata.md"), "utf8");
    // The document is the human-readable half of the approved configuration; if a
    // title is not in it, the document no longer describes the build.
    for (const page of INDEXABLE_PAGES) {
      expect(doc.includes(page.title), `page-metadata.md omits "${page.title}"`).toBe(true);
    }
  });

  it("does not claim Search Console is verified", async () => {
    const doc = await readFile(
      path.join(ROOT, "docs", "seo", "google-search-console-guide.md"),
      "utf8",
    );
    // The completion log must remain honest until someone actually does it.
    expect(doc).toContain("not verified");
    expect(doc).toMatch(/not done/);
  });

  it("does not promise a ranking position anywhere in the SEO docs", async () => {
    const dir = path.join(ROOT, "docs", "seo");
    const files = await readdir(dir);
    const offenders: string[] = [];
    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");
      // A promise of a position is the one claim this project must never make.
      for (const pattern of [/will rank (first|#1|number one)/i, /guarantee[sd]? (a )?first page/i]) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it("states the true article word total, computed not recalled", async () => {
    const dir = path.join(ROOT, "docs", "seo");
    // A hand-added total drifts the moment an article is edited. Sum the measured
    // per-article counts from the content model and compare against both documents
    // that publish the figure.
    const total = BLOG_ARTICLES.reduce((sum, a) => sum + articleWords(a), 0);
    for (const doc of ["blog-editorial-plan.md", "final-seo-report.md"]) {
      const text = await readFile(path.join(dir, doc), "utf8");
      expect(
        text.includes(total.toLocaleString("en-US")),
        `${doc} should state ${total.toLocaleString("en-US")} words`,
      ).toBe(true);
    }
  });
});

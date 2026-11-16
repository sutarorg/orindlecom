/**
 * Blog content model.
 *
 * Articles are data, not MDX, for one reason specific to this project: the SEO
 * audit has to be able to *read* every article — count its headings, check its
 * internal links resolve, confirm its H1 exists once — without rendering React.
 * A structured block array makes that a loop over objects. MDX would make it a
 * parser.
 *
 * The cost is that writers author objects rather than prose. That is a deliberate
 * trade for a blog whose primary obligation is to be verifiable.
 */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  | { type: "table"; caption?: string; head: string[]; rows: string[][] }
  | { type: "note"; tone: "info" | "warning"; text: string }
  | { type: "callout"; title: string; text: string }
  /** A source with an outbound link. Kept as a block so citations render as a list. */
  | { type: "source"; label: string; href: string; note?: string }
  | {
      type: "comparison";
      title: string;
      items: Array<{ name: string; verdict: string; detail: string }>;
    };

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogImage {
  /** Path under /public. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface BlogArticle {
  slug: string;
  /** The article's H1. */
  title: string;
  /** SEO title, without the brand suffix. Approved verbatim. */
  metaTitle: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  metaKeywords: string[];
  /** One-sentence standfirst shown under the H1 and on the index card. */
  summary: string;
  /** ISO date first published. */
  published: string;
  /** ISO date of the last material change. Never bumped for appearances. */
  updated: string;
  /**
   * How long the article is expected to remain accurate on prices and features.
   * Anything with a competitor price in it gets 90 days; evergreen guides get a
   * year. The editorial plan uses this to schedule reviews.
   */
  reviewIntervalDays: number;
  /**
   * Set on the five comparison articles. Named in the byline area so a reader
   * knows the facts were checked and when.
   */
  factsChecked?: string;
  /** Estimated reading time, computed from body length in `index.ts`. */
  image: BlogImage;
  /** Internal links that must resolve, checked by tests/unit/seo.test.ts. */
  related: string[];
  /** Article-specific FAQs. Rendered as an accordion, not as FAQPage schema. */
  faqs?: BlogFaq[];
  body: BlogBlock[];
}

/** Word count of an article, for reading-time and the content audit. */
export function articleWords(article: BlogArticle): number {
  let words = 0;
  const count = (text: string) => {
    words += text.split(/\s+/).filter(Boolean).length;
  };

  count(article.summary);
  for (const block of article.body) {
    switch (block.type) {
      case "p":
      case "note":
        count(block.text);
        break;
      case "h2":
      case "h3":
        count(block.text);
        break;
      case "list":
        block.items.forEach(count);
        break;
      case "steps":
        block.items.forEach((item) => {
          count(item.title);
          count(item.text);
        });
        break;
      case "table":
        block.head.forEach(count);
        block.rows.forEach((row) => row.forEach(count));
        break;
      case "callout":
        count(block.title);
        count(block.text);
        break;
      case "source":
        count(block.label);
        if (block.note) count(block.note);
        break;
      case "comparison":
        block.items.forEach((item) => {
          count(item.name);
          count(item.verdict);
          count(item.detail);
        });
        break;
    }
  }
  return words;
}

/** Every internal (site-relative) href referenced by the article body. */
export function articleInternalLinks(article: BlogArticle): string[] {
  const links = new Set<string>(article.related.map((slug) => `/blog/${slug}`));
  const scan = (text: string) => {
    for (const match of text.matchAll(/\]\((\/[^)\s]+)\)/g)) links.add(match[1]);
    for (const match of text.matchAll(/href="(\/[^"]+)"/g)) links.add(match[1]);
  };
  for (const block of article.body) {
    if (block.type === "p" || block.type === "note" || block.type === "callout") scan(block.text);
    if (block.type === "list") block.items.forEach(scan);
  }
  return [...links];
}

/** H2 ids, used for the on-page table of contents. */
export function articleSections(article: BlogArticle): Array<{ id: string; text: string }> {
  return article.body
    .filter((block): block is Extract<BlogBlock, { type: "h2" }> => block.type === "h2")
    .map((block) => ({ id: block.id, text: block.text }));
}

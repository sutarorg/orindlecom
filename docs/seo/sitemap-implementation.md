# Sitemap Implementation

**URL:** `https://orindle.com/sitemap.xml`
**Source:** `src/app/sitemap.ts` (Next.js App Router `MetadataRoute.Sitemap`)
**URLs:** 26 — 16 pages, 10 articles

---

## How it is built

The sitemap is generated from the same data the pages are built from, not from a
hand-maintained list:

```ts
const pages = INDEXABLE_PAGES.map(...)   // src/config/seo-pages.ts
const articles = BLOG_ARTICLES.map(...)  // src/config/blog/index.ts
return [...pages, ...articles]
```

This is the design decision that matters. A hand-written sitemap drifts in one
direction only — it accumulates URLs for pages that were renamed or deleted, and it
omits pages that were added. Generating it from the route data means:

- a page cannot be in the sitemap without existing;
- a published article cannot be missing from it;
- adding an article publishes it in the index, the sitemap and the structured data in
  one edit;
- removing an article removes all three.

`tests/unit/seo.test.ts` asserts the sitemap source reads both arrays and contains no
dashboard or login URLs.

---

## What is included

All 16 public pages plus all 10 published articles. Nothing else.

### What is excluded, and why

| Excluded | Reason |
| --- | --- |
| `/dashboard/*` | Behind authentication; no indexable content |
| `/account` | Same |
| `/login`, `/signup`, `/sign-in`, `/sign-up` | No unique content; noindex |
| `/forgot-password`, `/reset-password`, `/verify-email` | No unique content; noindex |
| `/auth/*` | Route handler, not a page |
| `/api/*` | JSON endpoints |
| `/help/articles/{slug}` | Indexable and linked, but held back to keep the sitemap focused while the site is new — see `canonical-url-map.md` |
| Draft articles | There is no draft state; an article not in `BLOG_ARTICLES` is not published anywhere |

---

## On `lastmod`, `priority` and `changefreq`

**`lastmod` is the only one Google uses, and only as a hint.** Each entry carries a
date that reflects a real change:

- Articles use their own `updated` field.
- Static pages use a fixed revision date from `STATIC_LASTMOD`.

**The previous implementation used `new Date()` at request time.** That told Google every
URL changed on every crawl. The consequence is not neutral: a `lastmod` that is always
now is indistinguishable from noise, and the crawler learns to ignore the field for the
whole site. An inaccurate `lastmod` is worse than none.

**`priority` and `changefreq` are emitted but ignored.** Google has said so publicly.
They are set to sensible values for human readers of the XML and are not treated as
levers anywhere in this codebase — no test asserts a priority value, and no document
claims they affect ranking.

---

## Generated output

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://orindle.com</loc>
    <lastmod>2026-11-16T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
  <url>
    <loc>https://orindle.com/pricing</loc>
    <lastmod>2026-11-16T00:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  ...
  <url>
    <loc>https://orindle.com/blog/best-google-drive-alternatives</loc>
    <lastmod>2026-11-16T00:00:00.000Z</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
```

---

## Verification

The audit script fetches `/sitemap.xml` and asserts:

1. it returns 200;
2. every one of the 26 public routes appears;
3. no URL contains `/dashboard`, `/api/`, `/login` or `/signup`;
4. `<lastmod>` is present on the document at all.

```
sitemap: 26 URLs, all public routes present
```

Reproduce with:

```bash
npx next build && npx next start -p 3000
curl -s localhost:3000/sitemap.xml | head -20
node scripts/seo-audit.mjs --base http://localhost:3000
```

---

## Submission

The sitemap has **not** been submitted to Google Search Console, because doing so
requires authorised access to a verified property and that does not exist yet. The exact
steps are in `google-search-console-guide.md`.

Once the property is verified:

1. Search Console → Sitemaps → enter `sitemap.xml`
2. Confirm the status reads "Success" and the discovered URL count is 26
3. Do not resubmit repeatedly — a sitemap is not a queue and resubmitting does not
   speed anything up

---

## Maintenance

| Trigger | Action |
| --- | --- |
| New page added | Add to `INDEXABLE_PAGES`; sitemap updates automatically |
| New article published | Add to `BLOG_ARTICLES`; sitemap, index and structured data update together |
| Article materially updated | Bump its `updated` date; `lastmod` follows |
| Page deleted | Remove from `INDEXABLE_PAGES` **and** add a 301 from the old path |
| Site exceeds 50,000 URLs | Split with `generateSitemaps()` — not a concern at 26 |

# Structured Data Audit

**Types implemented:** `WebSite`, `Organization`, `BlogPosting`, `BreadcrumbList`
**Validation:** JSON parse of every block on all 26 public routes, in
`scripts/seo-audit.mjs`. **Result: 26/26 valid, 0 parse errors.**

---

## What is emitted, and where

| Type | Route | Count |
| --- | --- | --- |
| `WebSite` | `/` | 1 |
| `Organization` | `/` | 1 |
| `BlogPosting` | Each article | 10 |
| `BreadcrumbList` | Each article | 10 |

No other type is emitted anywhere. There is no `Product`, `Offer`, `Review`,
`AggregateRating` or `FAQPage` markup in this codebase, and the reason for each
omission is below.

---

## WebSite

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://orindle.com/#website",
  "name": "Orindle",
  "alternateName": "Orindle Cloud",
  "url": "https://orindle.com",
  "description": "Store and share files securely with Orindle Cloud...",
  "inLanguage": "en",
  "publisher": { "@id": "https://orindle.com/#organization" }
}
```

**Why:** it establishes the site entity and ties it to the Organization node. The
`alternateName` covers "Orindle Cloud", which appears in the desired meta description.

**What is absent:** a `potentialAction`/`SearchAction` block. Google's sitelinks
search box requires a real on-site search endpoint; this site has no public search, so
declaring one would be a false statement that Google can verify.

---

## Organization

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://orindle.com/#organization",
  "name": "Orindle",
  "url": "https://orindle.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://orindle.com/icon.png",
    "width": 512,
    "height": 512
  },
  "email": "tejassutar.business@gmail.com",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "tejassutar.business@gmail.com",
    "url": "https://orindle.com/contact",
    "availableLanguage": ["en"]
  }
}
```

**Every property is verifiable:**
- `logo` points at a file that exists at exactly that path (audited).
- `email` is the support address published on the contact page.
- No `address`, no `legalName`, no `foundingDate`, no `vatID`, no `sameAs` list of social
  accounts that may not exist.

**Deliberately omitted:** `sameAs`. The site config carries social URLs, but pointing
structured data at profiles that may not carry matching branding is a weak signal that
can create entity confusion. It should be added only once those profiles are real and
active.

---

## BlogPosting

```json
{
  "@type": "BlogPosting",
  "@id": "https://orindle.com/blog/{slug}#article",
  "headline": "...",
  "description": "...",
  "image": ["https://orindle.com/images/blog/{name}.webp"],
  "datePublished": "2026-11-16T00:00:00Z",
  "dateModified": "2026-11-16T00:00:00Z",
  "inLanguage": "en",
  "author": { "@type": "Organization", "name": "Orindle", "url": "https://orindle.com" },
  "publisher": { "@type": "Organization", ..., "logo": {...} },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "..." },
  "isPartOf": { "@type": "Blog", "@id": "https://orindle.com/blog#blog" }
}
```

**Every value comes from the article data**, so the structured data cannot disagree with
the page: the headline is the article title, the dates are the article's own published
and updated fields, and the image is the thumbnail the page actually renders.

**On `author`:** it is the Organization, and that is honest. The articles are editorial
content published by the company, which accepts responsibility for them. No individual
byline was invented, because inventing one would be fabricating a credential. There is
no `Person` node anywhere in this markup.

---

## BreadcrumbList

```json
{
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://orindle.com" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://orindle.com/blog" },
    { "@type": "ListItem", "position": 3, "name": "...", "item": "https://orindle.com/blog/{slug}" }
  ]
}
```

It mirrors the visible breadcrumb on the page exactly — Home / Blog / article. Structured
data that describes a trail the page does not show is a mismatch Google may flag.

---

## What is deliberately not implemented

### FAQPage

Several articles have an FAQ section, and the `/faq` page is entirely questions. None of
it is marked up as `FAQPage`, because:

1. Since 2023 Google restricts FAQ rich results to authoritative government and health
   sites. Commercial sites are eligible to have the markup *ignored*, not displayed.
2. Marking up an FAQ purely to chase a rich result that will not be granted is the
   pattern Google describes as spammy structured data.
3. The content is already on the page and readable. The markup adds a risk and no
   benefit.

If Google's policy changes, adding it is a one-component change.

### Product / Offer

`/pricing` lists six plans with prices. There is no `Product` or `Offer` markup, because
a `Product` requires a merchant listing to be meaningful, and an `Offer` without one
invites a "missing field" or "price mismatch" report once Google compares it against
what it can see. The prices are in the page and in the sitemap's `lastmod` discipline;
they are not in schema.

### Review / AggregateRating

Never. There are no reviews, no ratings and no testimonials, so any markup would be
fabricated. This is both an honesty requirement and a guideline violation.

### HowTo

Articles 4, 6, 9 and 10 contain step-by-step content. `HowTo` rich results were
deprecated in 2023 and are no longer displayed. The steps are marked up as semantic
`<ol>` elements, which is what actually helps a reader and a parser.

---

## Validation performed

`scripts/seo-audit.mjs`:

1. extracts every `<script type="application/ld+json">` block on all 26 routes;
2. `JSON.parse`s each one and reports a parse error as a failure;
3. walks the tree (including `@graph` and nested objects) and collects every `@type`;
4. asserts the set of types is non-empty for the homepage and every article.

```
/                        WebSite, Organization, ImageObject
/blog/{slug}             BlogPosting, Organization, ImageObject, WebPage, Blog, BreadcrumbList, ListItem
```

The audit does not claim Google Rich Results Test parity — that tool requires a public
URL. Run it against production after deployment; the expected result is "no errors" and
"no rich results detected" for the article pages, which is correct for `BlogPosting`
without an `Article` enhancement.

`tests/unit/seo.test.ts` additionally asserts that no article data contains
`aggregateRating`, `ratingValue`, `reviewCount` or an `author` field — the data layer
cannot carry the kinds of fabricated claim the markup must never express.

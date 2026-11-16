# Final SEO Report

**Date:** 16 November 2026
**Scope:** complete SEO implementation for orindle.com — metadata, blog, imagery,
technical foundation, structured data, documentation and audit.

This report is written to be checked. Every claim names the command or file that proves
it, and §8 lists what is **not** done.

---

## 1. Evidence

Run from a clean `npm install`:

```
npx tsc --noEmit                                  clean
npm run lint                                      0 errors, 48 warnings (pre-existing)
npx next build                                    clean, 26 pages + 38 API routes
npx vitest run                                    265 passed, 17 files
node scripts/seo-audit.mjs --base :4100           26 public routes, 0 problems
visual gate                                       49 routes × 5 widths, 245 shots, 0 problems
```

The SEO audit is the new gate. It fetches every public route and checks the rendered
HTML — not the source — for the things that only exist at render time.

---

## 2. What was delivered

| Requirement | Delivered | Evidence |
| --- | --- | --- |
| Exact metadata for 16 pages | ✓ | `src/config/seo-pages.ts`, values verbatim |
| Unique title + description per page | ✓ | audit: 26/26 unique |
| Meta keywords (as requested) | ✓ | 26/26 routes emit one |
| Canonical URL per page | ✓ | audit compares rendered canonical to expected absolute URL |
| Open Graph + social image | ✓ | 1200×630 image, absolute URLs on all routes |
| Correct index/noindex | ✓ | 26/26 public indexable; 4/4 private noindex |
| Blog system | ✓ | `/blog`, `/blog/[slug]`, index + article templates |
| 10 exact articles | ✓ | `src/config/blog/articles/`, slugs verified by test |
| 10 AI thumbnails, 1200×675 WebP | ✓ | `public/images/blog/`, 199 KB total |
| Favicon set | ✓ | 6 files, 512/192/180/48/SVG |
| WebSite + Organization schema | ✓ | homepage JSON-LD, validated |
| Article + Breadcrumb schema | ✓ | all 10 articles |
| Sitemap | ✓ | 26 URLs, real `lastmod` |
| robots.txt | ✓ | assets crawlable, private areas disallowed |
| Internal linking | ✓ | every article → 2+ articles + product page, link test |
| 16 SEO documents | ✓ | `docs/seo/` |
| Automated audit | ✓ | `scripts/seo-audit.mjs`, exits non-zero on failure |

---

## 3. Metadata implementation

All 16 pages now read their approved metadata from one file. No page hand-types a title
or description, which is what makes drift impossible rather than merely unlikely.

A representative sample of the rendered output:

```
/                    Secure Cloud Storage with 10 GB Free · Orindle
/pricing             Cloud Storage Plans & Pricing · Orindle
/security            Cloud Storage Security & Privacy · Orindle
/blog                Cloud Storage Guides, Comparisons & Tips · Orindle
/blog/is-cloud-storage-safe
                     Is Cloud Storage Safe? Security & Privacy Explained · Orindle
```

Full detail for every page — title, description, primary keyword, secondary keywords,
meta keywords, H1, canonical — is in `page-metadata.md`.

---

## 4. The blog

Ten articles, 11,247 words, each complete and sourced.

| Article | Words | Sources | Checked |
| --- | --- | --- | --- |
| Best Google Drive Alternatives | 1,564 | 7 | 14 Nov 2026 |
| Google Drive vs Dropbox vs OneDrive | 966 | 3 | 14 Nov 2026 |
| Best Free Cloud Storage | 1,146 | 4 | 14 Nov 2026 |
| How Much Cloud Storage Do You Need | 1,052 | 2 | — |
| Cloud Storage vs Cloud Backup | 1,034 | 2 | — |
| How to Share Large Files Online | 1,054 | 2 | — |
| Best Cloud Storage for Small Business | 1,128 | 4 | 14 Nov 2026 |
| Is Cloud Storage Safe | 1,091 | 3 | — |
| How to Organize Digital Files | 1,016 | 2 | — |
| How to Move Files from Google Drive | 1,196 | 3 | 14 Nov 2026 |

### What makes them defensible

- **Dated facts.** Every price carries a check date; four articles are on a 90-day review
  cycle encoded in the data.
- **Primary sources.** Provider pricing pages, CISA, NIST, OWASP, ISO — not roundups.
- **Orindle's limits stated in its own comparisons.** Organisation features "not built
  yet". No password-protected links. No MFA beyond the provider. No backup feature.
- **No fabricated authority.** No invented bylines, no star ratings, no testimonials.
- **Refusal to rank itself.** In the alternatives article Orindle is ninth of ten.

### The finding that mattered

Google changed its free tier in 2026 — new accounts in some regions get 5 GB until phone
verification, support wording moved from "comes with 15 GB" to "up to 15 GB". Verified
against PCWorld, 9to5Google reporting and Google's own pages. The articles state the
change, its regional nature, and that existing accounts are unaffected — rather than
writing "Google now gives 5 GB", which would be false.

---

## 5. Technical foundation

| Item | State |
| --- | --- |
| Canonical host | `https://orindle.com`, enforced by `metadataBase` |
| Sitemap | 26 URLs, real `lastmod`, generated from route data |
| robots.txt | `Allow: /`, 12 private paths disallowed, assets untouched |
| Private routes | 3 layers: robots.txt + noindex + middleware/RLS |
| Structured data | WebSite, Organization, BlogPosting, BreadcrumbList — all valid |
| Icons | 6 files, genuinely the site's own glyph |
| Mobile | 49 routes × 5 widths, 0 defects |

Full detail in `technical-seo-audit.md`.

---

## 6. Three real problems found and fixed

These were caught by the audit, not by review. Each would have shipped silently.

**1. The homepage canonical disagreed with the sitemap.**
Canonical said `https://orindle.com`, sitemap said `https://orindle.com/`. Next
normalises the former and the sitemap was hand-built. Two forms of one URL across two
files is how "Duplicate, Google chose a different canonical" warnings start. Both now
emit the same string, and the audit asserts it.

**2. The sitemap lied about `lastmod`.**
The previous implementation used `new Date()` at request time, claiming every URL changed
on every crawl. A `lastmod` that is always now is noise, and it teaches a crawler to
ignore the field site-wide. Every entry now carries a real revision date.

**3. `/data-deletion` stated the account-deletion flow did not exist — but it does.**
The flow was built (request, 7-day grace, typed confirmation, cancel by signing in,
daily purge). The policy still said "There is no self-service delete-account button yet".
A false statement on a compliance page is a compliance problem, not a content nit. The
sections now describe the flow accurately, including the purge ordering.

**4. Two touch targets on the new article pages were below the WCAG minimum.**
The visual gate caught breadcrumb links at 15 px tall and source citation links at 23 px
at 390 px wide. WCAG 2.5.8 asks for 24 × 24 px. Both now carry a `min-h-[24px]` inline-flex
box — a fix that costs nothing visually and was invisible to every static check.

Two further issues were found by the audit and fixed in the audit itself, recorded in
`technical-seo-audit.md` §3 — a filename/slug assumption that produced six false 404s, and
a regex matching its own explanatory comment.

---

## 7. Honesty constraints, and how each was honoured

| Constraint | How it was met |
| --- | --- |
| Never claim E2E encryption | `/security` describes R2 encryption at rest; article 8 states explicitly it is provider-managed, not end-to-end |
| Never claim certifications | No certification, audit or compliance badge appears anywhere |
| Only advertise built business features | The business page and workspace report `BUSINESS_NOT_CONNECTED`; article 7 declines to recommend Orindle for teams |
| Don't invent company details | Organization schema has name, URL, logo, support email — no address, registration number or founding story |
| No fake authors or credentials | Byline is the Organisation; the data schema has no `author` field and a test enforces it |
| No fabricated statistics | Every figure is either a provider's published price or a stated assumption |
| Date-stamp volatile facts | Four articles carry `factsChecked`; review intervals in data |
| Don't promise rankings | No document promises a position, a date or a traffic number |
| Don't claim GSC is verified | `google-search-console-guide.md` records each step as "not done" |

---

## 8. What is not done

Stated plainly, because a completion report that lists only successes is a sales pitch.

**Search Console is not verified and the sitemap is not submitted.** That requires
authorised access to a property on Google's side. The procedure is written
(`google-search-console-guide.md`) and the completion log is empty. Until those rows
carry a date, no claim about Search Console should appear anywhere.

**Lighthouse, PageSpeed Insights and the Rich Results Test have not been run.** They need
a hosted URL or network access to Google's endpoints; running them against localhost
produces numbers that do not reflect production. The commands are in
`performance-audit.md`.

**`www` → apex redirect is not verified.** It is a DNS/host-level concern that no code in
this repository can confirm. Check with `curl -I` against production.

**Two approved article titles exceed ~60 characters** and will truncate in a result.
Left exactly as approved rather than silently shortened.

**`/help/articles/*` is indexable but not in the sitemap.** Deliberate: reachable in two
clicks, and a 48-URL sitemap dilutes crawl budget for a new site. Revisit once the blog
is established.

**Rankings are not guaranteed, and cannot be.** Cloud storage is contested by four
incumbents with domain authority no new site matches. This work removes every avoidable
technical reason for a page to fail; it does not manufacture authority, which takes time
and links.

**No outreach, no paid links, no guest-post network** was done or planned. Those are
outside what can be done honestly in a build, and the roadmap in `seo-strategy.md` says so.

---

## 9. What this work claims

> Every public page has accurate, complete, unique, correctly-canonicalised metadata in
> the HTML a crawler receives. Every private page is excluded by three independent
> mechanisms. Ten original, sourced, dated articles exist, each with its own image, its
> own keyword and a working internal link graph. Structured data describes the site
> truthfully and invents nothing. An automated audit re-checks all of it and fails the
> build on regression.

What it does not claim: that this will rank, or that it has been measured. Those are
outcomes and observations, and neither is available yet.

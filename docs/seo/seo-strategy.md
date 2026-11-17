# SEO Strategy

**Brand:** Orindle · **Market:** global · **Language:** English
**Category:** cloud storage SaaS
**Objective:** a technically excellent, search-friendly site that attracts qualified
organic traffic for cloud-storage searches — without black-hat tactics, spam or a
claim that cannot be supported.

---

## 1. What this strategy is, and what it is not

This is a foundation, not a ranking guarantee. No one can promise a first-page
position, an indexing date or a traffic number, and a document that does is a sales
pitch. What can be promised, and has been built:

- every public page has unique, accurate, complete metadata;
- every page is crawlable, canonical and in the sitemap;
- every private page is genuinely excluded from the index;
- structured data is present, valid and truthful;
- content exists that answers real questions in the category;
- an automated audit proves all of the above on every build.

Position is an outcome of relevance, authority and time. This work establishes the
first, makes the second possible and starts the clock on the third.

---

## 2. The competitive reality

Cloud storage is one of the most contested commercial search categories on the web.
Google, Microsoft, Apple and Dropbox occupy the head terms with domain authority no
new entrant can match, and they have held those positions for over a decade. A
strategy that targets "cloud storage" as a primary acquisition channel is a strategy
for spending money behind a page that will not rank.

**So the strategy is not to fight for the head term.** It is:

1. **Rank for the long tail where incumbents are weak.** Comparison, migration and
   how-to queries — "how to move files from Google Drive", "cloud storage vs cloud
   backup", "how much cloud storage do I need" — are answered badly or generically
   by the large sites, and well by specialists.
2. **Win the switcher.** Someone searching for Google Drive alternatives has decided
   to consider leaving. That intent is worth more than a thousand head-term
   impressions, and the incumbent cannot bid for it honestly.
3. **Be the page that tells the truth about a category full of pages that do not.**
   Every comparison article in this category quotes the same three numbers and
   omits the catches. Stating the catches — Dropbox's device limit, MEGA's transfer
   quota, Google's 2026 free-tier change — is both the ethical position and the
   differentiator.
4. **Own the brand term completely.** "Orindle" is uncontested and must rank first,
   with correct structured data, a favicon Google can use and no ambiguity with
   another entity.

---

## 3. Keyword architecture

Three tiers, mapped to route types:

| Tier | Examples | Routes | Volume | Difficulty |
| --- | --- | --- | --- | --- |
| Head | cloud storage | `/` | Very high | Very high — incumbents |
| Mid | cloud storage pricing, business cloud storage, cloud storage security | `/pricing`, `/teams`, `/security` | High | High |
| Long tail | how much cloud storage do I need, move files from Google Drive, is cloud storage safe | Articles | Moderate | Low–moderate |
| Brand | Orindle, Orindle cloud storage, contact Orindle | All brand pages | Low | Very low |

The long tail is where traffic comes from in year one. Every article targets a
distinct long-tail primary keyword with genuine informational intent, and links up
to the commercial pages that can convert it. The mapping is in
`keyword-mapping.md`, and a test refuses to build with two routes sharing a primary
keyword.

---

## 4. Content strategy

**Ten articles published, each 900–1,600 words**, every one original, dated, sourced
and reviewed.

### What makes these articles defensible

- **Dated facts.** Every price says when it was checked. Volatile claims have a
  90-day review interval encoded in the data.
- **Named limitations.** Each comparison includes a section on what the comparison
  cannot tell you.
- **Primary sources.** Every article cites at least two, linked, and the audit
  enforces it.
- **Honest self-assessment.** Orindle appears in its own comparisons with its gaps
  stated — including that organisation features are not built.
- **No invented authority.** No fabricated author, no borrowed credentials, no
  star ratings, no "as featured in".

### What was deliberately not done

- No AI-generated filler to hit a word count. One article fell below the 900-word
  floor when measured, and the response was to add a genuinely useful section on the
  hidden costs of free plans — not to pad it.
- No keyword stuffing. The primary keyword appears where it belongs and nowhere it
  does not.
- No competitor denigration. Every weakness cited is one the provider publishes.

---

## 5. Technical strategy

The full audit is in `technical-seo-audit.md`. The principles:

1. **One canonical host.** `https://orindle.com`, apex, HTTPS. `metadataBase` is set
   in the root layout so canonicals never resolve against a preview hostname — the
   most common way a Next.js site ships the wrong canonical, silently.
2. **Server-rendered metadata.** Every page's title, description, canonical and
   JSON-LD is in the HTML the crawler receives. Nothing depends on client-side
   rendering.
3. **Nothing blocks rendering.** robots.txt disallows private areas and nothing else.
   CSS, JS, fonts and images are all crawlable.
4. **Two-layer exclusion for private routes.** robots.txt *and* `noindex` *and*
   middleware. Any one alone fails.
5. **Accurate `lastmod`.** Real dates, not `new Date()`. Google ignores `priority`
   and `changefreq`, so those are set for humans and not treated as levers.
6. **Structured data that describes reality.** WebSite and Organization on the
   homepage; BlogPosting and BreadcrumbList on articles. No FAQPage markup for rich
   results Google will not grant, no fabricated ratings, no invented company details.

---

## 6. Measurement

What will be measured, and where:

| Metric | Tool | Cadence |
| --- | --- | --- |
| Indexed pages vs submitted | Search Console → Pages | Weekly for the first month, then monthly |
| Impressions and clicks per query | Search Console → Performance | Monthly |
| Average position on target keywords | Search Console | Monthly |
| Core Web Vitals (field) | Search Console → Experience | Monthly |
| Crawl errors, soft 404s | Search Console → Pages | Weekly |
| Structured-data validity | Rich Results Test + Search Console | On each deploy that changes markup |
| Broken internal links | `tests/unit/seo.test.ts` | Every test run |
| Metadata regressions | `scripts/seo-audit.mjs` | Every build |
| Article freshness | `reviewIntervalDays` per article | Per the schedule |

**What will not be measured, because it cannot be honestly:** "ranking on page one",
"indexed within 24 hours", "position 1 for cloud storage". Search Console reports
what happened. Predictions are not tracked because they are not results.

---

## 7. Prioritised roadmap

### Done (this implementation)

- Central metadata configuration for all 16 pages, values used verbatim.
- 10 articles, 10 images, blog system, sitemap, robots, structured data.
- Favicon set, OG image, Organization/WebSite markup.
- Automated audit script and 30 SEO tests.
- 16 documents.

### Next — highest value first

1. **Verify the domain in Search Console** and submit the sitemap. Until this
   happens, none of the rest can be measured. The guide is written and waiting.
2. **Publish the business workspace routes.** `/teams` currently ranks for a product
   that is partly built. Either finish it or narrow the page's claims. (The workspace
   itself is now at `/business` and is `noindex` — it is not a marketing surface.)
3. **Add articles 11–20** in the same pattern, targeting the next ten long-tail
   queries. Candidates: cloud storage for photographers, how to share a folder with
   a client, cloud storage for video editing, what happens when cloud storage is
   full, cloud storage for students.
4. **Build a comparison-table page** that is updated monthly — a genuinely dated
   price tracker is the one page in this category competitors will link to.
5. **Earn links by being correct**, not by outreach spam. The 2026 Google free-tier
   change is an example: a page that tracks it accurately attracts citations.
6. **Internal linking pass** once there are 20+ articles, with topic clusters.

### Not planned, deliberately

- Paid links, link exchanges and guest-post networks.
- Programmatic pages spun from templates with no unique content.
- Keyword-stuffed landing pages for close variants.
- Fake reviews, ratings or testimonials — which is also a policy violation.

---

## 8. The honest position

Orindle is a new entrant in a category with four dominant incumbents. The technical
foundation is now better than most of the category's, and the content is more honest
than nearly all of it. Neither fact guarantees traffic. What they do is remove every
avoidable reason a page would fail to rank, which is the only part of this that is
within anyone's control.

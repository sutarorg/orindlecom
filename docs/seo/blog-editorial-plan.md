# Blog Editorial Plan

**Published:** 16 November 2026 · **Articles:** 10 · **Total words:** 11,247

---

## 1. Editorial principles

These are the rules the ten published articles were written to. They apply to
everything added later; a rule that is only followed once is decoration.

1. **Every article must be worth reading without the product.** If a piece reads as
   an advertisement with a blog headline, it does not ship. Orindle appears where it
   genuinely answers the question and nowhere else.
2. **Volatile facts carry a date.** Prices, allowances, feature sets. The date is in
   the article, not in a code comment.
3. **Competitor weaknesses must be ones they publish.** No inference, no
   editorialising about a rival's motives.
4. **Orindle's own limitations appear in the same article that mentions its
   strengths.** A comparison that ranks the publisher first is not a comparison.
5. **No invented authority.** No fabricated byline, no borrowed credentials, no
   "award-winning", no star ratings, no testimonials nobody gave.
6. **Citations are primary.** The provider's own pricing page, not a roundup of
   roundups. At least two per article, enforced by a test.
7. **Dates change when content changes.** `updated` is bumped for a material edit,
   never to look fresh.
8. **A minimum of 900 words, and no padding to reach it.** When one article measured
   825, the fix was a new section with real content, not filler.

---

## 2. The ten articles

| # | Title | Slug | Primary keyword | Words | Review |
| --- | --- | --- | --- | --- | --- |
| 1 | Best Google Drive Alternatives: 10 Cloud Storage Services Compared | `best-google-drive-alternatives` | Google Drive alternatives | 1,564 | 90 days |
| 2 | Google Drive vs Dropbox vs OneDrive: Which Cloud Storage Is Best? | `google-drive-vs-dropbox-vs-onedrive` | Google Drive vs Dropbox vs OneDrive | 966 | 90 days |
| 3 | Best Free Cloud Storage in 2026: Compare Storage Limits and Features | `best-free-cloud-storage` | best free cloud storage | 1,146 | 90 days |
| 4 | How Much Cloud Storage Do You Need? 100 GB, 500 GB, 1 TB and Beyond | `how-much-cloud-storage-do-you-need` | how much cloud storage do I need | 1,052 | 365 days |
| 5 | Cloud Storage vs Cloud Backup: What's the Difference? | `cloud-storage-vs-cloud-backup` | cloud storage vs cloud backup | 1,034 | 365 days |
| 6 | How to Share Large Files Online: Secure Links, Permissions and Expiry | `how-to-share-large-files-online` | how to share large files online | 1,054 | 365 days |
| 7 | Best Cloud Storage for Small Businesses | `best-cloud-storage-for-small-business` | best cloud storage for small business | 1,128 | 90 days |
| 8 | Is Cloud Storage Safe? Encryption, Privacy and Security Explained | `is-cloud-storage-safe` | is cloud storage safe | 1,091 | 365 days |
| 9 | How to Organize Digital Files: A Simple Folder System That Scales | `how-to-organize-digital-files` | how to organize digital files | 1,016 | 365 days |
| 10 | How to Move Files from Google Drive to Another Cloud Storage Service | `how-to-move-files-from-google-drive` | move files from Google Drive | 1,196 | 180 days |

Review intervals are encoded as `reviewIntervalDays` on each article object, so the
schedule is data rather than a table nobody updates.

---

## 3. Funnel design

| Stage | Articles | What the reader is deciding |
| --- | --- | --- |
| Awareness | 8 (is it safe), 5 (storage vs backup), 9 (organise) | Whether this category solves their problem |
| Consideration | 1 (alternatives), 2 (three-way), 3 (free tiers), 7 (small business) | Which provider |
| Decision | 4 (how much), 6 (sharing), 10 (migration) | Which plan, and how to move |

Every article links to `/pricing` or `/features` at least once, and every
consideration-stage article states Orindle's limitations alongside its position.

---

## 4. Publishing process

Each article goes through five gates before it is added to `BLOG_ARTICLES`:

1. **Research.** Primary sources first. Every figure recorded with its source and
   check date in `competitor-research.md`.
2. **Outline.** H2 structure fixed before prose. Sections that would be filler are
   cut at this stage rather than after.
3. **Draft.** Written to the block schema in `src/config/blog/types.ts`.
4. **Review.** Facts re-checked against sources; links resolved; word count measured;
   claims about Orindle verified against the codebase.
5. **Audit.** `npm test` (10 assertions per article) and `node scripts/seo-audit.mjs`.

An article that fails any gate does not appear in the index, the sitemap or the
structured data — because all three read from `BLOG_ARTICLES`.

---

## 5. Next twenty articles (planned, not written)

Ordered by estimated value. None has been written, and this list is not a commitment
to a schedule.

| # | Working title | Primary keyword | Intent |
| --- | --- | --- | --- |
| 11 | Cloud Storage for Photographers: What Actually Fits a RAW Library | cloud storage for photographers | Commercial |
| 12 | How to Share a Folder with a Client (Without Getting It Wrong) | how to share a folder with a client | Task |
| 13 | What Happens When Cloud Storage Is Full? | cloud storage full | Informational |
| 14 | Cloud Storage for Video Editing: Bandwidth Is the Real Constraint | cloud storage for video editing | Commercial |
| 15 | Free vs Paid Cloud Storage: The Hidden Cost of Staying Free | free vs paid cloud storage | Commercial |
| 16 | How to Back Up Photos from a Phone Without Losing the Originals | back up phone photos | Task |
| 17 | Do You Need a Cloud Storage Subscription in 2027? | do I need cloud storage | Informational |
| 18 | Cloud Storage for Students: Cheapest Way to Keep Coursework Safe | cloud storage for students | Commercial |
| 19 | How to Organise a Shared Drive So a New Hire Can Navigate It | organise shared drive | Task |
| 20 | Is 10 GB Enough? What 10 GB Actually Holds | is 10 GB enough | Informational |

---

## 6. Maintenance

- **Quarterly:** re-check prices in articles 1, 2, 3 and 7 against primary sources.
  Update figures, bump `updated`, record the check date.
- **On any pricing change to Orindle:** update `/pricing` copy, `pricing.ts`, and any
  article that quotes a plan. A test verifies the plans in the articles match the
  config for exactly this reason.
- **Annually:** re-read every article for claims that have quietly expired, and
  retire anything that no longer answers a question people ask. A deleted article
  should 301 to its closest replacement — do not simply remove it.
- **Never:** bump a date without changing content. The `updated` field is a promise,
  not a decoration.

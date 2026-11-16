# Blog Content Audit

**Audit date:** 16 November 2026 · **Articles audited:** 10 · **Verdict:** all ten pass

This is a per-article audit against the criteria in the brief, not a summary. The
measurements come from `tests/unit/seo.test.ts` and a word-count pass over the
article data.

---

## Summary table

| # | Article | Words | Read | H2 | Sources | Internal links | FAQs | Image | Pass |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Best Google Drive Alternatives | 1,564 | 8 min | 9 | 7 | 5 | 4 | ✓ | ✓ |
| 2 | Google Drive vs Dropbox vs OneDrive | 966 | 5 min | 8 | 3 | 4 | 3 | ✓ | ✓ |
| 3 | Best Free Cloud Storage | 1,146 | 6 min | 9 | 4 | 6 | 4 | ✓ | ✓ |
| 4 | How Much Cloud Storage Do You Need | 1,052 | 5 min | 8 | 2 | 4 | 3 | ✓ | ✓ |
| 5 | Cloud Storage vs Cloud Backup | 1,034 | 5 min | 8 | 2 | 4 | 3 | ✓ | ✓ |
| 6 | How to Share Large Files Online | 1,054 | 5 min | 8 | 2 | 5 | 4 | ✓ | ✓ |
| 7 | Best Cloud Storage for Small Business | 1,128 | 6 min | 9 | 4 | 4 | 4 | ✓ | ✓ |
| 8 | Is Cloud Storage Safe | 1,091 | 5 min | 8 | 3 | 4 | 4 | ✓ | ✓ |
| 9 | How to Organize Digital Files | 1,016 | 5 min | 8 | 2 | 4 | 3 | ✓ | ✓ |
| 10 | How to Move Files from Google Drive | 1,196 | 6 min | 8 | 3 | 4 | 4 | ✓ | ✓ |

---

## Per-article findings

### 1 · Best Google Drive Alternatives

**Meets:** ten services compared · honest comparison table · competitor information
dated · limitations section · no false positioning of Orindle.

**Specific checks:**
- Orindle appears in position nine of ten, described as "a new service" whose
  organisation features are still being built. It is not ranked first.
- The Google free-tier change is explained with the caveat that it is a regional
  test, that existing accounts are unaffected, and that details vary.
- The limitations section names the conflict of interest explicitly: "This is a
  comparison written by a company that sells one of the ten products."

**Editorial note:** the pricing ambiguity in the Google row (100 GB at $1.99 vs
$2.99) is presented as a range because sources genuinely disagree. Resolving it
would mean publishing a number that is wrong for some readers.

### 2 · Google Drive vs Dropbox vs OneDrive

**Meets:** objective comparison · current prices · sharing · desktop/mobile ·
integrations · privacy · use-case recommendations.

**Specific checks:**
- The article refuses to name a single winner and says so: a ranking without a use
  case is a guess.
- All three are described as provider-managed encryption, with the honest
  consequence: the provider can technically read files. End-to-end alternatives are
  named for readers who need that.
- Price-ambiguity handled the same way as article 1 ($9.99 annual vs $11.99 monthly
  for Dropbox, stated as a pair).

**Weakness:** at 966 words it is the shortest of the ten. It covers the required
ground but has the least room for examples. Flagged for expansion at the 90-day
review rather than padded now.

### 3 · Best Free Cloud Storage

**Meets:** exact storage amounts · free-plan restrictions · sharing · device support
· privacy · when to upgrade · Orindle's 10 GB stated accurately.

**Specific checks:**
- Every free tier states what *else* draws from the quota, which is the detail that
  makes the table useful rather than decorative.
- pCloud and Proton's unlock steps are stated; the headline figure alone would
  mislead.
- MEGA's over-quota behaviour (lock at 30 days, deletion at 45) is included.
- This article was expanded during the audit: it measured 825 words and an extra
  section on the hidden cost of free plans was added, bringing it to 1,146. The
  section is substantive, not padding.

### 4 · How Much Cloud Storage Do You Need

**Meets:** GB vs TB · decimal vs binary · transparent assumptions · capacity
examples · personal estimation · calculation · six Orindle plans.

**Specific checks:**
- Every illustrative figure is labelled as an assumption, and the caveat is
  repeated: "Treat these as order-of-magnitude illustrations that show what a size
  means, not as guarantees of a file count."
- The decimal/binary table shows the same capacity both ways, which is the source of
  most "my drive is missing space" confusion.
- Cites NIST for the binary prefix definition rather than asserting it.

### 5 · Cloud Storage vs Cloud Backup

**Meets:** storage/sync/backup distinguished · version history · data-loss scenarios
· real-world examples · when both are needed.

**Specific checks:**
- States plainly that Orindle does **not** provide backup: no snapshots, no version
  history beyond trash retention. A warning block says it should not be the only copy
  of anything irreplaceable.
- Two worked examples (freelance designer, small business) illustrate the specific
  shape of loss that catches people who believe they are backed up.
- Cites CISA for the 3-2-1 rule.

### 6 · How to Share Large Files Online

**Meets:** methods compared · permissions · expiry and revocation · security
mistakes · practical steps · Orindle's actual controls.

**Specific checks:**
- The Orindle section lists precisely four capabilities and then a warning block
  listing four that do not exist (password links, download limits, watermarking, link
  analytics). This is the honesty standard applied to a feature that benefits Orindle
  most from overstating.
- Explains the limit of revocation: it stops future access, it does not un-share what
  was downloaded.

### 7 · Best Cloud Storage for Small Business

**Meets:** what small businesses need · providers compared · access management ·
collaboration · protection · real pricing · team-size scaling.

**Specific checks:**
- The final recommendation section says Orindle's shared-folder features are "not
  complete yet" and therefore does not recommend it. That is the test of whether the
  honesty rules are real.
- Offboarding is highlighted as the question to ask before buying, with the reason
  (files must survive a departing employee).
- Per-seat pricing traps modelled at three team sizes, including minimum seat counts.

### 8 · Is Cloud Storage Safe

**Meets:** encryption in transit and at rest · account security · access controls ·
link risks · compromise response · responsibility split · recommendations.

**Specific checks:**
- Explicitly states Orindle's encryption is provider-managed and **not** end-to-end.
  This is the single most important correction in the set: the marketing page could
  easily imply otherwise and does not.
- States that Orindle does not offer MFA beyond the identity provider's own, and does
  not step up verification for account deletion.
- The table of who is responsible for what draws the line between provider duty and
  user duty without either side excusing itself.

### 9 · How to Organize Digital Files

**Meets:** folder architecture · naming · version management · files by type ·
individual and team examples · maintenance.

**Specific checks:**
- A warning block states there is no downloadable template because offering one
  would imply a file that does not exist. The tables are the template.
- Cites ISO 8601 for the date-format reasoning rather than asserting "this sorts
  better".

### 10 · How to Move Files from Google Drive

**Meets:** migration planning · export approaches · structure preservation ·
ownership limitations · large transfers · verification · final checklist.

**Specific checks:**
- FAQ states directly that Orindle has no one-click Google Drive import, which is
  true and is exactly the sort of thing a competitor page would imply.
- Ownership and permission losses are enumerated as five specific items, each with
  the consequence.
- Includes real arithmetic: one terabyte at 20 Mbps upload is about four days.
- Eleven-item checklist at the end, ordered so nothing irreversible happens early.

---

## Cross-cutting findings

### Facts verified

| Claim | Verified against | Date |
| --- | --- | --- |
| Google "up to 15 GB", 5 GB new accounts in some regions | Google support wording + PCWorld/9to5Google reporting | 14 Nov 2026 |
| MEGA 20 GB free, end-to-end by default | mega.io/pricing | 14 Nov 2026 |
| Dropbox 2 GB free, Plus 2 TB | dropbox.com/plans | 14 Nov 2026 |
| OneDrive 5 GB free, 250 GB file cap | microsoft.com OneDrive plans | 14 Nov 2026 |
| iCloud 5 GB free, 50 GB at $0.99 | support.apple.com | 14 Nov 2026 |
| pCloud 2 GB → 10 GB, Crypto is paid | pcloud.com pricing | 14 Nov 2026 |
| Proton 2 GB → 5 GB via setup tasks | proton.me/drive/pricing | 14 Nov 2026 |
| Orindle six plans, monthly only, INR + USD | src/config/pricing.ts | build time |
| Orindle has no password-protected links | src/app/api/files/[id]/link | build time |

### Claims about Orindle checked against the codebase

Every product claim in all ten articles was checked against the implementation, not
against the marketing site:

| Claim | Evidence |
| --- | --- |
| 10 GB free | `PLANS[0].storageBytes === 10 * 1000 ** 3` |
| Six plans, monthly only | `yearly: null` on all six; `tests/unit/pricing.test.ts` asserts it |
| Short-lived signed URLs | `downloadUrl`, 300-second expiry in the storage domain |
| Per-person grants, revocable | `/api/files/:id/grants`, `/api/grants/:grantId` |
| Share links with expiry | `/api/files/:id/link` — `expiresInDays` |
| No password-protected links | not implemented; stated as absent |
| Trash retention | `TRASH_RETENTION_DAYS`; stated as configurable |
| Organisation routes not built | `BUSINESS_NOT_CONNECTED` reported synchronously by the business UI |
| No MFA beyond provider | no MFA implementation in the codebase; stated as absent |

### Issues found and fixed during this audit

1. **`best-free-cloud-storage` was 825 words**, below the 900-word floor. Fixed by
   adding a substantive section on the hidden cost of free plans — attention, policy
   risk and feature gates — rather than padding existing paragraphs.
2. **Two image filenames did not match their slugs**
   (`how-much-cloud-storage.webp` for `how-much-cloud-storage-do-you-need`,
   `move-files-from-google-drive.webp` for `how-to-move-files-from-google-drive`).
   The audit script assumed they matched and reported six false 404s. The script now
   reads the image path from the article data instead of guessing.
3. **`data-deletion` page body predates the deletion flow.** The metadata and H1 are
   the approved values, but the body still says there is no self-service deletion.
   Flagged below as an open item — it needs a content review, not a metadata change.

### Open items

| Item | Severity | Owner action |
| --- | --- | --- |
| `/data-deletion` body says the deletion flow does not exist, but it now does | **High** — a false statement on a compliance page | Rewrite the affected sections to describe the 7-day grace, typed confirmation and purge job |
| Article 2 is the shortest at 966 words | Low | Expand at the 90-day review |
| Articles 1, 2, 3, 7 quote prices | Medium | Re-check by 12 Feb 2027 |
| No article targets a UK/EU-specific query | Low | Consider for articles 11–20 |

---

## What this audit does not claim

It does not claim the articles will rank, that the facts will remain true, or that
the writing is beyond improvement. It claims that every article exists, is complete,
is sourced, is dated, resolves its links, describes Orindle accurately, and does not
invent a fact, an author or a rating. Those are checkable, and they have been checked.

# Competitor Research

**Facts checked: 14 November 2026**, against providers' own pricing and support
pages. This document records what was verified, what was ambiguous, and the
deliberate decision not to publish anything that could not be checked.

---

## Why this file exists

Three of the ten published articles compare commercial products and quote prices.
A price is a fact with a half-life. This file is the research behind those articles,
so that:

1. Any figure in an article can be traced to a source,
2. A future review knows what to re-check,
3. Where sources disagreed, the disagreement is recorded rather than resolved by
   picking the tidier number.

---

## The finding that changed an article

Google's free tier is **no longer unconditionally 15 GB for new accounts.**

- Google's own support wording changed from "comes with 15 GB" to **"up to 15 GB"**.
- The change is traceable to around **18 March 2026** via archived support pages.
- New accounts in affected regions see a 5 GB default with 10 GB unlocked by phone
  verification. Google confirmed to press that it is "testing a new storage policy
  for new accounts created in select regions", framing it as account security and
  anti-abuse.
- **Existing accounts are not reported as affected.** Reporting suggests the rollout
  is regional rather than global.

Multiple independent outlets reported this consistently, including PCWorld, which
quoted Google's statement. The article states the change, notes that it was not
announced, and tells readers to check their own storage page rather than assuming.
It does **not** state that everyone now gets 5 GB, because that would be false.

Sources: PCWorld (18 May 2026); Google One support pages; press coverage of the
9to5Google discovery.

---

## Verified allowances and prices

| Provider | Free storage | Entry paid | Checked | Source |
| --- | --- | --- | --- | --- |
| Google Drive | Up to 15 GB, shared with Gmail/Photos; new accounts in some regions 5 GB until phone verification | ~100 GB tier | 14 Nov 2026 | one.google.com/about/plans |
| Dropbox | 2 GB | 2 TB on Plus | 14 Nov 2026 | dropbox.com/plans |
| Microsoft OneDrive | 5 GB | 100 GB standalone; 1 TB with Microsoft 365 Personal | 14 Nov 2026 | microsoft.com/microsoft-365/onedrive |
| Apple iCloud | 5 GB | 50 GB at $0.99/mo | 14 Nov 2026 | support.apple.com/en-us/108047 |
| MEGA | 20 GB | ~200 GB tier upward | 14 Nov 2026 | mega.io/pricing |
| pCloud | Up to 10 GB (starts at 2 GB, unlockable) | 500 GB subscription or lifetime | 14 Nov 2026 | pcloud.com pricing |
| Proton Drive | 2 GB → 5 GB after setup tasks | 200 GB ≈ $4.99/mo | 14 Nov 2026 | proton.me/drive/pricing |
| Sync.com | 5 GB | 1 TB | 14 Nov 2026 | sync.com pricing |
| Box | 10 GB (250 MB per-file cap) | Business plans | 14 Nov 2026 | box.com/pricing |

---

## Where sources disagreed, and what the articles say

**Dropbox Plus at 2 TB: $9.99 or $11.99?** Both appear across sources, and both are
right — it is $9.99 billed annually, $11.99 billed monthly. The articles state the
pair rather than one figure, because quoting a single number would be wrong for half
the readers.

**Google One at 100 GB: $1.99 or $2.99?** Sources disagree, and Google's plan
lineup has shifted with the AI-branded tiers (Basic 100 GB, Standard 200 GB,
AI Plus, AI Pro, AI Ultra). The articles say "~100 GB tier" and give a range rather
than pinning a number that may already be stale.

**MEGA's paid entry tier.** Charged in euros and priced per region. Articles say
"~200 GB tier upward" and avoid a dollar figure they cannot stand behind.

**pCloud's free 10 GB.** Does everyone get 10 GB on day one? No — 2 GB at signup,
the rest unlocked through onboarding steps and referrals. The articles state this
explicitly because the headline figure is misleading without it.

---

## What the research found that articles needed to mention

These are the details that distinguish a useful comparison from a table of GB
numbers. Each was verified and each appears in at least one article:

1. **Shared quota.** Google's 15 GB covers Gmail and Photos. This is the single most
   common reason people hit a Drive limit without feeling like heavy users.
2. **Transfer versus storage limits.** MEGA caps downloads by IP over a window;
   storage is separate. People who share through it notice.
3. **Over-quota behaviour.** MEGA's account is locked read-only after 30 days over
   limit, with data deletion 45 days later. Most articles omit this entirely.
4. **Device limits.** Dropbox's free tier limits concurrent signed-in devices.
5. **Encryption defaults.** MEGA and Proton are end-to-end by default on free
   accounts; pCloud's equivalent (Crypto) is a paid add-on. This materially changes
   what "private" means for a free user.
6. **File-size caps.** OneDrive's 250 GB per-file cap is the tightest of the big
   three and matters for video work.
7. **Feature gating on sharing.** Password-protected and expiring links are paid-tier
   features at Dropbox, not free ones.

---

## Editorial rules applied to every comparison

1. **Orindle is never ranked first.** It appears as one of the ten, with its
   limitations stated in the same paragraph as its strengths.
2. **Every price is date-stamped** in the article, in the table caption or the note.
3. **No competitor is misrepresented.** Where a competitor is weak, the weakness is
   one the provider itself publishes (Dropbox's 2 GB free tier, OneDrive's per-file
   cap), not an inference.
4. **Limitations sections are mandatory** on the comparison articles.
5. **No "best overall" verdict** without naming the use case it applies to.

---

## Re-check schedule

| Article | Interval | Next due |
| --- | --- | --- |
| Best Google Drive alternatives | 90 days | 12 Feb 2027 |
| Google Drive vs Dropbox vs OneDrive | 90 days | 12 Feb 2027 |
| Best free cloud storage | 90 days | 12 Feb 2027 |
| Best cloud storage for small business | 90 days | 12 Feb 2027 |
| How to move files from Google Drive | 180 days | 13 May 2027 |
| Remaining five (no prices quoted) | 365 days | 16 Nov 2027 |

The four comparison articles carry a 90-day interval because they quote prices.
`reviewIntervalDays` on each article object is the machine-readable version of this
table, and the editorial plan uses it.

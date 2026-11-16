# Orindle — Policy Content Review

Section-by-section review status for the five policies: what is factual today,
what needs a lawyer, and what needs a business decision.

This is the working document a reviewer marks up. The generated list lives in the
product — every section with a `review` field renders an amber marker in its table
of contents and a "Requires legal review" note under the section itself — so this
file and the site cannot drift.

---

## 1. How to read this

| Column | Meaning |
| --- | --- |
| **Section** | The anchor id in `src/config/legal/<doc>.ts` |
| **Status** | `factual` · `placeholder` · `review` |
| `factual` | True of the product as built. No legal judgement involved. |
| `placeholder` | Depends on a fact Orindle has not supplied. Rendered as a "To be completed" block. |
| `review` | Drafted as a defensible position, but a qualified lawyer must confirm it before publication. |

**Nothing in any policy is marked `approved`.** No lawyer has reviewed this material.

---

## 2. Privacy Policy — `/privacy`

| Section | Status | What is unresolved |
| --- | --- | --- |
| `scope` | review | Confirm territorial scope and whether the policy should claim GDPR Chapter III compliance for EEA/UK data. |
| `who` | placeholder + review | Entity name, address, business contact. Rule 9 requires "business contact information" — a personal Gmail inbox may not qualify. |
| `what` | factual | Itemisation matches the codebase. Re-verify if a new data category is added. |
| `why` | review | Consent as the DPDP basis for core delivery is arguable. Align §9's withdrawal wording with whatever is decided. |
| `where` | placeholder + review | Hosting regions, sub-processor list. GDPR Art. 28(2) needs a change-notification commitment if DPAs are offered. |
| `transfers` | placeholder + review | Transfer mechanism undecided. Check Data Act Art. 28(2) jurisdiction disclosure too. |
| `retention` | placeholder + review | Rule 8(3) one-year log retention; Rule 6(1)(e). The 30-day trash window is factual; everything else is open. |
| `rights` | factual | Statutory rights stated correctly; the 90-day cap is Rule 14(3). |
| `consent` | review | Withdrawal vs. any minimum subscription term. |
| `security` | factual + review | Claims match `src/app/security`; the Rule 6(1)(e) gap is disclosed in the page itself. |
| `breach` | factual | Rule 7 shape. |
| `children` | placeholder + review | **Largest open item.** Minimum age not set; Rule 10 parental consent not built. |
| `complaints` | review | DPB route stated; DUAA complaints duty (from 19 June 2026) needs a process behind it. |
| `changes` | factual | — |

**Review count: 9 of 14 sections.**

---

## 3. Terms of Service — `/terms`

| Section | Status | What is unresolved |
| --- | --- | --- |
| `status` | factual | Draft banner. |
| `parties` | placeholder | Entity name and address. |
| `eligibility` | placeholder | Minimum age. |
| `service` | factual | Pricing tiers match `src/config/pricing.ts`; the "not a backup service" statement is product truth. |
| `acceptable-use` | factual | Cross-reference only. |
| `billing` | placeholder + review | **Refund policy absent.** EU Art. 16(m) / UK equivalent constrain what may be offered. |
| `availability` | factual | No SLA is claimed, deliberately. |
| `suspension` | factual | Matches the enforcement ladder in the AUP. |
| `switching` | review | EU Data Act terms are a legal floor; the export tooling must actually exist. Article 26 registry missing. |
| `deletion` | placeholder | Deletion SLA. |
| `liability` | review | **The cap is not set.** Cannot publish "a figure to be set in review". Consumer-law floors apply. |
| `law` | placeholder + review | Governing law depends on entity. Grievance officer timing per CP(E-Commerce) r.4(4)–(6). |
| `changes` | factual | — |

**Review count: 5 of 13 sections, plus 6 placeholders.**

---

## 4. Cookie Policy — `/cookies`

| Section | Status | What is unresolved |
| --- | --- | --- |
| `what` | factual | Session cookie, currency cookie, two local-storage keys. |
| `list` | factual + review | Verified against the app: four stored items, no analytics, no pixels. **If a script is ever added, this table changes first.** |
| `why-no-banner` | factual | Correct position: nothing non-essential is set. Cites the DUAA exceptions as *not relied on*. |
| `india` | factual | No cookie statute; DPDP applies to identifying cookies. |
| `control` | factual | Browser instructions; names what breaks when cookies are blocked. |
| `changes` | factual | — |

**Review count: 1 of 6.** The shortest document because the honest answer is short.

---

## 5. Acceptable Use Policy — `/acceptable-use`

| Section | Status | What is unresolved |
| --- | --- | --- |
| `principle` | factual | States that files are not scanned. This must remain true — if content scanning is added, this section and the Privacy Policy both change. |
| `prohibited` | factual | The eleven categories are enforceable as written. Their interaction with Indian obscenity and IT Act provisions still needs a check, which is folded into the `enforcement` review item. |
| `technical` | factual | — |
| `shared` | factual | Matches the sharing screens. |
| `enforcement` | review | **Intermediary status unresolved.** Whether the IT (Intermediary Guidelines) Rules 2021 apply to files stored for a user determines whether a formal notice-and-takedown process is required, and what the response windows are. |
| `report` | placeholder | Grievance officer not named; CP(E-Commerce) timings not operational. |
| `changes` | factual | — |

**Review count: 1 of 7, plus 1 placeholder.**

---

## 6. Data Deletion Policy — `/data-deletion`

| Section | Status | What is unresolved |
| --- | --- | --- |
| `summary` | factual | States plainly that there is no self-service account deletion. |
| `files` | factual | 30 days, from `TRASH_RETENTION_DAYS`. |
| `account` | placeholder + review | **The deletion sequence must be verified against the implementation.** Currently described as a request-driven process. |
| `subscriptions` | placeholder | Refund position. |
| `backups` | placeholder | Backup window unapproved — the page says so rather than guessing. |
| `retained` | review | Indian accounting retention: Companies Act 2013 s.128 requires books for eight financial years; the tax regime adds its own. Replace the placeholder with the actual period. |
| `request` | factual | Matches the contact form subjects. |
| `rights` | factual | DPDP s.12 / s.8(7) / GDPR Art. 17. |
| `changes` | factual | — |

**Review count: 2 of 9, plus 3 placeholders.**

---

## 7. Cross-document consistency checks

Run these whenever a policy changes. Each one has bitten a real product before.

| Check | Where it must agree |
| --- | --- |
| Trash window | Privacy §7, Data Deletion §2, the Trash page copy, `TRASH_RETENTION_DAYS` |
| Storage allowances | Terms §4, Privacy (implicitly), `src/config/pricing.ts`, `/pricing` |
| Support address | Footer, `/contact`, every policy footer, `SITE.supportEmail` |
| Retention statements | Privacy §7 and Data Deletion §6 must not contradict |
| Sub-processors | Privacy §5 and `/security` must name the same three providers |
| Certification claims | **No policy may claim SOC 2, ISO 27001 or HIPAA.** `/security` states none is held |
| Response times | Privacy §13 (90 days) vs. Terms §12 (48h/1 month) — different regimes, both stated correctly, but a reader will compare them |
| Children's age | Privacy §12 and Terms §3 must state the same minimum age once it is decided |
| Deletion requests vs. rights requests | Both route to the same contact form subject |

---

## 8. Publication gate

A policy may lose its "draft" banner only when **all** of the following are true:

1. Every `placeholder` in that document is resolved.
2. Every `review` section is signed off by a named lawyer.
3. The cross-document checks in §7 pass.
4. The document has a publication date distinct from the draft date.
5. The entity name, address and grievance officer in §2 of the research are live on
   the site, because the CP(E-Commerce) Rules require them to be *displayed*, not
   merely written down.

Until then the banner stays. It is a feature, not an apology.

---

## 9. Review log

| Date | Change | Reviewer |
| --- | --- | --- |
| 2026-11-16 | Initial drafts of all five policies. Research recorded in `legal-research.md`. 18 review items and 21 placeholders identified across the set. | Drafted by the engineering side; **not reviewed by counsel** |

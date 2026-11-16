# Orindle — Legal Research

The legal research behind the five policies, the frameworks each one responds to,
and — stated plainly — where the analysis stops and a qualified lawyer must
begin.

Research date: **16 November 2026**. Statutes move; every date below is a point in
time and should be re-verified before publication.

---

## 1. Why this document exists

A policy drafted against a half-remembered summary of GDPR is worse than no policy,
because it creates written commitments nobody checked. This document records what
was actually read, what it says, and what it does not settle — so a reviewing lawyer
starts from evidence rather than from scratch, and so the next person to touch these
pages can see which sentences came from a statute and which came from a claim.

Every legal proposition in the policies traces to a source here. Nothing in
`src/config/legal/` cites a law that is not recorded below.

---

## 2. The regimes that actually apply

Orindle is a consumer cloud storage service with a business tier, priced in INR and
USD, offered to anyone who can sign up. That fact pattern engages four regimes, and
only one of them is unambiguously in force today.

| Regime | Applies because | Status for Orindle |
| --- | --- | --- |
| **DPDP Act 2023 + DPDP Rules 2025** (India) | Orindle offers services to people in India and processes their data | Rules notified 13 Nov 2025; substantive duties from **13 May 2027** |
| **IT Act 2000 + SPDI Rules 2011** (India) | Section 43A of the IT Act is *not yet* omitted | Still live until 13 May 2027 — dual compliance |
| **EU GDPR + ePrivacy** | Offers to people in the EU, prices in USD | In force now |
| **UK GDPR + PECR, as amended by DUAA 2025** | Offers to people in the UK | In force now; amended rules from 5 Feb 2026 |
| **EU Data Act (Reg. 2023/2854) Ch. VI** | Cloud storage is a "data processing service" | Applies since **12 Sep 2025** |

The honest framing for the policies: **the GDPR obligations are live today, the
DPDP obligations become live in May 2027, and the product currently satisfies
neither completely.** The policies say that rather than implying compliance.

---

## 3. India — DPDP Act 2023 and DPDP Rules 2025

### 3.1 Primary sources read

- **Digital Personal Data Protection Act, 2023 (No. 22 of 2023)** — Gazette of
  India, Extraordinary, Part II Section 1, 11 August 2023. Assented 11 August 2023.
- **Digital Personal Data Protection Rules, 2025** — G.S.R. 846(E), Gazette of
  India, Extraordinary, Part II, Section 3, Sub-section (i), 13 November 2025.
  MeitY: `meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf`
- **Commencement notification** — G.S.R. 843(E), 13 November 2025, appointing the
  three commencement dates.

### 3.2 What the Act establishes

| Section | Content | Used in |
| --- | --- | --- |
| 2(i), 2(j) | Data Fiduciary / Data Principal definitions | Privacy §2 |
| 2(f), 2(l) | "child" is under 18; DPO is an SDF-only appointment | Privacy §12 |
| 3(b) | Extraterritorial reach where services are offered to people in India | Scope |
| 4 | Processing needs consent or a "certain legitimate use" | Privacy §4 |
| 6 | Notice and consent, withdrawal on request | Privacy §4, §9 |
| 7 | The closed list of legitimate uses | Privacy §4 |
| 8(5)–(6) | Security safeguards; breach intimation to the Board and affected persons | Privacy §10, §11 |
| 8(7) | Erasure when the purpose is served or consent is withdrawn | Privacy §7 |
| 8(9) | Publish contact details for data questions | Privacy §2 |
| 8(10), 13 | Grievance redressal duty; exhausting it before the Board | Privacy §13 |
| 9 | Children: verifiable parental consent; no tracking or targeted ads | Privacy §12 |
| 11–14 | Access, correction/erasure, grievance, nomination | Privacy §8 |
| 16 | Cross-border transfer permitted unless a country is restricted | Privacy §6 |
| 44(2) | Omits IT Act s.43A — the basis of the SPDI Rules — from 13 May 2027 | §2 table |

### 3.3 What the Rules add, and when

Rule 1(2)–(4) sets three commencement dates:

| Date | Rules that commence | Consequence for Orindle |
| --- | --- | --- |
| 13 Nov 2025 | 1, 2, 17–21 | Data Protection Board constituted. No direct duty on Orindle yet. |
| 13 Nov 2026 | 4 | Consent Manager registration. Not applicable — Orindle is not a Consent Manager. |
| **13 May 2027** | 3, 5–16, 22, 23 | Every substantive obligation below. |

The rules that shape the policies:

- **Rule 3 — notice.** The notice must "be presented and be understandable
  independently of any other information", must give "an itemised description" of
  the personal data, and must state how to withdraw consent, exercise rights and
  complain to the Board. → Privacy §3 is a table of data items for exactly this
  reason, and §9 addresses withdrawal parity.
- **Rule 6(1) — security safeguards.** Minimum measures include encryption or
  masking, access control, visibility through logs, backups, and **retention of
  logs and personal data for one year** to support detection and investigation of
  unauthorised access. → This is the sharpest current gap; see §7.
- **Rule 7 — breach.** Intimate affected Data Principals "without delay" with the
  nature, extent, timing, consequences, mitigation, self-protective measures and a
  contact; intimate the Board without delay and with a fuller report within 72
  hours. → Privacy §11.
- **Rule 8(1)–(2)** — erasure and the 48-hour pre-erasure warning, for the classes
  in the Third Schedule (large e-commerce, social media, gaming). **Orindle is not
  in those classes**, so the specific periods do not bind it — but rule 8(3) still
  requires at least one year of retention of personal data, traffic data and logs
  for Seventh Schedule purposes.
- **Rule 9** — publish business contact information of a DPO or a person able to
  answer processing questions. → Privacy §2 placeholder.
- **Rule 14(3)** — publish a grievance response period "not exceeding ninety days"
  and implement measures to meet it. → Privacy §13 states ninety days.
- **Rule 15** — transfer outside India permitted subject to any Central Government
  order. No restricting order currently affects Orindle's providers.
- **Rule 10** — verifiable parental consent mechanics, including age/identity
  verification and virtual tokens. → The open question in Privacy §12.

### 3.4 The SPDI overlap

The DPDP Act's repeal of IT Act s.43A is scheduled, not complete: s.44(2) omits
s.43A and s.87(2)(ob) with effect from 13 May 2027. Until then the **IT
(Reasonable Security Practices and Procedures and Sensitive Personal Data or
Information) Rules, 2011** remain the governing text for "sensitive personal data
or information" under s.43A, with its own breach-compensation model.

Practical consequence: until May 2027 Orindle must satisfy **both**, and the
policies say so rather than describing only the newer regime.

### 3.5 What is *not* claimed

- No **Significant Data Fiduciary** notification exists, so no DPO, no independent
  data auditor, no annual DPIA is claimed. The policies say this explicitly.
- No **Data Protection Board** determination or guidance is relied on; none is
  published that affects this analysis.
- No **country restriction** under s.16 has been notified that affects Cloudflare,
  Supabase or Razorpay.

---

## 4. European Union

### 4.1 GDPR

In force. Orindle is a controller for account and usage data, and a processor for
files a business customer uploads about its own customers. The policies reflect the
following, without reproducing the Regulation:

- **Art. 6** — a lawful basis per purpose. Privacy §4's table maps each purpose to a
  basis. The contested choice (consent vs. contract for core delivery) is flagged
  as needing review rather than presented as settled.
- **Arts. 12–15** — transparent information and access. Privacy §8.
- **Art. 17** — erasure, subject to legal-retention exceptions. Data Deletion §8.
- **Art. 28** — processor contracts and sub-processor transparency. Privacy §5 marks
  the sub-processor list as open.
- **Arts. 44–46** — transfer mechanism outside the EEA. Privacy §6 marks this open.
- **Art. 33** — 72-hour supervisory-authority notification. Privacy §11.

### 4.2 ePrivacy Directive 2002/58/EC, Art. 5(3)

Storage on, or access to, a user's device requires consent unless strictly
necessary for a service the user requested. → Cookie Policy §2–3.

### 4.3 EU Data Act — Regulation (EU) 2023/2854, Chapter VI

This is the obligation most easily missed by a storage product, and it is **live**.

- Applies from **12 September 2025** (Art. 50), irrespective of where the provider
  is established, where the service is offered in the EU.
- Chapter VI covers "data processing services", which is defined broadly enough to
  include SaaS, not only IaaS.
- Article 25 requires switching be possible to another provider **or** to on-premises.
- Article 25 contract terms: notice **no more than two months**, transition period
  **no more than 30 calendar days**, retrieval for **at least 30 calendar days**
  afterwards, then erasure. If 30 days is technically infeasible, the provider must
  justify within **14 working days** and may extend to no more than **seven months**.
- Article 29 switching charges: reduced to direct cost until **12 January 2027**,
  then **prohibited**.
- Article 26 requires information about procedures and formats; Article 30 requires
  open interfaces and export in a structured, machine-readable format.
- Article 28(2) requires public disclosure of the jurisdictions hosting ICT
  infrastructure.

→ Terms §9 implements these as terms rather than as a courtesy, and Terms §9 applies
them to every customer rather than only EU customers.

**Caveat recorded:** the Commission's Digital Omnibus proposal of 19 November 2025
(COM(2025) 837) would lighten Chapter VI for certain custom-built, non-IaaS
services under contracts concluded on or before 12 September 2025, while keeping the
phasing-out of switching charges. It is a proposal, not law. Do not draft against it.

---

## 5. United Kingdom

In force, and recently amended.

- **UK GDPR and the Data Protection Act 2018**, as amended by the **Data (Use and
  Access) Act 2025** (Royal Assent 19 June 2025).
- Commencement, per the ICO's staged commencement:

| Date | What commenced |
| --- | --- |
| 19 June 2025 | "Reasonable and proportionate" DSAR searches |
| 1 Dec 2025 | Digital verification services framework |
| **5 February 2026** | Most UK GDPR and PECR changes: lawful basis, notices, cookies, PECR fines, recognised legitimate interests, "stop the clock" on access requests, transfer test |
| 19 June 2026 | Statutory duty to handle data-protection complaints |
| 30 September 2026 | ICO becomes the Information Commission |

- **PECR regulation 6** still requires consent for device storage, but Schedule A1
  (inserted by DUAA) adds exceptions for storage used **solely for statistical
  purposes**, **solely to adapt appearance/functionality**, and for emergency
  location — each subject to clear information and a simple, free way to object.
  → Cookie Policy §3 states Orindle does not rely on these because it sets no
  analytics, which is true and therefore the safest position.
- **PECR fines** rose to the UK GDPR level — £17.5m or 4% of worldwide turnover —
  for breaches on or after 5 February 2026.
- **Complaints duty** (from 19 June 2026): controllers must facilitate and handle
  data-protection complaints. → Privacy §13 routes complaints to the same channel as
  grievances; this needs a documented process, noted in the review register.

---

## 6. Consumer and disclosure obligations

These are not data-protection law but they govern what must appear on a commercial
website, so they sit in the policies.

### 6.1 India — Consumer Protection (E-Commerce) Rules, 2020

Notified 23 July 2020 under the Consumer Protection Act, 2019. The provisions that
bite:

- **Rule 4(2)** — display in a clear and accessible manner: the legal name of the
  entity, the principal geographic address of its headquarters and branches, website
  details, and contact details including customer care and the grievance officer.
  → Terms §2 and §12 carry placeholders rather than an invented company name.
- **Rule 4(4)–(6)** — appoint a grievance officer, display name and contact details,
  **acknowledge a complaint within 48 hours** and **redress within one month**.
  → Recorded as a placeholder and a review item; the current support inbox has no
  measured SLA.
- **Rule 4(1)(a)** — an e-commerce entity must be a registered company, a foreign
  company covered by the Companies Act, or an office/agency outside India owned or
  controlled by a person in India. Whether Orindle currently meets this is an
  **entity-structure question the codebase cannot answer** and is flagged as a
  review item.

### 6.2 India — consumer cancellation and refund

The Consumer Protection Act, 2019 and the E-Commerce Rules constrain how digital
services may be charged and cancelled, and the EU's Directive 2011/83/EU right of
withdrawal for digital content does the same in the EU, with a possible waiver at
checkout. **No refund policy has been approved**, so none is published; the policy
says so and routes the reader to support.

---

## 7. Gaps between the law and the product — recorded, not hidden

This is the most useful section of this document. Each row is a real divergence
found by comparing the statutes above against `src/`.

| Gap | Source | Severity | Where it is disclosed |
| --- | --- | --- | --- |
| **One-year log retention** for detecting and investigating unauthorised access is not implemented | DPDP Rules r.6(1)(e), r.8(3) | High — required by 13 May 2027 | Privacy §10 note |
| **Verifiable parental consent** for under-18s not built; minimum age not set | DPDP Act s.9; Rules r.10 | High — blocks a compliant consumer signup in India | Privacy §12 |
| **Named grievance officer** with published contact and a 48h/1 month SLA | CP(E-Commerce) Rules r.4(4)–(6) | High | Terms §12, AUP §6 |
| **Registered entity name and address** not published | CP(E-Commerce) Rules r.4(2); GDPR Art. 13(1)(a) | High — blocks publication | All policies, placeholders |
| **EU Data Act export** — no machine-readable full export, no Article 26 registry | Data Act Arts. 25, 26, 30 | High for EU customers | Terms §9 |
| **Sub-processor list** and change notification | GDPR Art. 28(2) | Medium | Privacy §5 |
| **Transfer mechanism** (SCCs or adequacy) not documented | GDPR Arts. 44–46 | Medium | Privacy §6 |
| **Data-protection complaints process** | DUAA 2025, from 19 June 2026 | Medium | Privacy §13 |
| **Retention schedule** for logs, backups, billing | GDPR Art. 5(1)(e); DPDP s.8(7) | Medium | Privacy §7 |
| **Self-service account deletion** absent | DPDP s.12; GDPR Art. 17 (practical) | Medium | Data Deletion §1 |
| **Intermediary obligations** — whether the IT Rules 2021 (grievance, takedown) apply to a storage service | IT Act; IT (Intermediary Guidelines) Rules 2021 | Medium | AUP §5 review note |

Each of these is disclosed in the product itself, not only in this document. That is
deliberate: a gap that exists only in a Markdown file in a repo has not been
communicated to anybody.

---

## 8. Decisions taken, with reasons

| Decision | Reason |
| --- | --- |
| Policy content lives in `src/config/legal/*.ts` as structured data | One source renders the page, the TOC, the mobile navigator and the anchors. Prose in JSX cannot be audited or diffed as content. |
| Unsettled facts are `null` in `placeholders.ts` and render as visible "To be completed" blocks | A plausible guess in a policy is a false statement of fact. The placeholder is uglier and correct. |
| Every policy carries a "not reviewed by a lawyer" banner on the page | A draft that looks final is the failure mode. |
| Sections needing review carry a machine-readable `review` string, surfaced as an amber dot in the TOC | So the review list is generated from the content, not maintained in parallel. |
| Acceptance of the EU Data Act terms is written into the Terms rather than a separate document | They are contractual obligations on a storage provider, which is what the Terms already are. |
| No cookie banner | Nothing non-essential is set. Adding a banner would misrepresent the site. |
| No certification, DPO, audit, or uptime claim anywhere | None is true. The security page already takes this line; the policies follow it. |

---

## 9. What a reviewing lawyer should be asked

1. Does the DPDP Act or the CP(E-Commerce) Rules apply to the current entity
   structure, and if the entity is not a registered company, what must change?
2. Is consent the right DPDP basis for core service delivery, or should the policies
   rely on a s.7 legitimate use?
3. What minimum age should the account require, and what parental-consent flow is
   proportionate for a storage product with no behavioural advertising?
4. What is a defensible liability cap, and what consumer-law carve-outs must it
   carry in India, the EU and the UK?
5. What refund and cancellation position is lawful for a monthly and annual digital
   subscription, given Directive 2011/83/EU Art. 16(m) and its UK equivalent?
6. Do the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules 2021
   apply to user files stored for the user alone, and if so what notice-and-takedown
   process is required?
7. Is the current support inbox capable of functioning as the grievance officer's
   published contact, and what process must exist behind it?
8. What transfer mechanism is appropriate for EU and UK personal data given the
   hosting providers in use?

---

## 10. Sources

| # | Source | What it was used for |
| --- | --- | --- |
| 1 | DPDP Act 2023, Gazette 11 Aug 2023 — `meity.gov.in` | Sections 2–16, 44 |
| 2 | DPDP Rules 2025, G.S.R. 846(E), 13 Nov 2025 — `meity.gov.in` | Rules 1, 3, 6, 7, 8, 9, 10, 14, 15 |
| 3 | Commencement notification G.S.R. 843(E), 13 Nov 2025 | The three-phase timeline |
| 4 | Regulation (EU) 2016/679 (GDPR) | Arts. 5, 6, 13, 17, 28, 33, 44–46 |
| 5 | Directive 2002/58/EC (ePrivacy), Art. 5(3) | Cookie consent baseline |
| 6 | Regulation (EU) 2023/2854 (Data Act), Ch. VI, Arts. 23–30, 50 | Switching terms and dates |
| 7 | Data (Use and Access) Act 2025 (UK), Royal Assent 19 June 2025 | Amends UK GDPR, DPA 2018, PECR |
| 8 | UK PECR 2003, reg. 6 and Schedule A1 as amended | Cookie exceptions from 5 Feb 2026 |
| 9 | Consumer Protection (E-Commerce) Rules 2020, G.S.R. 462(E) | Rules 4(1)–(6), grievance officer |
| 10 | IT Act 2000, s.43A and the SPDI Rules 2011 | The dual-compliance period to 13 May 2027 |
| 11 | Directive 2011/83/EU, Art. 16(m) | Digital-content withdrawal right |

Secondary sources were used only to establish commencement dates where the primary
instrument states a period rather than a date (for example Rule 1(4)'s "eighteen
months"). Every such date is marked as computed, not printed, in the policy where it
appears.

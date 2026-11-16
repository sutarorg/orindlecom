# Orindle — Approved Claims Register

Every factual claim Orindle makes about itself, its data handling and its security,
with the evidence for it. If a claim is not in here, it does not go on the site.

The purpose is narrow and worth stating: **writing "we delete your data within 30
days" is not a design decision, it is a promise.** This register is where each
promise is recorded with what backs it, so nobody has to reconstruct the reasoning
later, and so a claim that stops being true can be found.

---

## 1. The three states

| State | Meaning | May appear in a policy? |
| --- | --- | --- |
| **Verified** | True of the code or config at a named path, checked on the date shown. | Yes, as fact |
| **Policy** | A business decision that has been made and is not yet enforced by anything | Only with a note that it is not yet operational |
| **Unapproved** | Open. No claim may be made. | Only as a visible placeholder |

Nothing in this register is **certified**: no external auditor, lawyer or
certification body has reviewed any of it.

---

## 2. Verified claims

These are true because the code says so. Each cites where.

### 2.1 Product and storage

| Claim | Evidence |
| --- | --- |
| Free plan is 10 GB | `src/config/pricing.ts` — `PLANS[0].storageBytes = 10 * 1024**3` |
| Paid tiers are 100 GB / 500 GB / 1 TB / 5 TB / 10 TB | `src/config/pricing.ts` — `PLANS[1..5]` |
| Storage is per account, shared across devices | Product model in `src/lib/drive/types.ts`; no per-device accounting exists |
| Deleted files stay in Trash 30 days by default | `src/lib/drive/types.ts` — `TRASH_RETENTION_DAYS` / `TRASH_RETENTION`, default 30 |
| Prices published in INR and USD only | `src/config/pricing.ts` — `CURRENCIES` with `published: true` for those two; others resolve `null` |
| No credit card required on the free plan | No payment step exists in the signup flow |

### 2.2 Security

| Claim | Evidence |
| --- | --- |
| TLS in transit | Deploy target forces HTTPS; all provider calls are `https://` |
| Encryption at rest | Cloudflare R2 encrypts at rest (provider feature) |
| Files stored under random object keys | `src/app/security` describes the object-key model; implementation is in the storage path |
| Per-request authorisation with row-level security | Supabase RLS policies; described in `/security` |
| Short-lived signed upload/download URLs | `/security` step 2–3 |
| Card data never reaches Orindle's servers | Razorpay handles the payment surface; only identifiers are stored |
| Webhooks are signature-verified | `/security` step 5 |
| No SOC 2, ISO 27001 or HIPAA certification | Stated on `/security` as an explicit non-claim |
| No end-to-end zero-knowledge encryption | Stated on `/security` as an explicit non-claim |

### 2.3 Data handling

| Claim | Evidence |
| --- | --- |
| Processors are Supabase, Cloudflare R2 and Razorpay | `/security` and the application's integration points |
| No advertising trackers or analytics pixels | No analytics dependency in `package.json`; no third-party script in `layout.tsx` |
| One first-party session cookie (httpOnly, secure) | Supabase auth session, set with httpOnly and secure flags |
| `orindle_currency` preference cookie (sameSite=lax, 1 year) | `src/components/pricing/pricing-section.tsx` line 41 |
| Two local-storage preference keys: `orindle:sidebar`, `orindle:view` | `src/components/dashboard/dashboard-shell.tsx`, `src/components/dashboard/drive-store.tsx` |
| Personal data is not sold or shared with advertisers | No such integration exists anywhere in the codebase |
| Files are not used to train models | No training pipeline exists |

### 2.4 Account and support

| Claim | Evidence |
| --- | --- |
| Support reaches a person, not a ticket queue | Single inbox; no ticketing system integrated |
| Enquiries go to `tejassutar.business@gmail.com` | `src/config/site.ts` `SITE.supportEmail`; `src/app/contact/actions.ts` `SUPPORT_INBOX` |
| Invitations expire after 7 days | `src/lib/business/types.ts` — `INVITATION_EXPIRY_DAYS = 7` |
| Three roles only: owner, admin, member | `src/lib/business/roles.ts` — `ROLES` |
| No custom roles, no per-folder roles | Same file; no such feature exists |
| The last owner cannot be removed | `src/lib/business/roles.ts` — `removalBlocker` |
| Nobody can change their own role | Same; enforced in UI and described as backend-enforced |
| The owner cannot be invited into existence by an admin | `canAssignRole` returns false above own rank |

---

## 3. Claims that are **not** made

Recorded because the temptation to make them is real, and because a reviewer
checking a future draft needs to know these were considered and rejected.

| Not claimed | Why |
| --- | --- |
| "GDPR compliant" / "DPDP compliant" | Compliance is a legal conclusion. The policies describe practices and disclose gaps. |
| "Bank-grade security" | Meaningless, and unmeasurable. |
| "Military-grade encryption" | Same, and the encryption is standard AES-256 at rest. |
| "99.9% uptime" | No SLA exists, no uptime is measured, nothing is creditable. |
| "Your data is never accessed by anyone" | Support and engineering can access production data to operate the service. |
| "Zero-knowledge" | Explicitly false; the service decrypts to serve files. |
| "We never share data with third parties" | Three processors handle it. The policies name them. |
| "SOC 2 / ISO 27001 certified" | Not held. |
| "Data stored only in India" | Hosting regions unconfirmed — see placeholder. |
| "We delete everything in 30 days" | Backups and billing records are exceptions; the backup window is unmeasured. |
| "Automatically compliant with DPDP" | The substantive rules commence 13 May 2027 and several are not implemented. |
| Any customer count, user number, or growth figure | None has been measured or approved. |
| Any testimonial or logo wall | No permission has been obtained from any customer. |
| A named DPO | Not applicable; Orindle is not a notified Significant Data Fiduciary. |
| A registered company name or address | Not supplied — placeholder only. |

---

## 4. Unapproved — the claim-blocking list

These map one-to-one to `PLACEHOLDER_DEFINITIONS` in
`src/config/legal/placeholders.ts`. Each blocks at least one sentence in at least one
policy.

| Key | Blocks | Owner |
| --- | --- | --- |
| `legalEntity` | Terms §2, Privacy §2, all disclosures | Business owner |
| `registeredAddress` | Terms §2, CP(E-Commerce) r.4(2) | Business owner |
| `businessContact` | Privacy §2 (DPDP Rules r.9) | Business owner + legal |
| `dpoName` | Conditional; not required today | Revisit on SDF designation |
| `grievanceOfficer` | Terms §12, AUP §6, CP(E-Commerce) r.4(4) | Business owner |
| `hostingRegions` | Privacy §5 | Engineering |
| `subProcessors` | Privacy §5 (GDPR Art. 28) | Engineering + legal |
| `transferMechanism` | Privacy §6 (GDPR Arts. 44–46) | Legal counsel |
| `retentionPeriods` | Privacy §7 | Business owner + legal |
| `backupWindow` | Privacy §7, Data Deletion §5 | Engineering |
| `subscriptionRefund` | Terms §6, Data Deletion §4 | Business owner + legal |
| `deletionSla` | Data Deletion §3 | Engineering |
| `governingLaw` | Terms §12 | Legal counsel |
| `minimumAge` | Privacy §12, Terms §3 | Business owner + legal |

---

## 5. How a claim gets added

1. Establish the evidence. "It seems like it should work this way" is not evidence.
2. Add it here with a `Verified` / `Policy` / `Unapproved` state and a source.
3. If it is `Verified`, cite the file path in the row — the row is the audit trail.
4. If it is `Policy`, the policy text must say it is not yet operational.
5. If it is `Unapproved`, it appears in the product as a placeholder, not as a
   sentence, and it is added to the table in §4.

A claim that cannot be evidenced does not ship. That is the whole rule; everything
else in this document is bookkeeping.

---

## 6. Change log

| Date | Change |
| --- | --- |
| 2026-11-16 | Initial register. 27 verified claims across product, security, data handling and account. 15 explicit non-claims. 14 unapproved items blocking publication. |

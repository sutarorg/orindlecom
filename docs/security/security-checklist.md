# Security Checklist

**Purpose:** A working list, not a badge. Every item is either **done and verified**,
**designed but not built**, or **open**. Nothing here may be reported as complete
because it is written down.

Legend: ✅ verified in this repo · 🟡 designed, not implemented · ⬜ open ·
➖ not applicable

---

## 1. Secrets

| | Item | State | Evidence |
| --- | --- | --- | --- |
| ✅ | `.env.example` documents every variable with no values | done | `.env.example` |
| ✅ | `.gitignore` excludes `.env` and `.env*.local`, keeps `.env.example` | done | `.gitignore` |
| ✅ | No secret in any tracked file | verified by grep | `git grep -iE "(sk_|key_secret|service_role)"` returns only documentation |
| 🟡 | Service-role key read only in `lib/supabase/service.ts` with `server-only` | designed | architecture §4 |
| 🟡 | Build-time test greps client bundle for the service key | designed | threat model T13 |
| 🟡 | Redaction helper around config logging | designed | architecture §9 |
| 🟡 | Live payment keys refused when `NODE_ENV !== production` | designed | architecture §10 |
| ⬜ | Secrets rotated on a documented schedule | open | deployment |
| ⬜ | Separate credentials per environment, confirmed in the dashboard | open | deployment |

## 2. Authentication

| | Item | State |
| --- | --- | --- |
| ✅ | Session read server-side via `@supabase/ssr` request-scoped client | done |
| ✅ | Auth forms validate server-side as well as client-side | done |
| ✅ | OAuth provider button shown only when the provider is enabled | done |
| ✅ | Auth degrades honestly with no credentials (`not_configured`) | done |
| 🟡 | Middleware refreshes session and gates `/dashboard/**` | designed |
| 🟡 | `/api/**` returns 401 JSON, not a redirect | designed |
| 🟡 | Email change and account deletion require the current password | designed |
| ⬜ | Step-up MFA for destructive actions | open, accepted risk |
| ⬜ | Session revocation on password change, all devices | open |

## 3. Authorization

| | Item | State |
| --- | --- | --- |
| ✅ | Identity resolved from session only; no endpoint takes a user id | designed + enforced by test plan |
| 🟡 | RLS enabled on every table, default deny | designed, schema §10 |
| 🟡 | `is_org_member` / `org_role` definer functions avoid policy recursion | designed |
| 🟡 | Nested resources loaded through their parent | designed, T2 |
| 🟡 | Server re-implements role rules; does not reuse UI helpers | designed, T3 |
| 🟡 | Negative RLS tests for every isolation claim | designed, §6 of threat model |
| ⬜ | Permission matrix reviewed against the UI table in `permissions-view.tsx` | open |

## 4. Data

| | Item | State |
| --- | --- | --- |
| ✅ | No client derives storage usage; `StorageUsage` arrives whole | done |
| ✅ | Trash retention is one configurable constant, not scattered | done |
| ✅ | Decimal byte basis, consistent between display and plan | done |
| 🟡 | Soft delete with timestamped retention | designed |
| 🟡 | Backup + restore procedure documented and **rehearsed** | designed, rehearsal open |
| 🟡 | PITR window confirmed on the actual Supabase plan | open |
| 🟡 | Data export produces a real bundle | designed |
| ⬜ | Data residency statement (blocked on region choice) | open |
| 🟡 | DPDP erasure path, with financial-record exceptions named | designed |

## 5. Files and storage

| | Item | State |
| --- | --- | --- |
| ✅ | No permanent public URL for private files (design) | designed |
| 🟡 | Public-URL helper throws for non-`avatars/` prefixes | designed |
| 🟡 | Presigned URLs, short expiry, server-generated keys | designed |
| 🟡 | HTML/SVG never served inline | designed |
| 🟡 | Size and checksum verified before a file becomes available | designed |
| 🟡 | Quota reservation is transactional | designed |
| ⬜ | **Malware scanning** — no scanner exists; nothing may claim it works | open, by design |
| ⬜ | Rate limiting on presign endpoints | designed, not built |

## 6. Payments

| | Item | State |
| --- | --- | --- |
| ✅ | Only approved prices exist in code | done |
| ✅ | Annual pricing absent, and the UI says so honestly | done |
| ✅ | Currency list limited to INR/USD | done |
| 🟡 | Amount resolved server-side from `approved` rows | designed |
| 🟡 | Signature and webhook verification with `timingSafeEqual` | designed |
| 🟡 | Webhook idempotency via unique event id | designed |
| 🟡 | Billing tables private even from org admins | designed |
| ⬜ | Merchant account international capability confirmed | **blocker**, payment-lifecycle §9.1 |
| ⬜ | Merchant account recurring capability confirmed | **blocker** |
| ⬜ | Approved payment methods confirmed before naming them in copy | open |
| ⬜ | Live vs test key separation verified in the deployed environment | open |

## 7. Application surface

| | Item | State |
| --- | --- | --- |
| ✅ | Only one route handler exists today; no unvalidated endpoint is exposed | done |
| ✅ | Contact form: honeypot, min-fill-time, rate limit, server-side recipient | done |
| ✅ | Contact success gated on provider 2xx | done |
| 🟡 | Every new endpoint validates server-side with a schema | designed |
| 🟡 | CSRF: server actions and same-site cookies; state-changing routes require same-origin | designed |
| ⬜ | Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) | **open — nothing sets them today** |
| ⬜ | Rate limiting across all authenticated routes | open |

## 8. Frontend

| | Item | State |
| --- | --- | --- |
| ✅ | No success message without a confirmed backend result | verified by inspection of all 13 seams |
| ✅ | No fake success; simulated actions fail visibly | done |
| ✅ | No placeholder routes (the one 404 is by design and recorded) | done |
| ✅ | Pointer targets meet WCAG 2.5.8 at 5 widths | verified, 220/220 |
| ✅ | No horizontal overflow at any tested width | verified |
| ⬜ | Automated a11y (axe) in the gate | open |
| ⬜ | CSP tested against a real browser run | open |

## 9. Operations

| | Item | State |
| --- | --- | --- |
| 🟡 | Cron routes require a bearer secret, return 404 otherwise | designed |
| 🟡 | Every privileged action writes an audit row | designed |
| 🟡 | Failed emails logged with provider error, never swallowed | designed |
| ⬜ | Alerting on reconciliation drift, webhook failures, cron failures | open |
| ⬜ | Incident response runbook | open |
| ⬜ | Breach notification procedure (DPDP: Board + each Data Principal) | open |

## 10. Legal and compliance

| | Item | State |
| --- | --- | --- |
| ✅ | Published policies as data, with unresolved claims as placeholders | done |
| ✅ | No invented facts, certifications or regional prices | done |
| ✅ | No certifications claimed that are not held | done |
| 🟡 | DPDP: lawful basis, erasure, grievance contact | designed |
| 🟡 | CP(E-Commerce): 48-hour acknowledgement, 1-month resolution | done in copy, not yet enforced operationally |
| 🟡 | EU Data Act Ch. VI switching (2-month notice, 30-day transition, 30-day retrieval) | documented, portability tooling open |
| ⬜ | DPO / grievance officer named in the product | open |
| ⬜ | Grievance officer contact displayed (r.4(4)–(6)) | partly in copy |

---

## 11. Honest summary

**Verified today:** secret hygiene in the repo, the contact form's honest failure
behaviour, absence of fake success anywhere in the UI, the visual/a11y gate, and the
approved price list.

**Designed but not built:** essentially the whole backend — RLS, uploads, billing
verification, jobs, email templates.

**Open and named:** security headers (nothing sets them today), rate limiting, MFA
step-up, malware scanning, merchant-account capability, PITR confirmation, alerting,
and the breach-notification runbook.

The most useful thing this checklist does is refuse to tick a box for something that
was designed and never written. A future report that claims "security complete" while
§7's headers row is still open is wrong.

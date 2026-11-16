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
| ✅ | Middleware refreshes session and gates `/dashboard/**` | built; `middleware-policy.test.ts` |
| ✅ | `/api/**` returns 401 JSON, not a redirect | built |
| ✅ | Email change and account deletion require the current password | built |
| ✅ | Optional TOTP 2FA, AAL2 enforced server-side on protected operations | built; `auth-security-flow.test.ts` |
| ✅ | MFA removal requires password **and** AAL2 | built; two-step by design |
| ✅ | Set Password onboarding gate for Google accounts | built; database flag + middleware |
| ⬜ | Step-up MFA for **billing** and **account deletion** specifically | open, accepted risk — 2FA exists, but these two flows do not yet demand AAL2 |
| ⬜ | Session revocation on password change, all devices | open — delegated to Supabase, unverified |

## 2b. Anti-abuse and free-plan protection

Detail: `anti-abuse-system.md`. Every row here is enforced in the database where it
matters, because application-level checks can be forgotten by one route.

| | Item | State |
| --- | --- | --- |
| ✅ | Unverified address has **zero** storage allowance | `effective_plan_bytes()` returns 0; `anti-abuse.test.ts` |
| ✅ | `reserve_storage()` refuses an unverified account and a restricted one | built; two new raises in 0014 |
| ✅ | Turnstile verified server-side via Siteverify | built; fails closed when Cloudflare is unreachable |
| ✅ | Turnstile tokens are single-use, including across a lost response | `turnstile_tokens` table |
| ✅ | Disposable domains refused before an account exists | `email_domain_risk`, 49 seeded domains |
| ✅ | Unclassified domains treated as **no signal**, never as suspicious | `classify_email_domain()` returns null |
| ✅ | Risk scored from signals with a reasons array naming each factor | `score_signup()`, pure function of its inputs |
| ✅ | Enforcement is proportionate and **always expires** | `account_restrictions.expires_at`, no permanent column |
| ✅ | Automatic release without a human | `release_expired_restrictions()`, every 10 minutes |
| ✅ | Enforcement never deletes user data | no delete branch exists; asserted in `security.test.ts` |
| ✅ | Client IP resolved from trusted headers only, never the first XFF entry | `ip.ts`; 5 tests including the spoofing case |
| ✅ | IP and device values hashed with a server-side salt | `ABUSE_HASH_SALT` |
| ✅ | Device identifier is a random cookie, not a fingerprint | no canvas/font/UA enumeration anywhere |
| ✅ | No admin dashboard, review queue or approval table | asserted in `auth-security-flow.test.ts` |
| ✅ | Risk tables unreadable by any user, including the subject | 0015 grants SELECT but no policy; deny-all |
| ✅ | Repeated quota refusals escalate after the third in an hour | `record_quota_violation()` |
| ⬜ | Turnstile integration exercised against live Cloudflare | **not verified** — no keys configured |
| ⬜ | Domain feed against a real external list | **not verified** — no `DOMAIN_INTEL_URL` set |
| ⬜ | Behaviour on a real multi-instance Postgres | **not verified** — PGlite serialises on one connection |

### What the six layers genuinely do not stop

One determined person with several real email addresses and rotating IPs gets several
accounts. That is stated in §11 and in `anti-abuse-system.md` §1, and no claim anywhere
in this project contradicts it.

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
| ✅ | Every endpoint validates server-side; the client's validation is a courtesy | `src/lib/api.ts`, `tests/unit/validation.test.ts` |
| ✅ | CSRF: server actions and same-site cookies; state-changing routes require same-origin | verified |
| ✅ | Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) | `next.config.ts`, verified on a live response |
| ✅ | Rate limiting on upload, download, checkout and trash routes | Postgres-backed, `0010_rate_limit_function.sql` |
| ✅ | Dashboard routes require a verified session | `src/middleware.ts`, `getUser()` not `getSession()` |
| ✅ | Domain layer cannot see a request object | enforced by `tests/unit/architecture.test.ts` |
| ⬜ | MFA step-up for billing and account deletion | open |

## 8. Frontend

| | Item | State |
| --- | --- | --- |
| ✅ | No success message without a confirmed backend result | verified by inspection of all 13 seams |
| ✅ | No fake success; simulated actions fail visibly | done |
| ✅ | No placeholder routes (the one 404 is by design and recorded) | done |
| ✅ | Pointer targets meet WCAG 2.5.8 at 5 widths | verified, 220/220 |
| ✅ | No horizontal overflow at any tested width | verified |
| ⬜ | Automated a11y (axe) in the gate | open |
| ✅ | CSP tested against a real browser run | 220 shots with console-error detection, 0 problems |

## 9. Operations

| | Item | State |
| --- | --- | --- |
| ✅ | Cron routes require a bearer secret, return 404 otherwise | `src/lib/cron/auth.ts`, verified live |
| ✅ | Cron jobs are actually scheduled | `vercel.json`, asserted by `tests/unit/deployment-config.test.ts` |
| ✅ | Every privileged action writes an audit row | `activity_events` |
| ✅ | Failed emails logged with provider error, never swallowed | `email_log` + `email-retry` job |
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
behaviour, absence of fake success anywhere in the UI, the visual/a11y gate, the
approved price list, RLS across 27 tables, the upload quota functions under
concurrency, signature verification including replay and tampered bodies, cron
authorisation, security headers on a live response, rate limiting against the real
Postgres engine, and the anti-abuse layer's database behaviour (28 tests: banding,
escalation, expiry, idempotent release, verified-email entitlement).

**Built and tested:** the backend — RLS policies with negative tests, the 13-step upload
flow with transactional reservations, storage accounting with reconciliation, Razorpay
order and webhook verification with idempotent activation, nine Vercel cron jobs, Resend
templates with retry, Google OAuth with Set Password onboarding, optional TOTP 2FA, and
265 tests across 17 files.

**Open and named:**

- **MFA step-up** for billing and account deletion specifically. 2FA itself is built
  and enforced at sign-in; these two destructive flows do not additionally demand AAL2.
- **Malware scanning.** An integration point only — `MALWARE_SCAN_ENABLED` is false,
  and a file needing a scan stays `quarantined` with its reservation held.
- **Merchant-account capability.** `BILLING_CAPABILITIES` defaults both international
  and recurring to false because neither is confirmed. While false the server refuses
  such an order rather than creating one Razorpay will reject.
- **Row locking on a real Postgres.** `reserve_storage` uses `FOR UPDATE`, but PGlite
  serialises on one connection and cannot prove it. Verify on staging.
- **Alerting** on reconciliation drift, webhook failures and cron failures.
- **Incident response runbook** and the **breach-notification procedure**.
- **Named grievance officer / DPO**, and the pending policy decisions in
  `docs/deployment/production-readiness.md` §6.

The most useful thing this checklist does is refuse to tick a box for something that
was designed and never written. Each ✅ above names the file or the command that
proves it; where that was not possible, the row is still open.

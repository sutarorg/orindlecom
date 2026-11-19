# Production Readiness

**This document's job is to be uncomfortable.** It is the last thing between a working
demo and a service that takes money and holds people's files.

Every row is marked ✅ verified · 🟡 designed, not built · ⬜ open · ➖ n/a.
**Nothing may be marked ✅ on the strength of a design document.**

---

## 1. Verdict

> **Not ready for production, but for a different reason than before.** The backend
> is now built and tested locally: schema, RLS across 20 tables, uploads, accounting,
> billing verification, nine jobs, email, and 38 API route handlers. What remains is
> not more code — it is (a) running it against real Supabase, R2 and Dodo Payments
> projects, which has never happened, and (b) the decisions in §6 that no amount of
> implementation can clear.
>
> **On billing specifically:** the Dodo Payments integration is code-complete and
> the full lifecycle is covered by tests, but *no Dodo account has been
> configured*. No product catalogue exists, no API key is set, no webhook endpoint
> has been created, and no live payment has been taken. The administrator guide
> [`docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md`](../admin/DODO-PAYMENTS-ADMIN-SETUP.md)
> lists everything that has to happen first. Until it has been worked through in
> full, the honest status of Orindle's billing is **"code complete, account not
> configured"**, and the admin console says exactly that.
>
> The honest summary: the code is ready to be deployed and tested. It has not been.

Anything claiming otherwise contradicts this table.

---

## 2. What is genuinely verified today

| Item | Evidence |
| --- | --- |
| All 49 routes render at 5 widths | 245/245 captures, 0 defects |
| No horizontal overflow anywhere | measured, not eyeballed |
| Pointer targets meet WCAG 2.5.8 | measured, exceptions applied deliberately |
| No simulated latency anywhere in the UI | `tests/unit/architecture.test.ts` forbids the seeded-promise pattern in `src/components` |
| TypeScript clean | `tsc --noEmit` |
| Production build clean | `next build` |
| Only approved prices exist | `plan_prices` design + code constants agree |
| No secret in the repository | grep over tracked files |
| Contact success gated on provider 2xx | implemented |
| Storage units consistent (decimal) | fixed and re-verified |
| RLS across 20 tables | `tests/db/rls.test.ts` (20) plus `rls-coverage.test.ts` (7), which enumerates tables from the catalogue rather than a list |
| Quota cannot be bypassed by parallel uploads | 13 tests in `tests/db/storage.test.ts` |
| Signature verification rejects replay and tampering | `tests/unit/billing-signature.test.ts` (Razorpay, legacy) and `tests/unit/dodo-webhook-verification.test.ts` (Dodo, Standard Webhooks: tampered body, wrong secret, missing headers, stale timestamp, wrong webhook id) |
| Rate limiting is atomic across instances | `tests/db/rate-limit.test.ts` |
| Domain layer cannot see a request | `tests/unit/architecture.test.ts` |
| Docs cannot claim an unbuilt route | `tests/unit/docs-fidelity.test.ts` |
| Cron schedules resolve to real routes | `tests/unit/deployment-config.test.ts` |
| 367 tests, 25 files | `npm test` |

Every one of those runs against a real PostgreSQL engine (PGlite) or a real build,
not a mock. What none of them proves is the same code against hosted Supabase, R2 or
Dodo Payments — that is the gap that remains.

---

## 3. Functional readiness

| Area | State | Blocker to shipping |
| --- | --- | --- |
| Public site | ✅ | — |
| Auth (email/password, Google) | ✅ code, ⬜ untested against a live project | Needs a real Supabase project |
| Dashboard reads and writes | ✅ routes built (list, get, rename, move, star, download, trash, restore, purge, folders) | Needs a live project |
| Uploads | ✅ 13-step pipeline, gated scan hook | Needs R2 |
| Storage accounting | ✅ reservations, commit, release, reconciliation job | Needs a live project |
| Trash | ✅ UI + cleanup job, 30-day retention | **Retention approval (§6)** |
| Sharing | ✅ grants and expiring links; owner-only, no public URLs | Needs a live project |
| Account deletion | ✅ two-stage, 7-day grace, daily purge job; owned objects removed before rows, auth user last | **Grace period is a proposal (§6)** |
| Password change | ✅ re-authenticates with the current password; 5 attempts per 15 min | Needs a live project |
| Organisations | 🟡 schema and RLS done; **routes specified, not built** — the screens say so rather than faking success | Needs the member/folder routes |
| Billing | ✅ hosted checkout, price validation, Standard Webhooks verification, activation, renewals, cancellation, plan changes, customer portal, idempotency | **Blocked on Dodo account configuration (§6.1)** — no products, no key, no webhook endpoint, no live transaction |
| Email | ✅ 13 templates built, queue with payload and per-recipient dedupe, retry job | **Blocked on domain verification (§6)**; 10 templates specified but not built (§4.2 of `email-system.md`) |
| Cron jobs | ✅ seven, scheduled in `vercel.json` | Needs deployment |

---

## 4. Security readiness

| Item | State | Note |
| --- | --- | --- |
| RLS everywhere | ✅ | 20/20 tables, enumerated from `pg_tables` by `rls-coverage.test.ts`. Seven tables are deny-all by design (RLS on, no policy) and a test proves they return zero rows. The three new Dodo billing tables — the product mapping, the checkout sessions and the provider customers — are among them: a checkout reference and a provider customer id are not something a customer should be able to read |
| Negative isolation tests | ✅ | `rls.test.ts` (20) and `rls-coverage.test.ts` (7); each negative case is paired with a positive one so a policy that denies everything cannot pass |
| No client-supplied identity | ✅ | No route parses a `userId`; `architecture.test.ts` fails if `src/domain` names `NextRequest` |
| Signature verification | ✅ | Dodo: Standard Webhooks over the exact raw body, constant-time comparison, five-minute timestamp tolerance, all three headers required, no reason disclosed on rejection. Razorpay (legacy): raw-body HMAC, `timingSafeEqual`, replay across order and payment rejected; `/api/billing/verify` also checks the order's `notes.userId` against the session |
| Webhook idempotency | ✅ | Three layers: unique `(provider, webhook_id)` on `webhook_events`, unique `(provider_payment_id, billing_provider)` on `invoices`, and `apply_renewal` returning false for an already-applied payment. `tests/db/dodo-billing.test.ts` proves a replayed renewal writes one invoice and does not extend the period twice |
| Service key never in bundle | ✅ | `server-only` import makes a client import a build failure; backed by a grep over the build output |
| Security headers | ✅ | CSP, HSTS, frame-ancestors, referrer policy in `next.config`; 220/220 visual captures with console-error detection prove the CSP does not break the app |
| Rate limiting | ✅ | Postgres-backed `check_rate_limit`, atomic across instances; 7 tests |
| Password change re-authenticates | ✅ | A borrowed session cannot take the account |
| Malware scanning | ➖ | Not configured; nothing may claim it. A file needing a scan stays quarantined with its reservation held |
| MFA step-up | ⬜ | Accepted risk; billing and deletion are not step-up protected |
| Breach notification runbook | ⬜ | Required under DPDP |

---

## 5. Operational readiness

| Item | State |
| --- | --- |
| Backups configured | 🟡 |
| **Restore rehearsed** | ⬜ **never performed** |
| PITR window confirmed | ⬜ unconfirmed |
| R2 versioning on production | ⬜ not configured |
| Alerting | ⬜ none |
| Incident runbook | ⬜ not written |
| On-call | ➖ single-operator project |
| Log retention (DPDP Rules r.6, one year from 13 May 2027) | ⬜ not implemented |
| Cost monitoring | ⬜ |
| Load tested | ⬜ |

---

## 6. Blockers that are decisions, not code

These cannot be resolved by writing software. Each needs a human answer.

1. **Dodo Payments account configuration and approval.** This is the largest
   remaining gap and it is entirely an account-and-configuration task, not a coding
   one. It covers: business verification and KYC (including beneficial-owner
   details), whether Dodo will underwrite the cloud-storage subscription model at
   all, the 80-product recurring catalogue, the test and live API keys, the webhook
   endpoint and its signing secret, and the Customer Portal policy settings. The
   administrator guide lists each step and the exact amount to enter for every
   plan, currency and period. Until the catalogue exists and is mapped in
   `billing_provider_prices`, every checkout **fails closed** — which is the
   intended behaviour, but it means no plan can be sold.
2. **Approved payment methods and tax treatment.** Which methods may the copy
   name? And is the tax exclusive or inclusive? The published prices in
   `plan_prices` are exact amounts, so if tax were added on top the customer would
   be charged more than the price shown — the tax configuration has to match the
   pricing page.
3. **Supabase plan and PITR.** Determines whether the RPO above is 5 minutes or 24
   hours. Must be known before promising customers anything about recovery.
4. **R2 region.** Determines what can honestly be said about data residency. The
   privacy policy must not assert a location until a bucket has one.
5. **Verified sending domain** for Resend. Without it, transactional email reaches
   exactly one address.
6. **Trash retention approval.** `TRASH_RETENTION.approved` is `false`; the UI says
   provisional. Someone has to approve 30 days. The deletion grace period needs the same
   approval — 7 days is a proposal.
7. **Organisation billing model.** Does an org have its own subscription, or does it
   inherit the owner's? This changes the schema and is currently unresolved.
8. **Grievance officer / DPO contact.** Required to be displayed under the
   CP(E-Commerce) Rules and DPDP. The support address exists; the named role does not.

---

## 7. Compliance readiness

| Requirement | State |
| --- | --- |
| Policies published as data | ✅ |
| Unresolved claims marked as placeholders | ✅ |
| No invented certifications | ✅ |
| CP(E-Commerce) 48h / 1 month stated | ✅ in copy |
| Same commitments enforced operationally | ⬜ no ticket system |
| DPDP erasure path | ✅ built — request, 7-day grace, typed confirmation, cancel by signing in, daily purge; billing records retained for tax law |
| DPDP breach notification (Board + each Data Principal) | ⬜ no runbook |
| Child-user safeguards (§9) | ⬜ not implemented |
| Consent records | ⬜ not implemented |
| EU Data Act switching (2-month notice, 30-day transition, 30-day retrieval) | 🟡 documented; portability tooling not built |
| Export produces a real, complete bundle | 🟡 designed |

---

## 8. Documentation readiness

| Document | State |
| --- | --- |
| `implementation-audit.md` | ✅ |
| `backend-architecture.md` | ✅ |
| `database-schema.md` | ✅ |
| `api-reference.md` | ✅ |
| `storage-architecture.md` | ✅ |
| `payment-lifecycle.md` | ✅ |
| `admin/DODO-PAYMENTS-ADMIN-SETUP.md` | ✅ |
| `email-system.md` | ✅ |
| `security/threat-model.md` | ✅ |
| `security/security-checklist.md` | ✅ |
| `deployment/deployment-guide.md` | ✅ |
| `deployment/environment-variables.md` | ✅ |
| `deployment/backup-and-recovery.md` | ✅ |
| Migrations | ⬜ not written |
| Tests | ⬜ not written |

Documentation is complete **as design**. It becomes true as the code lands, and each
document must be corrected in the same commit that diverges from it. This project has
already had one round of doc/code drift and does not need another.

---

## 9. Exit criteria for calling this production-ready

All must be true simultaneously:

- [ ] Migrations applied, RLS enabled on every table, negative tests passing
- [ ] The 13-step upload flow implemented and proven, including the concurrency test
- [ ] Storage accounting reconciles against real R2 objects
- [ ] Trash cleanup runs and is observed running
- [ ] Subscription expiry preserves files, verified by test
- [ ] Billing verified end-to-end with Dodo test mode, including a renewal, a failed
      renewal, a scheduled cancellation, a scheduled downgrade and the Customer
      Portal, then once with live keys at minimum amount
- [ ] Duplicate webhook delivery produces exactly one invoice
- [ ] A Dodo product catalogue exists for every approved plan, currency and period,
      and every entry is mapped in `billing_provider_prices`
- [ ] A real recurring subscription object exists in the Dodo dashboard, not just a
      successful payment
- [ ] Every legacy Razorpay subscription has been reviewed against the transition
      procedure, and no customer holds two live arrangements
- [ ] Email sends from a verified domain to a third-party address
- [ ] Security headers set and verified
- [ ] Restore rehearsal passed and recorded
- [ ] No `mismatch` in health
- [ ] Visual gate green against the production host
- [ ] Every blocker in §6 has a written answer

---

## 10. What happens next

The build order in `implementation-audit.md` §9 is the plan: schema and RLS first,
because every subsequent test depends on them, then identity resolution, storage,
uploads, files/folders/trash/sharing, organisations, billing, email and jobs — with the
RLS negative tests landing in the same change as the first migration rather than
"sometime later".

A completion report written before those exit criteria are met would be the exact
failure this project has spent five phases avoiding.

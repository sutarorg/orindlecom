# Completion Report — PROMPT 6

**Date:** 16 November 2026
**Branch:** `arena/a6d6894c-orindlecom`
**Scope:** the production backend behind the five completed frontend phases.

This report is written to be checked. Every claim below names the file or the command
that proves it, and §7 lists what is not done — because a completion report that only
lists successes is a marketing document, and this is not one.

---

## 1. What exists now

| | Count | Where |
| --- | --- | --- |
| Database migrations | 16 | `supabase/migrations/` |
| Tables with RLS enabled | 20 | `0009_row_level_security.sql` |
| API route handlers | 35 | `src/app/api/` |
| Documented endpoints built | 24 | `docs/backend/api-reference.md` (marked ✅) |
| Documented endpoints specified, not built | 41 | same file (marked ⬜) |
| Cron jobs, all scheduled | 7 | `vercel.json` |
| Automated tests | 265 | `npm test`, 14 files |
| Tests against a real Postgres engine | 71 | `tests/db/` (PGlite) |
| Documentation files | 38 | `docs/backend`, `docs/security`, `docs/deployment`, `docs/seo` |

---

## 2. The requirements, one at a time

Each row states the requirement, then what in the repository satisfies it. Where the
requirement is only partly met, the row says so.

### 2.1 Identity and access

| Requirement | How it is met |
| --- | --- |
| Never trust a client-supplied user id | No route accepts a `userId`. Identity comes from `resolveActor()`, which reads the verified session. Enforced by `tests/unit/architecture.test.ts`, which fails if any file in `src/domain` parses one from a body. |
| RLS everywhere | 20/20 tables. `tests/db/rls-coverage.test.ts` enumerates tables from `pg_tables`, so a new table is covered the moment it exists, and proves four deny-all tables really do return zero rows. |
| Negative tests | `tests/db/rls.test.ts` (20) and `rls-coverage.test.ts` (7) assert that one user cannot read, update or delete another's rows — with the positive case asserted too, so a policy that denies everything cannot pass. |
| Domain logic cannot see a request | `architecture.test.ts` fails if `src/domain/**` imports `next/headers` or names `NextRequest`. This is what makes "server-side validation only" structural rather than a convention. |
| Protected routes gated | `src/middleware.ts` uses `getUser()` (server-validated), not `getSession()`. `tests/unit/middleware-policy.test.ts` pins the exempt list — webhooks, cron, auth callbacks, health — because a webhook behind a login redirect would look like it ran and do nothing. |

### 2.2 Storage

| Requirement | How it is met |
| --- | --- |
| 13-step upload flow | `src/domain/storage/upload-service.ts`; steps 1–7 in `/api/uploads/prepare`, 9–13 in `/api/uploads/:taskId/complete`. |
| Transactional reservation, parallel uploads cannot bypass quota | `reserve_storage` locks the usage row `FOR UPDATE`; `commit_reservation` refuses over-commit and double-commit; `release_reservation` is idempotent. `tests/db/storage.test.ts` (13 tests) asserts five concurrent 3 GB reservations against a 10 GB plan never all succeed. |
| Storage accounting across six tiers | `storage_usage` holds committed, reserved and trash bytes; `StorageUsage` exposes total, committed, reserved, trash and available. |
| Reconciliation | `/api/cron/reconcile-storage` reports drift and repairs nothing silently. |
| Trash retention, centrally configurable | `TRASH_RETENTION_DAYS`, read once in `src/lib/drive/types.ts`; the UI derives remaining days from each row's own `purge_at`, not from the constant. |
| No permanent public URLs | Every read mints a presigned URL with a 300-second expiry (`downloadUrl`). Inline rendering is refused outside a safe MIME list, and the response reports the disposition actually granted — an inline SVG on a presigned URL is a script-execution vector. |
| Malware scanning as an integration point only | `MALWARE_SCAN_ENABLED` is `false`. A file that needs a scan stays `quarantined` **with its reservation held**, so it is neither downloadable nor quota-free. No document claims scanning is active. |

### 2.3 Billing

| Requirement | How it is met |
| --- | --- |
| Server-side price only | The checkout request has no amount field. `resolveApprovedPrice` reads `plan_prices WHERE approved = true`. |
| Signature + webhook verification | HMAC compared with `timingSafeEqual`; webhooks verify the **raw** body, because JSON key order is part of the signed bytes. `tests/unit/billing-signature.test.ts` (15) covers wrong secret, replay across order and payment, and a tampered body. |
| Idempotency | `invoices.provider_payment_id` is unique. A replayed webhook inserts nothing; a 23505 is acknowledged as a duplicate rather than retried forever. |
| Expiry downgrades but never deletes | `subscription-sweep` moves a lapsed subscription to `expired`, records a recovery window and warns at 0/7/30/60/83 days. It contains no write to `files`, and a test asserts that. `tests/db/billing-invariants.test.ts` proves the file count is unchanged after a downgrade and after expiry. |
| 90-day recovery, configurable | `RECOVERY_WINDOW_DAYS`, validated server-side. |
| INR/USD monthly only, no invented prices | `config/pricing.ts` has `yearly: null` on all six plans, and `tests/unit/pricing.test.ts` asserts it. Only INR and USD are published. |
| No unapproved payment method promised | `BILLING_CAPABILITIES` gates international and recurring to `false`, and while false the server **refuses** such an order rather than creating one Razorpay will reject. |

### 2.4 Email and jobs

| Requirement | How it is met |
| --- | --- |
| Resend, server-side, to the owner | `src/lib/resend/client.ts` — 13 built templates with plain-text alternatives, `reply_to` the support inbox, no tracking pixels. `docs/backend/email-system.md` §4.1 lists what is built and §4.2 what is specified. |
| Failures logged, never swallowed | `email_log` plus `/api/cron/email-retry`: queued rows are sent on the next run, failed rows retry at 1m/5m/30m/2h/12h, rendering from the payload stored with the row. |
| Each notification sent once per recipient | `dedupe_key` is unique in the database (0013), so two concurrent sweep runs cannot both send. |
| No in-memory timers | All scheduling is Vercel cron (`vercel.json`); rate limits are counted in Postgres. A test forbids the seeded-promise pattern that simulates a request. |
| Cron authorisation | Constant-time bearer compare; failure returns **404, not 401**, so the endpoints do not advertise themselves. Verified live: no header → 404, wrong secret → 404, correct secret → 200. |

---

## 3. The quality gate, all six phases

| Gate | Result |
| --- | --- |
| Visual regression, 49 routes × 5 widths | **245 shots, 0 with problems** — re-run after every backend change that touched a component, with console-error detection on, so the CSP is proven not to break the app |
| `tsc --noEmit` | clean |
| `next build` | clean, 38 API routes |
| `npm run lint` | **0 errors**, 40 warnings |
| `npm test` | **265 passed, 17 files** |
| Live behaviour with no credentials | `/api/health` reports every subsystem `missing`; protected endpoints answer 503 `not_configured` with a sentence, never a fake success |

The lint script is worth a note. It had never run: `next lint` was removed in Next 16
and the old script failed with `no such directory: /lint`. Wiring ESLint properly
immediately found four real defects, described in §5.

---

## 4. What was fixed rather than assumed

Each of these was found by a test or a linter, not by review.

1. **`createOrder` never sent `notes.userId`.** The webhook requires it, so every
   genuine payment would have thrown instead of activating a plan.
2. **`/api/billing/verify` trusted a signature without checking ownership.** A valid
   signature from someone else's order would have activated a plan. It now reads the
   order's notes back from Razorpay and compares `notes.userId` to the session;
   missing notes fail closed.
3. **`resolveUserByEmail` ignored its argument** and returned whichever profile came
   first — so `addGrant` could have granted file access to an arbitrary stranger.
4. **`folder-access-dialog` rendered fewer hooks on close** (two `useMemo` calls below
   an early return), which React throws on. The same mistake was repeated twice more
   while I was writing new code, and the hook rule caught it both times.
5. **`presignGet` existed and nothing called it**, so no file could be downloaded at
   all. Added `downloadUrl` to the contract and `POST /api/download/:id`.
6. **`expire-reservations` marked every pending file the owner had as failed**, not
   just the abandoned upload — including a concurrent upload in another tab.
7. **The API reference promised ~60 endpoints of which 15 existed.** It was written as
   a specification and read as a record. Every row now carries ✅ or ⬜, and
   `tests/unit/docs-fidelity.test.ts` fails if either mark is wrong.
8. **`storage-architecture.md` said inline previews were restricted to safe types.**
   They were not. The code now enforces it.
9. **The subscription sweep wrote email rows nothing would ever send.** It inserted
   `status = 'queued'`, and `email-retry` only read `status = 'failed'`. Every
   expiry warning — the mail that tells a customer their files are about to leave
   the Free tier — was written and never sent. It also invented the address
   (`pending-resolution`), so sending it would have failed anyway.
10. **Duplicate suppression was global, not per subscriber.** The sweep asked "has
    any row been sent with this template?" So the first customer to reach day 7 of
    recovery suppressed day-7 warnings for every other customer, permanently.
11. **Retries re-sent with an empty payload.** `data: {}` meant a retried
    `verify-email` arrived with a blank confirmation link. A malformed email is
    worse than a missing one: the customer believes they were helped.

9–11 were all in the email path, all silent, and all found by reading the job
against its own log table rather than by any test — which is why they now have
fourteen tests of their own, including one that asserts the dedupe index allows
the same warning for two different subscribers.

---

## 5. Honest gaps

These are not done. Each is also stated in `docs/deployment/production-readiness.md`.

**Never run against real infrastructure.** The schema, RLS policies, upload pipeline
and billing logic have been exercised against a real PostgreSQL engine and a real
Next.js build — not against hosted Supabase, Cloudflare R2 or Razorpay. That is the
single largest gap, and no amount of test count closes it.

**Row locking on real Postgres is unproven.** `reserve_storage` uses `FOR UPDATE`,
but PGlite serialises on one connection, so the test cannot distinguish a working lock
from a missing one. Verify on staging with two real connections.

**Not built:**

- Email change (`POST /api/users/me/email`) — no UI calls it.
- MFA step-up for billing and account deletion.
- Data export (`/api/users/me/export`).
- Organisation routes (members, invitations, shared folders) — the schema and RLS
  exist; the routes do not, and those screens report that plainly rather than faking
  success.
- Alerting, incident runbook, breach-notification procedure.
- Malware scanning itself.

**Decisions, not code** — `production-readiness.md` §6:

1. Razorpay international capability — confirmed?
2. Razorpay recurring capability — confirmed?
3. Approved payment methods to advertise
4. Supabase PITR window
5. R2 region, which blocks any data-residency claim
6. Verified Resend sending domain
7. Trash retention approval (30 days is a proposal, labelled provisional in the UI)
8. Organisation billing model — own subscription, or inherits the owner's
9. Named grievance officer / DPO

---

## 6. The claim this report is willing to make

> The backend is implemented and tested locally, and the interface no longer pretends
> anywhere. It is ready to be deployed to staging and tested against real Supabase, R2
> and Razorpay projects. It is not ready for production, and the blockers are listed
> above rather than hidden in a footnote.

What that means concretely.

**True today:** the schema applies cleanly from empty; RLS isolates tenants; quota
cannot be bypassed by concurrency; a payment cannot activate a plan without a verified
signature belonging to the caller; expiry and downgrade never delete a file; every
scheduled job is registered and refuses to run without its secret; nothing in the UI
reports success the server did not confirm; and 265 automated checks fail if any of
that stops being true.

**Not true today, and never claimed:** that this has served a real request, charged a
real card, or stored a real file in R2. It has not. The health endpoint says
`missing` for every subsystem, and it is right.

---

## 7. How to verify this report

```bash
npm install
npm test                 # 265 tests, 17 files
npm run test:count       # rewrites .verify/test-counts.json from the runner's report
npm run lint             # 0 errors
npx tsc --noEmit         # clean
npx next build           # clean
npx next start -p 3000 -H 0.0.0.0
curl -s localhost:3000/api/health     # every subsystem "missing" on a bare checkout
curl -s localhost:3000/api/storage    # 503 not_configured, not a redirect
curl -sI localhost:3000/ | grep -i content-security-policy
CRON_SECRET=x npx next start -p 3001 &
curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/cron/trash-cleanup   # 404
curl -s -H 'Authorization: Bearer x' localhost:3001/api/cron/trash-cleanup      # 200
```

To check the documents rather than the code: read `docs/backend/api-reference.md` and
pick any row marked ✅, then confirm the route exists. Pick any row marked ⬜ and
confirm it does not. That distinction is enforced by a test, so it holds.

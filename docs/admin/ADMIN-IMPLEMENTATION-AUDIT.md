# Admin Dashboard — Implementation Audit

**Date:** 16 November 2026
**Branch base:** `df7aaf6` (after Prompt 8 merged)
**Purpose:** record what exists, what is genuinely available, what needs new database
work, and what needs credentials — before any code was written.

Every statement below was checked against the source tree, not against the older
planning documents. Where those documents disagree with the code, the disagreement is
recorded in §7.

---

## 1. What already exists and is reusable

### Authentication and identity

| Thing | Path | Reuse |
| --- | --- | --- |
| Verified-session actor | `src/domain/auth/actor.ts` | **Direct.** `resolveActor()` already returns `emailVerified` and refuses unverified accounts. The admin guard is built on top of it, not beside it |
| User-scoped Supabase client | `src/lib/auth/supabase/server.ts` | **Direct.** Already request-scoped and cookie-bound |
| Privileged client | `src/lib/supabase/service.ts` | **Direct**, but only after authorization; its doc comment enumerates its permitted uses and this feature adds one to that list |
| Error envelope | `src/domain/auth/errors.ts`, `src/lib/api.ts` | **Direct.** `AppError`, `handle()`, `ok()`, `fail()`, `withActor()` |
| Postgres rate limiter | `src/lib/rate-limit.ts` + `0010` | **Direct.** New buckets added to `LIMITS` |
| Cron authorisation | `src/lib/cron/auth.ts` | Untouched |

### Data that genuinely exists in the database

| Table | Migration | Usable for admin? |
| --- | --- | --- |
| `profiles` | 0002 | Yes — name, locale, `country_code` (never populated by any code path today, see §7) |
| `plans`, `plan_prices`, `currencies` | 0002 | Yes — the approved price catalogue, INR/USD monthly only |
| `subscriptions` | 0005 | Yes — but **no billing period is stored** (see §4.1) |
| `invoices` | 0005 | Yes — `amount_minor`, `currency`, `status`, `paid_at` |
| `storage_usage` | 0006 | Yes — authoritative committed/reserved/trash |
| `storage_reservations` | 0006 | Yes |
| `organizations`, `members` | 0003 | Yes, read-only |
| `activity_events` | 0008 | Yes — but sparse; only billing and storage paths write to it |
| `support_requests` | 0008 | Table exists; **nothing writes to it** (see §4.2) |
| `email_log` | 0008 | Yes — delivery state for operational logs |
| `webhook_events` | 0005 | Yes — processing outcome, payload must not be exposed |
| `auth.users` | — | Reachable only through privileged SQL; see §4.3 |

### UI primitives that exist and are reusable

`Button` (6 variants), `Dialog`, `Menu`, `Toast`, `Skeleton`, `EmptyState`
(4 variants), `PageHeader`, plus the design tokens in `src/styles/tokens.css`
(`--brand-primary #3178fb`, ink `#171d3a`, canvas `#fbfcff`, borders
`#e6e9f2`/`#eef1f7`). Lucide React 0.545 is installed.

The dashboard shell (`src/components/dashboard/dashboard-shell.tsx`) already solves the
hard responsive problem: 248px sidebar → 68px rail at tablet → full-height overlay sheet
with scrim, Escape, focus trap, scroll lock and focus restore on mobile. The admin shell
is a **sibling** of it, not a copy: admin navigation is a different tree with a different
logout contract, and inheriting the upload manager and file picker would mount machinery
an admin console has no use for.

---

## 2. What does not exist and must be built

### 2.1 No platform-administrator concept of any kind

There is no admin table, no admin role, no admin route. `BusinessRole`
(`owner | admin | member` in `src/lib/business/roles.ts`) governs **organization
membership** and is structurally unrelated. Confusing the two would mean every business
owner becomes a platform administrator — the exact failure the requirement names.

`tests/unit/auth-security-flow.test.ts` currently asserts that **no** directory under
`src/app/` matches `/(admin|abuse-dashboard|review-queue)/`. That assertion must be
narrowed to forbid *anti-abuse* surfaces rather than all admin routes, and it must gain
new, stronger assertions in exchange. It may not simply be deleted.

### 2.2 No audit log

`activity_events` is customer-facing activity, not an operator audit trail: it is
readable by organization members, and it has no notion of an administrator acting on
platform data. A separate immutable table is required.

### 2.3 No support workflow

`support_requests` has `delivery_status`, which describes **whether the notification
email was delivered** — not whether the case is open. Those are different facts and must
stay in different columns.

### 2.4 No analytics integration

There is no analytics script, no page-view collection, and no reporting client.
`src/config/legal/cookies.ts` states, in the cookie table and again in "What is not
here", that Orindle sets no analytics cookies and runs no tracking script. Introducing
GA4 therefore requires a consent mechanism and a policy change, not merely a script tag.
That is scoped in §5.

### 2.5 No chart library

Nothing is installed for charts. Given one compact growth chart and a handful of bars,
hand-written SVG is the right call: no bundle cost, no hydration risk, full control of
the accessible text alternative.

---

## 3. Admin capabilities and where their data comes from

| Page | Source of truth | New database work |
| --- | --- | --- |
| Overview | `auth.users`, `subscriptions`, `invoices`, `storage_usage`, `activity_events` | Aggregation functions |
| Users | `auth.users` + `profiles` + `subscriptions` + `storage_usage` | A directory function with server-side search, filter and sort |
| User detail | Same, plus `invoices`, `members` | None beyond the directory |
| Billing | `subscriptions` (**with the new `billing_period`**), `invoices`, `plan_prices` | `billing_period` column + MRR function |
| Storage | `storage_usage`, `storage_reservations`, `plans` | Aggregation function |
| Teams | `organizations`, `members` | Directory function |
| Support | `support_requests` + new `support_messages` | Status/assignment columns, messages table, contact-form persistence |
| Analytics | External provider | None (adapter only) |
| Logs | New `platform_admin_audit_logs` + `email_log` + `webhook_events` + cron state | Audit table |
| Settings | `platform_admins`, `plans`, `plan_prices`, env presence | None |

---

## 4. Gaps that must be fixed as part of this work

### 4.1 Subscriptions do not store a billing period — MRR is currently uncomputable

`activateSubscription()` accepts `period: "monthly" | "yearly"` and uses it only to
compute `period_end`. The `subscriptions` table has no period column, so **after
activation the information is gone**. Any MRR figure derived today would have to assume a
period, which is precisely the invented revenue the requirement forbids.

Fix: `subscriptions.billing_period text check (billing_period in ('monthly','yearly'))`,
nullable, written from the **server-verified** period (order notes for the callback path,
the payment's own notes for the webhook path). Where it is null, MRR excludes the row
rather than guessing.

**Backfill policy:** only where an existing invoice amount exactly equals an approved
`plan_prices` row for the same plan and currency. That is evidence, not inference. Rows
with no such match stay null and are reported in the admin UI as "period unknown" rather
than being counted.

### 4.2 The contact form never persists a support request

`src/app/contact/actions.ts` sends mail to Resend and writes nothing to the database. If
Resend is down, the message is lost entirely. The requirement is explicit: persist first,
survive delivery failure, report the true delivery state.

Note the existing action uses an **in-memory** rate-limit map. That predates the Postgres
limiter and is left alone in place (it is a speed bump, and the doc says so), but the
persistence path will use the durable limiter.

### 4.3 There is no SQL access path to `auth.users` from the service client

The Supabase JS client cannot query the `auth` schema. The user directory needs to join
`auth.users` (email, `created_at`, `email_confirmed_at`) with `profiles`,
`subscriptions` and `storage_usage`, with **server-side** search across email and name,
and bounded pagination.

Fix: a `security definer` function `admin_user_directory(...)` with a fixed
`search_path`, `revoke execute from public, anon, authenticated`, `grant execute to
service_role`. This is the documented escape hatch the requirement allows, and it is
narrowly scoped to one read-only query shape.

### 4.4 `profiles.country_code` exists but is never written

No code path populates it. The Users table therefore **omits the country column**
rather than rendering an always-empty one. If it is populated later, the column is in
the directory function's result already.

---

## 5. Analytics: what is real, what is scoped

GA4 reporting needs three things, none of which exist:

1. A Measurement ID (public, browser) — for collection.
2. A service-account credential with the Analytics Data API enabled (secret, server).
3. A numeric GA4 property ID.

This build implements the **reporting adapter** and the whole six-tab UI, with three
distinguishable states (not connected / connected but no data / data). It also implements
the consent gate, because adding a tracking script without one would directly contradict
the current published cookie policy.

**Not implemented:** actual collection of page views inside Orindle's own pages beyond
the standard GA snippet loaded behind consent, and Search Console, which needs its own
OAuth/service-account grant on a verified property. The repository's SEO docs already
record Search Console as unverified; that remains true.

---

## 6. Environment configuration required

| Variable | State before | Needed for |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | absent | Browser collection |
| `GA_PROPERTY_ID` | absent | Reporting |
| `GA_SERVICE_ACCOUNT_EMAIL` | absent | Reporting |
| `GA_SERVICE_ACCOUNT_PRIVATE_KEY` | absent | Reporting (secret) |
| `GSC_SITE_URL` | absent | Search Console |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | absent | Consent default |

Everything else the admin console needs — Supabase, service role, Razorpay, Resend, R2,
`CRON_SECRET` — already exists in `.env.example`.

---

## 7. Inconsistencies found between code and documentation

| Claim in a document | Actual state | Action |
| --- | --- | --- |
| `docs/security/security-checklist.md` §11 "Verified today … RLS across 27 tables" | True as of the last commit; adding tables makes the number stale | Update |
| `docs/deployment/production-readiness.md` route/shot counts (49 routes, 245 shots) | True before this work | Update after the gate runs |
| `docs/backend/api-reference.md` marks every API row ✅ or ⬜ | Enforced by `tests/unit/docs-fidelity.test.ts` | New admin routes must be added with correct marks |
| Anti-abuse docs state there is no administrator surface at all | Will become inaccurate once `/admin` exists | Reword to "no anti-abuse *monitoring* surface", which is the requirement that actually holds |
| `src/lib/business/empty-repository.ts` is the only business repository | Confirmed — the customer-facing business APIs are not implemented | Teams page uses its own admin data layer, and says so in the UI |

---

## 8. Deliberate non-goals, restated

Not built, and not to be built by accident later without a separate reviewed design:

- account impersonation
- customer account deletion or suspension from the admin UI
- arbitrary plan assignment or manual payment confirmation
- refund controls
- storage deletion or manual quota adjustment
- any anti-abuse monitoring, review queue or approval workflow
- editing platform prices from the UI

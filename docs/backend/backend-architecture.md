# Backend Architecture

**Status:** Decisions locked. Implementation follows in dependency order.
**Scope:** The modular monolith behind the existing frontend. No redesign, no
component rewrites beyond replacing simulated calls with real ones.

---

## 1. Shape

A **modular monolith** deployed as one Next.js application on Vercel, with a domain
layer that does not know HTTP exists.

```
Browser
  │
  ├── server actions / route handlers   ← HTTP boundary, auth, validation
  │        │
  │        ▼
  ├── domain services                   ← business rules, no HTTP, no SQL strings
  │        │
  │        ▼
  ├── repositories                      ← the only place SQL lives
  │        │
  │        ▼
  └── Postgres (Supabase) + R2 + Razorpay + Resend
```

Four rules make this a real separation rather than three folders:

1. **A service never reads a cookie.** Identity is passed in as an explicit
   `Actor`. The HTTP layer resolves it, once, and everything downstream receives it
   as a parameter.
2. **A service never builds SQL.** It calls repository methods. Repositories return
   typed rows; they never return HTTP codes or user-facing copy.
3. **A route handler never contains a business rule.** If a rule matters, it lives
   in a service, because the same rule is needed by a webhook, a cron job, or a
   server action.
4. **A repository never trusts its input.** RLS is the second line of defence; the
   first is that every query is scoped by an id the service resolved from the
   session.

### 1.1 Directory layout

```
src/
  domain/
    auth/            identity, session, actor resolution
    users/           profile, email, password, deletion
    files/           file metadata, versions, listing
    folders/         tree, move, rename
    storage/         quota, reservations, accounting, reconciliation
    sharing/         grants, links, permission evaluation
    trash/           soft delete, retention, purge
    subscriptions/   plan state, expiry, recovery window
    billing/         checkout, orders, webhook verification, invoices
    organizations/   org lifecycle
    members/         invitations, roles, removal
    permissions/     the single capability table shared by all of the above
    activity/        the event log
    support/         contact + support intake
    notifications/   transactional email orchestration
  lib/
    supabase/        client factories (user-scoped, service-scoped)
    r2/              object keys, presigning, multipart
    razorpay/        API wrapper + signature verification
    resend/          delivery wrapper
    drive/           UNCHANGED — the existing UI-facing contract
    business/        UNCHANGED
    auth/            UNCHANGED — already live
```

`src/lib/drive` and `src/lib/business` keep their current shape. They become thin
adapters that call domain services and map results into the `DriveResult` /
`BusinessResult` envelopes the components already branch on. **This is the reason
the frontend needs no rewrite:** the contract was designed for exactly this.

---

## 2. The actor — how identity enters the system

The hard requirement is *never trust a client-supplied user id*. There is exactly one
way identity enters:

```ts
// src/domain/auth/actor.ts
export interface Actor {
  userId: string;          // from the verified session, never from a request body
  email: string;
  emailVerified: boolean;
  organizationIds: string[]; // orgs this user is an active member of
}

export type ActorResult =
  | { ok: true; actor: Actor }
  | { ok: false; code: "unauthenticated" | "email_unverified" | "not_configured"; message: string };
```

`resolveActor()` reads the Supabase session server-side, validates the JWT, loads
memberships, and returns the `Actor`. Consequences, enforced by convention and by
test:

- No service method signature accepts a `userId` parameter that the caller could
  have read from a request body. Where a target user must be identified (removing a
  member, changing a role), it is a **subject** id, and the actor's authority over
  that subject is checked.
- Route handlers destructure only body fields that are *inputs*, never identity.
- A test asserts that no file under `src/domain/` imports `next/headers` or a
  request object — the domain layer cannot even see a request.

### 2.1 Route protection

`middleware.ts` currently sets a currency cookie and nothing else. It gains a session
refresh and a `/dashboard/**` gate:

- Anonymous request to `/dashboard/**` → redirect to `/login?next=…`.
- `/api/**` (except `/api/webhooks/*`, which are authenticated by signature) →
  `401` with a JSON error envelope, never a redirect, so clients see why.
- The existing currency behaviour is preserved untouched.

---

## 3. Error contract

One envelope for every HTTP failure, so the client never has to guess:

```json
{ "ok": false, "code": "quota_exceeded", "message": "…", "fields": { "name": "…" } }
```

`code` values are the union already defined by the frontend: `not_configured`,
`not_found`, `forbidden`, `conflict`, `quota_exceeded`, `invalid_name`,
`rate_limited`, `network`, `unsupported`, `unknown`, plus `unauthenticated` and
`validation_failed`. Mapping is mechanical, which is why the UI will not need new
error states.

**`message` is written for the person using the product.** `invalid_name` does not
say "constraint violation"; it says "A file name can't contain / or \\\".

---

## 4. Data access and RLS

Two client types, and the difference is the whole security model:

| Client | Key | Used by | RLS |
| --- | --- | --- | --- |
| **User-scoped** | anon/publishable + user JWT | Everything answering a user request | Enforced, as that user |
| **Service** | service-role, server only | Trash cleanup, quota reconciliation, webhook processing, invite acceptance lookups | Bypassed — must re-implement authorization itself |

The service client is dangerous, so its use is constrained:

- It lives in one module, `src/lib/supabase/service.ts`, which starts with
  `import "server-only"`.
- Every call site passes an explicit reason in a comment and in the audit log row it
  writes.
- A test greps the built client bundle for the service key and fails if present.

> The existing `.env.example` states "Nothing in this codebase reads [the service-role
> key]." That was true and is now superseded: privileged background work genuinely
> needs it. The variable is added, the invariant is rewritten to "the key exists only
> in the server environment and never in a client bundle, enforced by test", and the
> comment is corrected rather than left to contradict reality.

### 4.1 Policies

Every table gets RLS enabled and *no* table has a policy that returns true
unconditionally except reference data (plans, currencies). The policy set is in
`database-schema.md`; the negative tests that prove it are described in §7.

Two categories of table need different treatment:

- **User-owned** (files, folders, grants, subscriptions): `auth.uid() = owner_id`
  or a grant exists.
- **Organization-owned** (org folders, members, activity): membership in the org
  *and* a role that permits the operation. Membership must be checked through a
  `security definer` function to avoid recursive RLS on the members table — a
  classic source of "infinite recursion detected in policy" errors.

---

## 5. Storage (Cloudflare R2)

**Bytes never pass through the application.** The browser uploads directly to R2 with
a short-lived presigned URL. The 13-step flow is specified in
`storage-architecture.md`; the architectural points are:

- **Reservations before upload.** `storage_reservations` rows are created inside a
  transaction with a quota check that serialises per plan. Two parallel uploads
  cannot both see "9 GB free" and both take 9 GB.
- **Nothing is available until verified.** A file row exists in `pending` state
  between `prepareUpload` and `completeUpload`. `list` never returns pending rows.
- **Private by default.** Downloads are presigned GETs with minutes-long expiry. No
  permanent public URL exists for a private file.
- **Multipart** for anything over 16 MiB, with per-part presigning and a completion
  that reports the real ETag list.
- **Reconciliation** compares `storage_objects` against a listing of the bucket and
  reports drift. It reports; it does not silently delete.

---

## 6. Billing

Razorpay, server-verified, with three invariants:

1. **The price comes from the database, never from the request.** The client sends a
   `planId`; the server resolves the amount from the approved price table. A
   tampered request can choose no price at all.
2. **Nothing is activated until a signature verifies.** Both the checkout callback
   and the webhook are verified with the key secret; a webhook is additionally
   checked for freshness and deduplicated by event id.
3. **Webhooks are idempotent.** Every handler is safe to run twice, because Razorpay
   retries and will deliver duplicates.

Annual pricing is not approved: `resolvePrice` returns the monthly figure and the UI
labels it. The server refuses to create a yearly order for any plan whose `yearly`
price is `null`. That is a code-level refusal, not a UI convention.

Currency scope is INR and USD only. GBP, EUR, AED, SGD, AUD and CAD are **not**
priced and must not be added until approved. Whether the merchant account is enabled
for international and recurring payments is an **unresolved operational question**
that must be confirmed in the Razorpay dashboard before USD or subscriptions are
offered — see `payment-lifecycle.md` §9.

---

## 7. Testing strategy

No runner is installed today. The suite uses **Vitest** (already-aligned with a Vite/
Turbopack toolchain, no config ceremony) and these layers:

| Layer | What it proves |
| --- | --- |
| Unit | Pure rules: quota arithmetic, permission matrix, retention dates, price resolution |
| RLS negative (integration) | Two real identities against a disposable Postgres; every isolation claim is *attempted and refused* |
| Service integration | Upload lifecycle, reservation concurrency, webhook idempotency |
| Contract | `DriveRepository`/`BusinessRepository` adapters return the documented envelope for every error path |
| Visual gate | Existing: 220 route/width combinations — now green |

The RLS tests are the ones that matter most and are the reason §4 is not negotiable.
They cannot be written before the schema exists, so they land in the same change as
the first migration.

---

## 8. Background jobs

**No in-memory timers.** Vercel kills the process. Everything scheduled is either a
Vercel Cron hitting a route handler, or a queue-less "claim a batch" job:

| Job | Cadence | Purpose |
| --- | --- | --- |
| `trash-cleanup` | hourly | Purge items past the configured retention |
| `expire-reservations` | 15 min | Release upload reservations that were never confirmed |
| `subscription-sweep` | daily | Downgrade expired plans, start recovery window, send warnings |
| `reconcile-storage` | daily | Compare accounting against real R2 objects |
| `orphan-sweep` | daily | Delete R2 objects with no committed metadata row |
| `email-retry` | 15 min | Retry failed sends; log permanent failures |

Every job is idempotent, takes a batch limit, records what it did, and is safe to run
concurrently with itself — because Vercel can and will overlap invocations.

---

## 9. Observability

- Every privileged/service-client action writes an `activity_events` row.
- Webhook deliveries are stored raw *before* processing, so a failed handler can be
  replayed.
- Email failures are recorded with the provider's response body, never swallowed.
- No secret is ever logged; a redaction helper wraps every log call that touches
  configuration.

---

## 10. Environment separation

Three environments, and the boundaries are absolute:

| | Dev | Preview | Production |
| --- | --- | --- | --- |
| Supabase | local or dev project | dev project | production project |
| R2 bucket | `orindle-dev` | `orindle-dev` | `orindle-prod` |
| Razorpay | **test keys** | **test keys** | live keys |
| Resend | test address | test address | production |

The application refuses to start with live payment keys when `NODE_ENV !== "production"`,
and detects a mismatch between the Razorpay key prefix (`rzp_test_` vs `rzp_live_`) and
the environment. Getting that backwards is how a test run takes real money.

---

## 11. What is explicitly not being built

- No permanent public URLs to private files. If public sharing ships later it is a
  separate, explicitly authorised feature with its own expiry and revocation.
- No malware scanning engine. The integration point exists; nothing claims protection
  it does not have.
- No admin-panel UI. Operations happen through reviewed scripts and the database.
- No microservices, no message broker, no separate auth server. One deployable.

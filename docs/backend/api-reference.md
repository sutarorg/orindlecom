# API Reference

**Status:** Contract. Implements the surface the frontend already calls through
`DriveRepository` and `BusinessRepository`. Every response shape below maps onto a
result envelope the components already branch on, so nothing in the UI needs a new
error state.

---

## 1. Conventions

- Base path `/api`. All routes are server-only code; nothing is a static JSON file.
- Authentication is a Supabase session cookie. **No endpoint accepts a user id as
  input.** Identity comes from `resolveActor()`.
- Request and response bodies are JSON, except uploads (direct to R2) and downloads
  (redirect to a presigned URL).
- Errors, always:

```json
{ "ok": false, "code": "forbidden", "message": "That folder isn't yours.", "fields": {} }
```

| HTTP | Codes |
| --- | --- |
| 400 | `validation_failed`, `invalid_name`, `unsupported` |
| 401 | `unauthenticated`, `email_unverified`, `not_configured` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` |
| 413 | `quota_exceeded` (also 409 when it is a size-limit refusal) |
| 429 | `rate_limited` |
| 500 | `unknown` |

- `200` responses are `{ "ok": true, "data": … }`.
- Every mutating endpoint is idempotent or explicitly documents why it is not.
- Rate limits are per actor (or per IP for anonymous endpoints), token-bucket, in
  Postgres so they survive multiple serverless instances.

---

## 2. Files

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/files` | List. Query: `scope`, `parentId`, `search`, `sort`, `direction`, `category[]`, `cursor` |
| `GET` | `/api/files/:id` | One file's metadata |
| `PATCH` | `/api/files/:id` | Rename (`name`) |
| `PATCH` | `/api/files/:id/star` | `{ starred: boolean }` |
| `PATCH` | `/api/files/:id/move` | `{ parentId: string \| null }` |
| `DELETE` | `/api/files/:id` | Move to trash (soft) |
| `GET` | `/api/files/:id/url` | Presigned download URL, 5-minute expiry |
| `GET` | `/api/files/:id/preview` | Presigned inline URL, only for safe categories |

`GET /api/files` returns:

```json
{ "ok": true, "data": { "items": [ … ], "total": 132, "nextCursor": "…" } }
```

`total` is a real count, because the overview shows one. `items` never contains a
`pending` file.

---

## 3. Folders

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/folders/:id` | Folder + ancestry |
| `POST` | `/api/folders` | `{ name, parentId }` |
| `PATCH` | `/api/folders/:id` | `{ name }` |
| `PATCH` | `/api/folders/:id/move` | `{ parentId }` — rejects cycles |
| `DELETE` | `/api/folders/:id` | Soft delete with all descendants |

A move into own descendant is `validation_failed`, checked server-side; the UI also
greys it out, but the server does not rely on that.

---

## 4. Uploads

The four calls below are steps 6–13 of the flow in `storage-architecture.md`.

### `POST /api/uploads/prepare`

```json
{ "name": "quarterly-report.pdf", "size": 18432000, "mimeType": "application/pdf",
  "parentId": "…", "checksumSha256": "…" }
```

Returns, for single-part:

```json
{ "ok": true, "data": { "taskId": "…", "multipart": false,
  "uploadUrl": "https://…", "expiresAt": "2026-11-16T12:15:00Z" } }
```

For multipart, `{ "multipart": true, "uploadId": "…", "partUrls": [ … ] }`.

Side effects: reservation created (step 5), session row written (step 6). A failed
quota check leaves no session and no reservation.

### `POST /api/uploads/:taskId/complete`

```json
{ "parts": [{ "partNumber": 1, "etag": "…" }] }
```

Completes multipart if needed, then verifies size, commits metadata and accounting.
Returns the created `DriveItem`. Never returns success for an unverified object.

### `POST /api/uploads/:taskId/cancel`
Releases the reservation immediately. Idempotent.

### `GET /api/uploads`
Active tasks for the current actor, for the upload manager to restore state after a
navigation.

---

## 5. Storage

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/storage` | `StorageUsage`: total, committed, reserved, trash, available, byCategory |
| `GET` | `/api/storage/breakdown` | Per-category and per-folder detail for the storage page |

`authoritative` is `true` only when the figures came from the database. It is `false`
in the current deployment, and the UI says so rather than pretending.

---

## 6. Trash

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/trash` | Items in the bin, with `daysRemaining` |
| `POST` | `/api/trash/restore` | `{ ids: string[] }` |
| `POST` | `/api/trash/purge` | `{ ids: string[] }` — only acts on rows already in the bin |
| `DELETE` | `/api/trash` | Empty the bin |

`daysRemaining` is computed server-side from the retention setting so the UI never
does date arithmetic that could disagree with the cleanup job.

---

## 7. Sharing

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/files/:id/grants` | People with access |
| `POST` | `/api/files/:id/grants` | `{ email, permission }` |
| `PATCH` | `/api/grants/:grantId` | `{ permission }` |
| `DELETE` | `/api/grants/:grantId` | Revoke |
| `GET` | `/api/files/:id/link` | Current link or null |
| `PUT` | `/api/files/:id/link` | `{ permission, expiresInDays }` |
| `DELETE` | `/api/files/:id/link` | Revoke |

Granting to an email that is not a user creates an invite, not a silent no-op. The
response says which happened.

**Share link redemption** is `GET /s/:token`, a page, not a JSON endpoint: it
authorises, then 302s to a 60-second presigned URL. Expired or revoked links render a
clear explanation rather than a 404, because "this link expired" and "this never
existed" are different for the person holding it.

---

## 8. Account

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/users/me` | Profile |
| `PATCH` | `/api/users/me` | `{ fullName }` |
| `POST` | `/api/users/me/email` | Change email (re-verification required) |
| `POST` | `/api/users/me/password` | `{ current, next }` — re-authenticates |
| `POST` | `/api/users/me/delete` | `{ confirmation }` — typed confirmation required |
| `GET` | `/api/users/me/export` | Data export: a signed bundle link |

Email change and deletion both require the *current* password, checked server-side,
so a borrowed session cannot take the account.

---

## 9. Activity

`GET /api/activity?limit=&since=` — the actor's own events only. Organisation events
come from the business routes and are scoped to members.

---

## 10. Subscriptions and billing

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/billing/subscription` | Current plan, status, period end, recovery window |
| `GET` | `/api/billing/invoices` | The actor's invoices only |
| `POST` | `/api/billing/checkout` | `{ planId, period }` → order + redirect/authorisation data |
| `POST` | `/api/billing/verify` | `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }` |
| `POST` | `/api/billing/cancel` | Cancel at period end |

### Why `verify` exists

`DriveRepository.startCheckout` returns `DriveResult<{ url: string }>`. The redirect
flow satisfies that. The web-checkout overlay flow returns a signature to the
browser, which must then be verified before anything is activated — hence an
additional endpoint. `verify` exists so that neither flow can be completed without a
server-side signature check. The repository method keeps its signature; the adapter
returns the URL provided by Razorpay and the client calls `verify` if the overlay
flow was used. **No path activates a plan from a client claim.**

Checkout request never contains an amount. The server resolves it from
`plan_prices` where `approved = true`. A yearly request for a plan with no yearly
price returns `unsupported` — there is no code path that invents one.

### `POST /api/webhooks/razorpay`

Not session-authenticated. Verified by HMAC over the raw body with the webhook
secret. The event is stored raw by `(provider, event_id)` before processing; a
duplicate is acknowledged with `200` and not reprocessed. Handlers are idempotent: a
`payment.captured` delivered twice produces one invoice, because `provider_payment_id`
is unique.

---

## 11. Organisations

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/organizations` | Orgs the actor belongs to |
| `GET` | `/api/organizations/:id` | Detail |
| `PATCH` | `/api/organizations/:id` | `{ name }` — admin+ |
| `DELETE` | `/api/organizations/:id` | Owner only, typed confirmation |
| `GET` | `/api/organizations/:id/summary` | Counts and storage |
| `GET` | `/api/organizations/:id/storage` | Org storage accounting |
| `GET` | `/api/organizations/:id/activity` | Filterable event log |

### Members

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/organizations/:id/members` | Filter by role/status/search |
| `POST` | `/api/organizations/:id/members` | Invite `{ email, role, folderId?, folderAccess? }` |
| `POST` | `/api/organizations/:id/members/:memberId/resend` | Resend invite |
| `DELETE` | `/api/organizations/:id/members/:memberId/invite` | Revoke invite |
| `PATCH` | `/api/organizations/:id/members/:memberId/role` | `{ role }` |
| `DELETE` | `/api/organizations/:id/members/:memberId` | Remove |
| `POST` | `/api/organizations/:id/transfer` | `{ memberId }` — owner only |

Role rules are enforced **server-side** by `permissions` module, and mirrored in RLS.
`canAssignRole` and `removalBlocker` in `src/lib/business/roles.ts` are UI
affordances; the server re-checks the same rules and does not call the UI helpers,
because a client can bypass them. A test asserts server and UI agree on every
(actorRole, targetRole) pair so the two cannot drift.

The last owner cannot be removed or demoted — `removalBlocker` returns a reason and
the server rejects with `conflict` plus that reason.

### Organisation folders

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/organizations/:id/folders` | List |
| `POST` | `/api/organizations/:id/folders` | Create `{ name }` |
| `PATCH` | `/api/organizations/:id/folders/:folderId` | Rename |
| `DELETE` | `/api/organizations/:id/folders/:folderId` | Delete |
| `PUT` | `/api/organizations/:id/folders/:folderId/access` | `{ level }` — default folder access |

---

## 12. Support

`POST /api/support/contact` is the only anonymous write endpoint. It:
- validates every field server-side
- applies the honeypot, minimum-fill-time and rate limit
- writes a `support_requests` row with `delivery_status = 'pending'`
- sends via Resend to the support inbox (a server constant, never request-derived)
- returns `delivered: true` **only** after a provider 2xx; anything else is reported
  as `pending`/`failed` with a working fallback address

The existing server action at `src/app/contact/actions.ts` already implements this
contract and is kept; this route exists so non-browser clients and future forms share
one implementation.

---

## 13. Cron

All cron routes require `Authorization: Bearer ${CRON_SECRET}`, compared in constant
time. Without it they return `404`, not `401`, so the existence of the job is not
advertised.

| Path | Cadence |
| --- | --- |
| `/api/cron/trash-cleanup` | hourly |
| `/api/cron/expire-reservations` | 15 min |
| `/api/cron/subscription-sweep` | daily |
| `/api/cron/reconcile-storage` | daily |
| `/api/cron/orphan-sweep` | daily |
| `/api/cron/email-retry` | 15 min |

Each returns `{ ok: true, data: { processed, succeeded, failed } }` and is safe to
invoke twice concurrently.

---

## 14. Health

`GET /api/health` returns configuration presence — never values — for Supabase, R2,
Razorpay and Resend, plus whether each is usable:

```json
{ "ok": true, "data": { "supabase": "configured", "r2": "missing",
  "razorpay": "test-mode", "resend": "configured", "jobs": "configured" } }
```

It is public and deliberately says nothing an attacker can use: no hostnames, no key
prefixes, no bucket names.

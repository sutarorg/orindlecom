# API Reference

**Status:** Implemented. Every endpoint below is marked:

- ✅ **Built** — the route exists in `src/app/api/` and is exercised on this deployment.
- ⬜ **Specified, not built** — reserved for future routes whose handler does not yet exist.

This distinction is enforced by `tests/unit/docs-fidelity.test.ts`, which fails if a
route marked ✅ is missing or a built route is undocumented, so the two cannot drift
apart.

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

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/files` | | List. Query: `scope`, `parentId`, `search`, `sort`, `direction`, `category[]`, `cursor` |
| ✅ | `GET` | `/api/files/:id` | | One file's metadata |
| ✅ | `PATCH` | `/api/files/:id` | | Rename (`name`) |
| ✅ | `PATCH` | `/api/files/:id/star` | | `{ starred: boolean }` |
| ✅ | `PATCH` | `/api/files/:id/move` | | `{ parentId: string \| null }` |
| ✅ | `DELETE` | `/api/files/:id` | | Move to trash (soft) |
| ✅ | `POST` | `/api/download/:id` | | `{ disposition?: "attachment" \| "inline" }` → signed URL, 5-minute expiry |

`GET /api/files` returns:

```json
{ "ok": true, "data": { "items": [ … ], "total": 132, "nextCursor": "…" } }
```

`total` is a real count, because the overview shows one. `items` never contains a
`pending` file.

---

## 3. Folders

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/folders/:id` | | Folder + ancestry |
| ✅ | `POST` | `/api/folders` | | `{ name, parentId }` |
| ✅ | `PATCH` | `/api/folders/:id` | | `{ name }` |
| ✅ | `PATCH` | `/api/folders/:id/move` | | `{ parentId }` — rejects cycles |
| ✅ | `DELETE` | `/api/folders/:id` | | Soft delete with all descendants |

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

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/storage` | | `StorageUsage`: total, committed, reserved, trash, available, byCategory |
| ✅ | `GET` | `/api/storage/breakdown` | | Per-category and per-folder detail for the storage page |

`authoritative` is `true` only when the figures came from the database. It is `false`
in the current deployment, and the UI says so rather than pretending.

---

## 6. Trash

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/trash` | | Items in the bin, with `daysRemaining` |
| ✅ | `POST` | `/api/trash/restore` | | `{ ids: string[] }` |
| ✅ | `POST` | `/api/trash/purge` | | `{ ids: string[] }` — only acts on rows already in the bin |
| ✅ | `DELETE` | `/api/trash` | | Empty the bin |

`daysRemaining` is computed server-side from the retention setting so the UI never
does date arithmetic that could disagree with the cleanup job.

---

## 7. Sharing

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/files/:id/grants` | | People with access |
| ✅ | `POST` | `/api/files/:id/grants` | | `{ email, permission }` |
| ✅ | `PATCH` | `/api/grants/:grantId` | | `{ permission }` |
| ✅ | `DELETE` | `/api/grants/:grantId` | | Revoke |
| ✅ | `GET` | `/api/files/:id/link` | | Current link or null |
| ✅ | `PUT` | `/api/files/:id/link` | | `{ permission, expiresInDays }` |
| ✅ | `DELETE` | `/api/files/:id/link` | | Revoke |

Granting to an email that is not a user creates an invite, not a silent no-op. The
response says which happened.

**Share link redemption** is `GET /s/:token`, a page, not a JSON endpoint: it
authorises, then 302s to a 60-second presigned URL. Expired or revoked links render a
clear explanation rather than a 404, because "this link expired" and "this never
existed" are different for the person holding it.

---

## 8. Account

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/users/me` | | Profile |
| ✅ | `PATCH` | `/api/users/me` | | `{ fullName }` |
| ✅ | `POST` | `/api/users/me/email` | | Change email (re-verification required) |
| ✅ | `POST` | `/api/users/me/password` | | `{ current, next }` — re-authenticates with the current password first |
| ✅ | `POST` | `/api/users/me/delete` | | `{ confirmation }` — typed confirmation required; schedules deletion, removes nothing |
| ✅ | `DELETE` | `/api/users/me/delete` | | Cancel a pending deletion |
| ✅ | `GET` | `/api/users/me/export` | | Data export: signed JSON export of account metadata, files, folders, shares, subscriptions, invoices, activity |
| ✅ | `GET` | `/api/auth/oauth/:provider/start` | | Begin a social sign-in; redirects to the provider |

`/api/auth/oauth/:provider/start` only accepts providers listed in
`NEXT_PUBLIC_AUTH_PROVIDERS`, because a button for a provider that isn't enabled in
the Supabase dashboard always fails. `next` is validated server-side, so the return
path cannot become an open redirect.

Email change and deletion both require the *current* password, checked server-side,
so a borrowed session cannot take the account.

---

## 9. Activity

`GET /api/activity?limit=&since=` — the actor's own events only. Organisation events
come from the business routes and are scoped to members.

---

## 10. Subscriptions and billing

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/billing/subscription` | | Current plan, status, period end, recovery window |
| ✅ | `GET` | `/api/billing/invoices` | | The actor's invoices only |
| ✅ | `POST` | `/api/billing/checkout` | | `{ planId, period, currency }` → order + redirect/authorisation data |
| ✅ | `POST` | `/api/billing/verify` | | `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }` |
| ✅ | `POST` | `/api/billing/cancel` | | Cancel at period end; never revokes access now |
| ✅ | `POST` | `/api/billing/change-plan` | | `{ planId }` — schedule a downgrade for period end |

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

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/organizations` | | Orgs the actor belongs to |
| ✅ | `POST` | `/api/organizations` | | Create an organisation `{ name, initials? }` — caller becomes Owner |
| ✅ | `POST` | `/api/organizations/invitations/accept` | | Accept an invitation `{ token }` |
| ✅ | `GET` | `/api/organizations/:id` | | Detail |
| ✅ | `PATCH` | `/api/organizations/:id` | | `{ name, initials? }` — admin+ |
| ✅ | `DELETE` | `/api/organizations/:id` | | Owner only, typed confirmation |
| ✅ | `GET` | `/api/organizations/:id/summary` | | Counts and storage |
| ✅ | `GET` | `/api/organizations/:id/storage` | | Org storage accounting |
| ✅ | `GET` | `/api/organizations/:id/activity` | | Filterable event log |

### Members

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/organizations/:id/members` | | Filter by role/status/search |
| ✅ | `POST` | `/api/organizations/:id/members` | | Invite `{ email, role, folderId?, folderAccess? }` |
| ✅ | `GET` | `/api/organizations/:id/members/:memberId` | | Member detail |
| ✅ | `POST` | `/api/organizations/:id/members/:memberId/resend` | | Resend invite |
| ✅ | `DELETE` | `/api/organizations/:id/members/:memberId/invite` | | Revoke invite |
| ✅ | `PATCH` | `/api/organizations/:id/members/:memberId/role` | | `{ role }` |
| ✅ | `DELETE` | `/api/organizations/:id/members/:memberId` | | Remove |
| ✅ | `POST` | `/api/organizations/:id/transfer` | | `{ memberId }` — owner only |

Role rules are enforced **server-side** by `src/domain/business/permissions.ts`, and mirrored in RLS.
`canAssignRole` and `removalBlocker` in `src/lib/business/roles.ts` are UI
affordances; the server re-checks the same rules and does not call the UI helpers,
because a client can bypass them.

The last owner cannot be removed or demoted — `removalBlocker` returns a reason and
the server rejects with `conflict` plus that reason.

### Organisation folders

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/organizations/:id/folders` | | List |
| ✅ | `POST` | `/api/organizations/:id/folders` | | Create `{ name }` |
| ✅ | `GET` | `/api/organizations/:id/folders/:folderId` | | Folder detail |
| ✅ | `PATCH` | `/api/organizations/:id/folders/:folderId` | | Rename `{ name }` |
| ✅ | `DELETE` | `/api/organizations/:id/folders/:folderId` | | Delete |
| ✅ | `PUT` | `/api/organizations/:id/folders/:folderId/access` | | `{ level, grants? }` — default folder access and per-member grants |

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

## Account security (MFA)

Optional TOTP two-factor authentication. Nothing here is required at signup, and
there is no phone or SMS path anywhere in this section.

| Method | Path | Purpose |
| --- | --- | --- |
| ✅ | `GET /api/account/mfa` | Current assurance level and enrolled factors |
| ✅ | `POST /api/account/mfa` | `{ action: "enroll" \| "verify" \| "challenge" }` |
| ✅ | `DELETE /api/account/mfa` | Remove a factor, after reauthentication |

`GET` returns `recoveryCodes: false` explicitly. Supabase's MFA API does not issue
recovery codes, and the field exists so the UI cannot imply otherwise.

`POST { action: "enroll" }` returns the QR and the Base32 secret **once**. The
secret is never stored, never logged, and does not appear in any error path. A
factor is reported as enabled only after `verify` succeeds, and that is confirmed
against the provider's own factor list rather than assumed from a 200.

`DELETE` requires either the account password or, for a passwordless (Google)
account, an AAL2 session. A password confirmation lowers the session to AAL1, so
removal completes only after the corresponding challenge — a stolen password alone
cannot strip the second factor.

---

## 12b. Platform administration

Every route below lives under `/api/admin/` and is **independently authorized** — it
does not rely on middleware, a layout or a hidden button. The shared wrapper is
`adminRoute()` in `src/lib/admin/route-helpers.ts`, and it is the only way these routes
touch the privileged client:

1. `requirePlatformAdmin(permission)` — verified session, then the caller's own
   `platform_admins` row over the RLS-scoped client.
2. A per-operator rate limit.
3. The handler, which receives the authorized context (including the service client).

Responses are always `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

| | Method | Path | Purpose |
| --- | --- | --- | --- |
| ✅ | `GET` | `/api/admin/overview` | Totals, MRR by currency, 30-day growth, recent activity. Query: `days` (1–365) |
| ✅ | `GET` | `/api/admin/users` | Directory. Query: `q`, `plan`, `verified`, `status`, `from`, `to`, `sort`, `page`, `pageSize` |
| ✅ | `GET` | `/api/admin/users/:id` | One account: plan, subscription, invoices, teams, activity |
| ✅ | `GET` | `/api/admin/users/export` | The filtered result set as CSV, ≤5,000 rows |
| ✅ | `GET` | `/api/admin/billing` | MRR, subscription counts, invoice totals by currency |
| ✅ | `GET` | `/api/admin/storage` | Committed, reserved and trashed bytes; by plan; largest accounts |
| ✅ | `GET` | `/api/admin/teams` | Organization directory. Query: `q`, `page`, `pageSize` |
| ✅ | `GET` | `/api/admin/teams/:id` | One organization and its members |
| ✅ | `GET` | `/api/admin/support` | Ticket list. Query: `q`, `status`, `category`, `page`, `pageSize` |
| ✅ | `GET` | `/api/admin/support/:id` | One ticket with history |
| ✅ | `POST` | `/api/admin/support/:id/status` | `{ status: "open" \| "in_progress" \| "resolved" }` |
| ✅ | `POST` | `/api/admin/support/:id/assign` | `{ assign: boolean }` — assignee is always the caller |
| ✅ | `POST` | `/api/admin/support/:id/reply` | `{ body, visibility: "public" \| "internal" }` |
| ✅ | `GET` | `/api/admin/audit` | Audit trail. Query: `action`, `actor`, `target`, `from`, `to`, `page` |
| ✅ | `GET` | `/api/admin/settings` | Integration presence, approved prices, administrators |
| ✅ | `POST` | `/api/admin/admins` | Owner only. `{ email \| userId, role: "owner" \| "admin" }` |
| ✅ | `DELETE` | `/api/admin/admins` | Owner only. `{ userId }` — soft revoke |

### Failure codes

| Status | Code | When |
| --- | --- | --- |
| 401 | `unauthenticated` | No session |
| 403 | `email_unverified` | Session, but the address was never confirmed |
| 403 | `forbidden` | Signed in and verified, but no active `platform_admins` row |
| 403 | `forbidden` | Active admin without the permission a route names (e.g. an `admin` calling an owner-only route) |
| 404 | `not_found` | The target does not exist |
| 409 | `conflict` | Would leave the platform with no active owner |
| 429 | `rate_limited` | Per-operator bucket exhausted |
| 503 | `not_configured` | No Supabase credentials on this deployment |

**A 403 and a 404 are deliberately similar in tone.** An authenticated customer probing
`/api/admin/users` learns that they are not an administrator, which they already knew
from the redirect; they do not learn how many accounts exist.

### What these routes will never return

- a password hash, MFA secret, access token or raw auth metadata
- a file name, object key or signed URL
- a device hash, IP hash, risk score or abuse restriction
- a webhook payload or a provider error body
- a blended figure across two currencies

Each of those is asserted by `tests/unit/admin-security.test.ts` rather than left to
review.

### CSV export and formula injection

`/api/admin/users/export` prefixes any cell beginning with `=`, `+`, `-`, `@`, tab or
carriage return with a single quote. A display name is attacker-controlled text, and
`=HYPERLINK(...)` in a name field is a known attack against whoever opens the file. The
response also carries `X-Export-Rows` and `X-Export-Truncated`, so a capped export cannot
be mistaken for a complete one.

---

## 13. Cron

All cron routes require `Authorization: Bearer ${CRON_SECRET}`, compared in constant
time. Without it they return `404`, not `401`, so the existence of the job is not
advertised.

All six are built and scheduled in `vercel.json`. Cadences below are the actual
schedule, not an intention.

| | Path | Cadence (`vercel.json`) | Purpose |
| --- | --- | --- | --- |
| ✅ | `/api/cron/expire-reservations` | `*/10 * * * *` | Release reservations never confirmed |
| ✅ | `/api/cron/trash-cleanup` | `0 2 * * *` | Delete objects past the 30-day retention |
| ✅ | `/api/cron/subscription-sweep` | `30 2 * * *` | Downgrade lapsed plans, open the recovery window |
| ✅ | `/api/cron/email-retry` | `*/15 * * * *` | Retry failed sends with bounded backoff |
| ✅ | `/api/cron/reconcile-storage` | `0 3 * * *` | Report accounting drift; repairs nothing silently |
| ✅ | `/api/cron/orphan-sweep` | `0 4 * * *` | Delete R2 objects with no row, after a 24-hour grace |
| ✅ | `/api/cron/account-purge` | `0 5 * * *` | Permanently delete accounts past their 7-day grace period |
| ✅ | `/api/cron/abuse-maintenance` | `*/10 * * * *` | Release expired restrictions, sweep orphaned blocks, prune risk data |
| ✅ | `/api/cron/domain-intel` | `0 6 * * *` | Refresh disposable-domain intelligence; validate the retained baseline |

Each returns `{ ok: true, data: { … } }` and is safe to invoke twice concurrently.
When the database isn't connected on a deployment, a scheduled run returns `200` with
`code: "not_configured"` and a sentence — not a bare `500`, which is what a job looks
like when nobody is watching.

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

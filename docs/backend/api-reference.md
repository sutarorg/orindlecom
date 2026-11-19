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
| ✅ | `GET` | `/api/files` | | List. Query: `scope`, `parentId`, `withPaths`, `search`, `sort`, `direction`, `category[]`, `cursor` |
| ✅ | `GET` | `/api/files/:id` | | One file's metadata |
| ✅ | `PATCH` | `/api/files/:id` | | Rename (`name`) |
| ✅ | `PATCH` | `/api/files/:id/star` | | `{ starred: boolean }` — one file |
| ✅ | `PATCH` | `/api/files/star` | | `{ ids: string[], starred: boolean }` — one round trip for a whole selection |
| ✅ | `PATCH` | `/api/files/:id/move` | | `{ parentId: string \| null }` |
| ✅ | `DELETE` | `/api/files/:id` | | Move to trash (soft) |
| ✅ | `POST` | `/api/download/:id` | | `{ disposition?: "attachment" \| "inline" }` → signed URL, 5-minute expiry |

`GET /api/files` query semantics — the three parent forms are deliberately distinct:

| `parentId` | Meaning |
| --- | --- |
| omitted or empty | every item the caller owns, at any depth — the global My Files view |
| `root` | the top level only |
| `<uuid>` | that folder's direct contents |

`scope` decides **which tables are read**, not just how the result is presented:

| `scope` | Reads | Used by |
| --- | --- | --- |
| `files` | `files` only, at any depth | `/dashboard/files` — every file, no folders |
| `folders` | `folders` only | `/dashboard/folders` |
| `all` | `files` **and** `folders`, direct children of `parentId` | a folder page |
| `recent` | `files` only; `folder_id is null` when no parent is given | `/dashboard/recent` |
| `starred` | both, starred only | `/dashboard/starred` |
| `shared` | both, shared with the caller | `/dashboard/shared` |
| `trash` | both, deleted | `/dashboard/trash` |

`recent` excluding nested files is part of the scope, not a caller's choice: a file
inside a folder is reachable through that folder, and Recent is the top level.

`withPaths=1` resolves each item's ancestor chain so a nested file can say which folder
it lives in.

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
### `DELETE /api/uploads/:taskId/cancel`
Releases the reservation immediately. Idempotent.

Both verbs are accepted because every caller in the browser sends `DELETE`, which the
route did not export — so each cancel was a 405 that `void api.delete(...)` discarded
silently. The reservation reserved at `prepare` is only released on complete or cancel,
so a failed upload held its bytes against quota with no file behind them until the daily
sweep reclaimed them.

### `GET /api/uploads`
Active tasks for the current actor, for the upload manager to restore state after a
navigation.

### `POST /api/session/last-workspace`
Records where the customer is (`{ path }`) so sign-in can return them there instead of
to a chooser page. The path is re-validated server-side: only `/dashboard` and
`/business` prefixes are stored, so the stored value can never become an open redirect.
Unauthenticated callers get 401; the write is scoped to the caller's own profile row by
RLS.

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
| ✅ | `GET` | `/api/thumbnails/:id` | | What a grid tile should draw: `redirect` (signed URL), `text` (extracted opening), or `icon` |
| ✅ | `GET` | `/api/thumbnails/:id/image` | | Square 480 px WebP of an image, downscaled server-side with `sharp`; `Cache-Control: private, immutable` + strong ETag. Refused (404) for a file the caller cannot read, and for anything that is not an image |
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
| ✅ | `GET` | `/api/billing/status` | | Checkout/subscription state: `checkout_pending`, `active`, `past_due`, `cancelling`, `cancelled`, `expired`, `none` |
| ✅ | `GET` | `/api/billing/invoices` | | The actor's invoices only |
| ✅ | `POST` | `/api/billing/checkout` | | `{ planId, period }` → `{ checkoutUrl, reference }` for Dodo's hosted checkout (currency resolved server-side from location or existing subscription) |
| ✅ | `POST` | `/api/billing/portal` | | Opens a Dodo Customer Portal session for the actor's own provider customer |
| ✅ | `POST` | `/api/billing/verify` | | **Legacy Razorpay only.** `{ razorpayPaymentId, razorpayOrderId, razorpaySignature }` |
| ✅ | `POST` | `/api/billing/cancel` | | Cancel at period end, at the provider first; never revokes access now |
| ✅ | `POST` | `/api/billing/change-plan` | | `{ planId }` — downgrade scheduled for period end, or an upgrade applied on the existing subscription |

### `POST /api/billing/checkout`

The request contains a plan id and a period. It contains **no amount, no currency, no
provider product id and no user id** — the browser cannot choose what it is charged.

The server, in order:

1. authenticates the actor and rate-limits them;
2. refuses if the actor already has a live subscription;
3. resolves the billing currency — the actor's existing paid subscription's currency
   if they have one, otherwise the trusted edge geolocation headers, otherwise USD;
4. resolves the approved amount from `plan_prices` where `approved = true`;
5. resolves the provider product from `billing_provider_prices` for that exact
   plan/currency/period, and refuses if it is missing;
6. **re-validates the product against the provider's own catalog** — it must be a
   recurring product, on the interval the period implies, in the approved currency,
   at the approved amount;
7. writes a pending `billing_checkout_sessions` row;
8. creates the Dodo Checkout Session and returns `{ checkoutUrl, reference }`.

Steps 5 and 6 are what make the mapping trustworthy: a stale or misconfigured
product id cannot charge a different amount than the one Orindle published. A
missing or mismatched mapping fails closed with `not_configured` — there is no
fallback to another product, price or currency.

The Free plan never creates a checkout session.

### `GET /api/billing/status`

The billing page polls this after the customer returns from hosted checkout. The
return URL itself is informational: it says the customer came back, not that money
moved. Only a verified provider webhook can activate a plan, and this endpoint
reports what the server currently believes.

### `POST /api/billing/portal`

Resolves the actor's Dodo customer id from `billing_customers` — a server-side table
the browser cannot write — and creates a Customer Portal session. A customer id in
the request body is ignored entirely. The returned URL is the only thing sent back.

The portal is used for viewing provider invoices and updating payment methods. It is
not the route for changing a plan: a plan change moves Orindle's storage allowance,
so it stays under `/api/billing/change-plan`, which enforces the end-of-period
policy.

### `POST /api/billing/verify` (legacy)

`DriveRepository.startCheckout` returns `DriveResult<{ url: string }>`, and the
repository method keeps its signature. The **new** flow does not use it: Dodo's
hosted checkout produces no browser signature, and a browser callback is not
evidence of payment. It remains mounted for historical Razorpay orders that were
created before the migration and may still have a payment in flight — and it can
only complete an order that already exists, because nothing creates Razorpay orders
any more.

**No path activates a plan from a client claim.**

### `POST /api/webhooks/dodo`

Not session-authenticated: Dodo is the caller. Authenticated by Standard Webhooks
signature verification over the **raw** request body — the signed content is
`{webhook-id}.{webhook-timestamp}.{raw-body}`, HMAC-SHA256, compared in constant
time, with a five-minute timestamp tolerance. The SDK's `unwrap` performs the check.

The event is stored raw by `(provider, webhook-id)` **before** processing; a
duplicate delivery is acknowledged with `200` and not reprocessed. A processing
failure is recorded on the stored row and answered with `500`, so Dodo retries and
the stored event can be replayed.

Attribution is the key property. A subscription event is matched to an Orindle owner
through, in order: the checkout reference in the server-authored metadata resolved
against the pending `billing_checkout_sessions` row; the existing subscription row
carrying the provider subscription id; or the provider customer id through
`billing_customers`. **A user id in provider metadata alone never activates
anything.**

Events handled: `subscription.active`, `subscription.updated`,
`subscription.renewed`, `subscription.past_due`, `subscription.on_hold`,
`subscription.failed`, `subscription.paused`, `subscription.unpaused`,
`subscription.plan_changed`, `subscription.cancelled`, `subscription.expired`,
`payment.succeeded`, `payment.failed`, `refund.succeeded`, `refund.failed`,
`dispute.opened`, `dispute.lost`, `dispute.won`. Any other event is stored and
ignored — a new provider event must not break the endpoint.

### `POST /api/webhooks/razorpay` (legacy)

Not session-authenticated. Verified by HMAC over the raw body with the webhook
secret. The event is stored raw by `(provider, event_id)` before processing; a
duplicate is acknowledged with `200` and not reprocessed. Handlers are idempotent: a
`payment.captured` delivered twice produces one invoice, because the invoice
uniqueness is provider-scoped on `provider_payment_id`.

This handler only touches rows whose `billing_provider` is `razorpay`, so a delayed
legacy event cannot modify a Dodo subscription. It exists for historical
subscriptions and delayed events; it can no longer create a payment.

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

All nine are built. Cadences below are the actual schedule, not an intention.

**Vercel's free plan allows one run per job per day.** Three of these jobs want a
ten- or fifteen-minute cadence, so `vercel.json` schedules one entry,
`/api/cron/dispatch`, and the dispatcher invokes those three from a single daily run.
The two cadence columns are what each job is *scheduled* at and what it *would* run at
on a plan that permits it.

| | Path | Scheduled (`vercel.json`) | Run through | Purpose |
| --- | --- | --- | --- | --- |
| ✅ | `/api/cron/dispatch` | `0 1 * * *` | itself | Invokes the three frequency-sensitive jobs below |
| ✅ | `/api/cron/expire-reservations` | via `dispatch` | `dispatch`, daily | Mark lapsed reservations `expired` and reclaim their bytes |
| ✅ | `/api/cron/email-retry` | via `dispatch` | `dispatch`, daily | Retry failed sends with bounded backoff |
| ✅ | `/api/cron/abuse-maintenance` | via `dispatch` | `dispatch`, daily | Release expired restrictions, sweep orphaned blocks, prune risk data |
| ✅ | `/api/cron/trash-cleanup` | `0 2 * * *` | direct, daily | Delete objects past the 30-day retention |
| ✅ | `/api/cron/subscription-sweep` | `0 3 * * *` | direct, daily | Downgrade lapsed plans, open the recovery window |
| ✅ | `/api/cron/reconcile-storage` | `0 4 * * *` | direct, daily | Report accounting drift; repairs nothing silently |
| ✅ | `/api/cron/orphan-sweep` | `0 5 * * *` | direct, daily | Delete R2 objects with no row, after a 24-hour grace |
| ✅ | `/api/cron/account-purge` | `0 6 * * *` | direct, daily | Permanently delete accounts past their 7-day grace period |
| ✅ | `/api/cron/domain-intel` | `0 7 * * *` | direct, daily | Refresh disposable-domain intelligence; validate the retained baseline |

### Why a dispatcher instead of nine schedules

Vercel rejects a deploy whose cron expression runs more than once per day on Hobby.
The message names the offending expression, which is how this was found — but moving
those three jobs to a daily slot on their own would have been wrong, because each is
time-sensitive: a reservation holds bytes against a customer's quota, an email retry is
someone waiting for a sign-in link, and an abuse cooldown that has elapsed should stop
being enforced.

One of those three was also a genuine bug rather than a scheduling problem. Quota
arithmetic must not depend on a sweep arriving on time, so `reserve_storage` now
reclaims lapsed reservations inline, under the same row lock that guards the quota
comparison (`supabase/migrations/0020`). With that fixed, the remaining cost of a daily
cadence is delay, not incorrectness:

| Was | Now | Consequence |
| --- | --- | --- |
| Reservation released within 10 min | Released when the customer next tries to upload, or by the daily sweep | **No** quota impact — the inline reclaim is what the customer hits |
| `storage_usage.reserved_bytes` exact within 10 min | An upper bound between sweeps | Admin and account screens must treat it as an upper bound, and do |
| Failed email retried within 15 min | Retried within a day, backoff unchanged | A slow retry; the queue is durable, so nothing is lost |
| Elapsed abuse cooldown released within 10 min | Released within a day | A cooldown can outlast its window by up to a day. It is a delay, never a permanent restriction |

### Restoring the real cadence

On a Pro plan, put the three sub-routes back in `vercel.json` at `*/10 * * * *`,
`*/15 * * * *` and `*/10 * * * *`, and remove the dispatcher entry. The sub-routes are
unchanged; `dispatch` simply becomes unused. There is deliberately no environment flag
for "we are on Pro" — a flag someone can set wrong fails silently, whereas the schedule
is visible in one file.

A schedule that runs more than once per day fails the deploy rather than the job, so
`tests/unit/deployment-config.test.ts` rejects one in CI.

Each returns `{ ok: true, data: { … } }` and is safe to invoke twice concurrently.
When the database isn't connected on a deployment, a scheduled run returns `200` with
`code: "not_configured"` and a sentence — not a bare `500`, which is what a job looks
like when nobody is watching.

---

## 14. Health

`GET /api/health` returns configuration presence — never values — for Supabase, R2,
Dodo Payments, the legacy Razorpay handler and Resend, plus whether each is usable:

```json
{ "ok": true, "data": { "supabase": "configured", "r2": "missing",
  "billingProvider": "dodo", "dodo": "test-mode",
  "legacyRazorpay": "configured", "resend": "configured", "jobs": "configured" } }
```

`dodo` is `configured` (live mode), `test-mode`, `missing` (no API key) or
`mismatch` (the configured `DODO_PAYMENTS_ENVIRONMENT` disagrees with the
deployment target — the mistake that would take money with the wrong
credentials). `legacyRazorpay` reports only whether the historical webhook secret
is present; it never claims the old provider can take a payment.

It is public and deliberately says nothing an attacker can use: no hostnames, no key
prefixes, no bucket names.

---

## Public share links (anonymous)

The only routes in the product with no session behind them. The token in the URL is
the entire authority, so each handler re-resolves it and trusts nothing the client
sends. All are rate limited by hashed IP rather than by user id, and all return
`404` for a token that is unknown, revoked **or** expired — a distinct "expired"
message would confirm that a guessed token was once real.

| Built | Method | Path | Request | Response |
| --- | --- | --- | --- | --- |
| ✅ | `GET` | `/api/s/:token` | — | Resolved item: name, size, type, permission, owner display name |
| ✅ | `POST` | `/api/s/:token` | `{ action: "download" }` | `{ url, filename, expiresIn }` — signed URL, 5-minute expiry |
| ✅ | `POST` | `/api/s/:token` | `{ action: "comment", body, author? }` | `{ posted: true }` — refused unless the link grants `commenter` |
| ✅ | `GET` | `/api/s/:token/content` | — | `{ url, text, previewable }` — a signed URL for media, extracted text for documents |
| ✅ | `GET` | `/api/s/:token/comments` | — | `{ comments: [{ id, authorName, body, external, createdAt }] }` — resolved through `link_comments`; a blank author name is returned as `User` |

The page at `/s/:token` renders one of **two** experiences from the resolved
permission — view or comment — on the same header and footer as the rest of the
site. There is no edit permission: migration 0025 narrows the permission columns to
`viewer` / `commenter` and converts existing `editor` rows to `commenter`. The
permission is not a UI gate: `/api/s/:token` refuses a comment from a `viewer` link
regardless of what the page rendered.

Content types are checked on the way out. Only images, audio, video, PDF and plain
text are served `inline`; everything else — including HTML, SVG and anything
unrecognised — is forced to `application/octet-stream`, which a browser downloads
rather than renders.

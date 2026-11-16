# The administration console

**Status:** implemented. Migrations `0017` and `0018` required.
**Bootstrap:** `docs/admin/ADMIN-ACCESS-SETUP.md` — read that first; the console is
unreachable until one owner row exists.

---

## 1. Routes

Sidebar order, which is the order below.

| Route | What it shows | Writes |
| --- | --- | --- |
| `/admin` | Totals, MRR by currency, 30-day signups, recent activity, open tickets | — |
| `/admin/users` | Server-side search, filters, sort, pagination, CSV export | — |
| `/admin/users/[id]` | One account: plan, subscription, invoices, teams, activity | — |
| `/admin/billing` | MRR, subscription states, collected revenue by currency, plan mix | — |
| `/admin/storage` | Committed / reserved / trash, by plan, largest accounts | — |
| `/admin/teams` | Organization directory | — |
| `/admin/support` | Ticket list with status and category filters | — |
| `/admin/support/[id]` | One ticket, its history, reply and internal note | status, assign, reply |
| `/admin/analytics` | Six tabs; GA4 and Search Console as separate sources | — |
| `/admin/logs` | Audit trail plus operational counters | — |
| `/admin/settings` | Integrations, price catalogue, administrator access | grant / revoke |
| Logout | Server action, ends the session | — |

Every page carries `noindex, nofollow` and `Cache-Control: no-store`. `/admin` is
disallowed in `robots.txt` and absent from the sitemap.

---

## 2. Authorization

The full rule lives in `src/lib/admin/auth.ts`; the short version:

```
resolveActor()  →  verified email  →  own row in platform_admins (RLS-scoped)
                →  active?         →  role has permission?
                →  only now: service client
```

Order matters more than the checks. The privileged client is not obtained until
authorization has already succeeded, so there is no code path where a failed check
leaves a service client in scope. `tests/unit/admin-security.test.ts` asserts this by
reading the source.

**Every `/api/admin/**` handler authorizes independently** through `adminRoute()`.
Middleware treats `/admin` as protected, but the comment there is explicit that it is a
redirect convenience and not the boundary.

| Caller | Page | API |
| --- | --- | --- |
| Anonymous | 307 → `/login?next=…` | 401 |
| Unverified email | 307 → `/verify-email` | 403 `email_unverified` |
| Signed in, not an admin | `/access-denied` | 403 `forbidden` |
| Disabled admin | `/access-denied` | 403 `forbidden` |
| Admin, owner-only action | Disabled control with reason | 403 `forbidden` |
| No Supabase config | `/access-denied?reason=not-configured` | 503 `not_configured` |

A disabled administrator and an ordinary customer land on the same page with the same
words. The response must not tell an attacker which one they are.

---

## 3. The permission map

One table, in `src/lib/admin/auth.ts`, not scattered `role === …` checks.

| Permission | owner | admin |
| --- | --- | --- |
| `view_operations` | ✅ | ✅ |
| `manage_support` | ✅ | ✅ |
| `view_audit_log` | ✅ | ✅ |
| `view_settings` | ✅ | ✅ |
| `manage_platform_admins` | ✅ | — |
| `manage_platform_settings` | ✅ | — |
| `manage_pricing` | ✅ | — |

`tests/unit/admin-permissions.test.ts` pins the owner-only set to exactly those three,
and asserts that no permission exists for anything in §5.

---

## 4. Data rules that the UI depends on

- **MRR ≠ revenue.** MRR is what active subscriptions are worth per month. Collected
  revenue is what paid invoices say was actually paid, in the selected range, excluding
  failed and refunded. The billing page states both and never adds them.
- **Currencies are never summed.** INR and USD appear in separate rows. No exchange
  rate is applied to anything, and none is stored.
- **Annual is one twelfth.** `amount_minor / 12`, integer division, in SQL.
- **Cancel-at-period-end still counts.** The customer has paid to the end of the period.
- **A lapsed period does not count.** `status = 'active'` is checked *and*
  `current_period_end > now()`.
- **Unknown period is excluded and counted.** Rows written before `billing_period`
  existed stay NULL; the billing page shows them as a separate, explained figure rather
  than guessing a period from dates.
- **Unapproved prices never appear as chargeable.** The settings catalogue includes them
  and labels them "not approved", because checkout will refuse them.
- **Storage is decimal.** 1 GB = 1,000,000,000 bytes. Trash is *inside* committed; the
  page says so, because counting both would double the figure.
- **No file names, object keys or signed URLs anywhere.** Storage figures are aggregates
  from `storage_usage`.
- **No invented numbers.** With no analytics provider the page reports which variables
  are missing. There are no placeholder visitors, sample users or example percentages
  anywhere in the console.

---

## 5. What the console deliberately cannot do

Each of these is a request someone will make, and each is refused on purpose:

| Not built | Why |
| --- | --- |
| Delete or suspend a customer account | Destructive, irreversible, and one click from an identity mistake |
| Impersonate a customer | Turns an operator into the customer; no audit trail can undo what they see |
| Assign a plan by hand | Creates a paying-looking customer who never paid |
| Refund or confirm a payment manually | Money changes outside the provider that actually took it |
| Adjust a storage figure | The number would stop matching the bytes on disk |
| Delete a file or folder | The console has no business touching customer content |
| Change a price without approval | `manage_pricing` exists; the approval workflow does not, so nothing is editable |
| Edit or delete an audit row | The table grants no UPDATE or DELETE to any role |
| Grant themselves owner | Owner-only, and the UI refuses for self with a stated reason |

### Also absent: any anti-abuse monitoring surface

No `/admin/abuse`, `/admin/risk`, `/admin/review-queue` or `/admin/devices`. No page or
API reads `risk_events`, `device_signups`, `account_restrictions`, `abuse_policy` or any
device/IP hash. `tests/unit/admin-architecture.test.ts` fails if that changes, and
`docs/security/anti-abuse-system.md` §10 explains why the absence is a requirement.

---

## 6. Support inbox

- The contact form writes to `support_requests` **before** attempting email, so a Resend
  outage loses nothing.
- `ticket_status` (`open`, `in_progress`, `resolved`) is separate from `delivery_status`.
  "We haven't replied" and "the notification didn't send" are different facts and the
  list shows both columns.
- Replies are `public` (emailed to the customer) or `internal` (never emailed — a CHECK
  constraint refuses to mark an internal note delivered).
- Every status change, assignment and reply is written to `platform_admin_audit_logs`
  with the actor, the ticket and a metadata blob containing no message text.
- A reply is reported as sent only when Resend accepted it. A failure keeps the draft and
  shows the provider's message verbatim.

---

## 7. Analytics

Six tabs: Traffic, Acquisition, Pages, Geography, Devices, Conversions.

Three states, and they are not interchangeable:

| State | Meaning |
| --- | --- |
| `not_configured` | No property or credentials. The missing variable names are listed. |
| `connected_empty` | The provider answered, with zero rows for the range. |
| `available` | Real rows. |
| `error` | Credentials present but the query failed. The message is shown. |

GA4 sits behind `AnalyticsProvider`, so another provider is one object away. Collection
is off: no measurement script loads, because there is no consent control and sending
data before consent is the thing this design exists to avoid. The Conversions tab shows
real database signup counts and states the caveat that a signup is not a visitor.

Search Console is a **separate source**. Clicks and impressions are never added to
sessions; they measure different things.

See `docs/deployment/environment-variables.md` §2.0 for the variables.

---

## 8. Tests

| File | Covers |
| --- | --- |
| `tests/db/admin.test.ts` | RLS on `platform_admins`, own-row visibility, last-owner protection, audit append-only, ticket state separation |
| `tests/db/admin-metrics.test.ts` | MRR arithmetic, currency separation, lapsed periods, aggregate RPCs |
| `tests/db/rls-coverage.test.ts` | Table grants parsed from `relacl`, write privileges, deny-all row behaviour |
| `tests/unit/admin-security.test.ts` | No service client before authorization, no secrets in responses, no anti-abuse surface, CSV injection |
| `tests/unit/admin-permissions.test.ts` | The permission map and its forbidden capabilities |
| `tests/unit/admin-architecture.test.ts` | `server-only` coverage, server-side pagination, no risk tables |
| `tests/unit/admin-billing-period.test.ts` | `billing_period` persistence, annual ÷ 12 |
| `tests/unit/auth-security-flow.test.ts` | No anti-abuse dashboard or review queue exists |

---

## 9. Known limitations

Stated rather than discovered later.

- **Nobody has signed in to a real deployment.** These pages have been verified against
  a fixture context and against the refusal path; the authorization layer is tested at
  the database and unit level, but the full round trip with a live Supabase session has
  not run, because there is no Supabase project attached to this repository.
- **No email has been delivered.** Resend is `sandbox` or `missing`; `support-reply` has
  never reached a real inbox.
- **Analytics has never queried GA4.** The adapter is unit-tested; no live property
  exists, so the API contract is unverified against the real service.
- **CSV export caps at 5,000 rows** and says so via `X-Export-Truncated` rather than
  silently truncating.
- **No pagination cursor on the audit log** beyond offset paging; fine at current volume,
  not at millions of rows.
- **Teams is read-only.** The business repositories do not expose a platform-level
  directory API, so the page reads tables through the admin layer. Granting it a second
  membership-mutation path was judged worse than leaving it read-only.

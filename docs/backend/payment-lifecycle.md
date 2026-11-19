# Payment Lifecycle

**Status:** design locked. The provider is **Dodo Payments** with hosted Checkout
Sessions and recurring subscriptions. Razorpay remains in the codebase only as a
legacy compatibility layer for historical records — see §12.

**Operational blockers** that must be cleared before money is taken are in §11, and
the administrator's setup guide is
[`docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md`](../admin/DODO-PAYMENTS-ADMIN-SETUP.md).

---

## 1. Approved prices — where they live

**`public.plan_prices` is the commercial source of truth.** It is seeded by migration
`0019` and holds every approved plan, currency and period. The pricing configuration
in `src/config/pricing.ts` displays the same figures and the two are asserted
against each other by `tests/db/dodo-pricing-docs.test.ts`.

- **Six plans:** Free (10 GB), Basic (100 GB), Plus (500 GB), Premium (1 TB),
  Ultra (2 TB), Max (5 TB).
- **Eight currencies:** INR, USD, GBP, EUR, AED, SGD, AUD, CAD.
- **Two periods:** `monthly` and `yearly`.
- **20% annual discount**, applied to the *monthly-equivalent* rate. INR quotes in
  whole rupees and truncates to a whole rupee; the other seven keep two decimal
  places. The database stores the **full annual charge** — twelve monthly-equivalents.
- Storage figures are decimal GB/TB (10 GB = 10,000,000,000 bytes).
- Money is stored in minor units (paise/cents) as integers. No floating-point
  currency anywhere.

**Free is not a product.** It costs nothing, it never creates a checkout session,
and it never produces a payment. A request for it fails closed in the checkout
route rather than being quietly treated as a no-op.

> The complete 80-row price table, with the exact minor-unit amount to type into
> Dodo's dashboard, is in the administrator guide §B.2.

---

## 2. Plan state machine

```
                       verified Dodo subscription
   none ───────────────────────────────────────────► active
     ▲                                                │  │
     │                                                │  └── cancel at period end ──┐
     │                                                │                             ▼
     │                       period ends without renewal                       cancelled
     │                                                │                             │
     │                                                ▼                             │
     │                                             expired ◄────────────────────────┘
     │                                                │
     │             recovery window (90 d)            │
     │                                                ▼
     └────────────── recovery_ends_at ──► downgraded to Free
                     (files preserved)
```

The important property: **expiry never deletes anything.** It reduces the allowance,
preserves every file, keeps downloads working, and blocks new uploads that would
exceed the Free allowance.

The subscription status vocabulary is the provider's, mapped onto Orindle's states
in `src/domain/billing/dodo.ts`:

| Dodo status | Orindle status | Effect |
| --- | --- | --- |
| `active` | `active` | Full entitlement |
| `pending` | `active` | Checkout started; treated as live so the customer is not locked out mid-flow |
| `past_due` | `past_due` | Entitlement preserved; recovery window starts |
| `on_hold` | `past_due` | Entitlement preserved |
| `paused` | `past_due` | Entitlement preserved |
| `failed` | `expired` | Recovery window starts |
| `expired` | `expired` | Recovery window starts |
| `cancelled` | `cancelled` | Entitlement ends at the period end the provider recorded |
| anything else | `past_due` | **Unknown means keep access**, not drop access |

---

## 3. Checkout — hosted, server-priced, fail-closed

```
Client                Server                        Dodo
  │  POST /api/billing/checkout                     │
  │  { planId, period }  ← nothing about money      │
  ├─────────────────────►│                           │
  │                      │ 1. resolveActor()        │
  │                      │ 2. plan_prices WHERE     │
  │                      │    approved = true       │
  │                      │ 3. no row → fail closed  │
  │                      │ 4. read billing_provider_ │
  │                      │    prices for (plan, cur,│
  │                      │    period, environment)  │
  │                      │ 5. no mapping → fail     │
  │                      │ 6. fetch product from    │
  │                      │    Dodo's catalogue ─────►│
  │                      │ 7. verify currency,      │
  │                      │    interval AND amount   │
  │                      │    against plan_prices   │
  │                      │ 8. create checkout ─────►│
  │                      │◄──── session_id,         │
  │                      │      checkout_url         │
  │◄─────────────────────┤                           │
  │  window.location = checkout_url (hosted page)   │
  │                                                │
  │  user pays on Dodo's page                        │
  │                                                │
  │  ← redirect to /dashboard/billing?checkout=returned
  │  (informational only — grants nothing)          │
  │                                                │
  │  Dodo POSTs /api/webhooks/dodo                   │
  │  → the ONLY thing that activates a plan          │
```

### What the browser is allowed to send

**`planId` and `period`. Nothing else.**

The server rejects the request outright if the body contains an amount, a currency,
a product id, a user id or a provider customer id. Those are not "ignored" — a
request that carries them is refused, because a client that can send them is a
client that believes it has authority over money.

### The server-side resolution, in order

1. `resolveActor()` — identity from the session. Never from the request body.
2. **Approved price.** `plan_prices` for (plan, currency, period) where
   `approved = true`. Zero rows → fail closed with a reason.
3. **Currency.** Resolved server-side from the region, then locked to the
   subscription's currency for its lifetime.
4. **Provider mapping.** `billing_provider_prices` for (provider, environment, plan,
   currency, period). Zero rows → fail closed. The mapping is a **protected
   database table**, not a hard-coded map: no Dodo product id appears in the
   TypeScript source.
5. **Product verification.** The product is re-read from Dodo's catalogue and its
   currency, recurring interval and amount are compared against the approved
   price. Any mismatch → fail closed, and the checkout is refused rather than
   created.
6. **Live subscription check.** An account that already has a live subscription
   cannot start a second one. This is what stops a legacy Razorpay customer from
   being charged by Dodo while their Razorpay mandate is still collecting.
7. **Checkout session.** Created with the verified product and the approved
   currency. The customer is redirected to Dodo's hosted page.

### The return page grants nothing

`/dashboard/billing?checkout=returned` is **informational**. It tells the browser to
ask the authenticated server-side status endpoint what the real state is. It
cannot activate a plan, cannot change a plan, and its query parameters are never
trusted.

The authority is `GET /api/billing/status`, which is authenticated and reads the
local subscription, which is written only by the verified webhook.

---

## 4. Signature verification — Standard Webhooks

Dodo follows the [Standard Webhooks](https://www.standardwebhooks.com/)
specification. The signed content is:

```
{webhook-id}.{webhook-timestamp}.{raw-body}
```

signed with HMAC-SHA256 using the base64-decoded signing secret (after the
`whsec_` prefix is removed), and compared in constant time.

```ts
// The shape, not the final code.
const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
const expected = "v1," + createHmac("sha256", key)
  .update(`${webhookId}.${timestamp}.${rawBody}`)
  .digest("base64");
```

- The body must be the **exact bytes** Dodo sent. It is read with
  `await request.text()` before any parsing. A parsed-then-re-serialised object
  will not match, and re-serialising is also how key-order and float-formatting
  differences creep in.
- The timestamp must be within **five minutes** of now. An old, correctly-signed
  event is rejected: a signature that was valid an hour ago is a replay.
- Compared in constant time, never with `===`.
- A missing secret means verification cannot happen. The endpoint returns
  `503 not_configured` and **activates nothing**. It never falls through to
  "assume valid".
- A rejection never explains which check failed. "Invalid signature." is the
  whole message; a precise reason helps an attacker tune a forgery.

`tests/unit/dodo-webhook-verification.test.ts` builds the signatures by hand
rather than through the SDK, so an SDK change cannot quietly make the tests agree
with a broken implementation.

---

## 5. Webhook handling

### Ordering

1. Read the **raw** body.
2. Verify the signature, the timestamp and the presence of all three headers.
   Invalid → `403`, nothing stored, nothing activated.
3. `INSERT INTO webhook_events (provider, event_id, …)`. The unique key is
   `(provider, webhook_id)`.
   - A conflict means a **replay**: acknowledge with `200` and
     `{ duplicate: true }` without reprocessing.
   - The insert happens **before** processing, so a crash mid-processing leaves a
     stored, unprocessed event rather than a lost one.
4. Process in a transaction. Mark `processed_at`, or record the `error`.
5. Return `200` for anything durably stored. Return `5xx` for a processing
   failure, so Dodo retries it.

### Events handled

| Event | Effect |
| --- | --- |
| `subscription.active` | Set plan, period and `active` from the provider's own subscription object |
| `subscription.renewed` | Extend the period to the provider's date; insert the invoice (idempotent on the payment id) |
| `subscription.updated` | Reconcile status and dates |
| `subscription.plan_changed` | Apply the confirmed plan; the local state follows the provider |
| `subscription.cancelled` | `cancelled`; the remaining paid period is honoured until its end |
| `subscription.expired` | `expired`; recovery window begins; files kept |
| `subscription.past_due` | `past_due`; entitlement preserved; warnings begin |
| `subscription.on_hold` | `past_due`; entitlement preserved |
| `subscription.paused` / `subscription.unpaused` | `past_due` and back; entitlement preserved |
| `subscription.failed` | `past_due`; no downgrade on the first failure |
| `payment.succeeded` | Insert the invoice if it is not already there |
| `payment.failed` | Record; notify; do not downgrade on the first failure |
| `refund.succeeded` | Mark the invoice `refunded`; **never** claw back files |
| `refund.failed` | Record only |
| `dispute.opened` / `dispute.lost` | Record against the invoice; **never** delete files |
| `dispute.won` | Restore the invoice to `paid` |

Unknown events are stored and ignored, not errored: a new Dodo event type must not
break the endpoint.

### Which side is the authority

For every event, **the provider is the authority** and the local row follows it:

- **Period dates come from Dodo**, not from "now plus 30 days". A renewal sets
  `current_period_end` to the provider's `next_billing_date`, verbatim. A local
  date arithmetic would drift, and would drift differently for a customer whose
  billing date is not the day they signed up.
- **Status comes from Dodo**, mapped through the table in §2.
- **Amount and currency come from the provider event**, and are reconciled against
  the approved price in the pending checkout record.

### Idempotency

Three layers, in order:

1. `(provider, webhook_id)` on `webhook_events` — a replayed delivery is
   acknowledged and dropped.
2. `provider_payment_id` on `invoices` — a renewal processed twice writes one
   invoice.
3. `public.apply_renewal(...)` — a single transaction that inserts the invoice and
   advances the period. It returns `false` if the payment id has already been
   applied, and does nothing in that case.

A double-delivered `subscription.renewed` produces one invoice and one period
extension. Double-billing a customer from a retry is the worst bug this system
could ship.

### Recoverable failures

A processing failure records the `error` on the stored event and returns a
retryable status. The event is already durable, so the retry finds the stored row
and can be processed deliberately rather than being silently lost.

---

## 6. Expiry, downgrade and the recovery window

When a subscription lapses, in order:

1. **Day 0 — `expired`.** The allowance drops to Free (10 GB). Every file is kept.
   Download, preview, share-with-existing-grantee and delete all continue to work.
   New uploads are refused when they would exceed the Free allowance, with a
   message that says exactly that and offers an upgrade — not a generic error.
2. **Warning emails** at day 0, 7, 30, 60 and 83 of the recovery window. Each
   states the date and what happens on it.
3. **`recovery_ends_at` = expired_at + 90 days** (configurable via
   `RECOVERY_WINDOW_DAYS`). Within the window, paying restores the previous plan
   and **nothing was ever lost**, because nothing was deleted.
4. **After the window**, the account is a Free account permanently. Files are still
   not deleted. Storage above the Free allowance becomes read-only: downloads
   work, new uploads are blocked until usage falls below the allowance.
5. **Deletion only via the approved process** — the same account-deletion flow,
   initiated by the customer. **The system does not delete files because a
   subscription ended.** There is no code path for it, deliberately.

The same rule applies to refunds and disputes: a refunded invoice or a lost
dispute changes the invoice's status and nothing else. Files are not clawed back.

### Why this is expensive and still correct

Keeping 5 TB of files for a customer paying nothing is a real cost. Deleting their
work because a card expired is a much worse outcome, and it is the outcome that
generates the support queue and the reputation damage. The requirement is explicit
and the implementation follows it.

---

## 7. Cancellation and plan changes

Both operations call the provider **first**. Local state follows the confirmed
provider operation rather than claiming a change that did not happen.

### Cancellation

1. `cancel_at_period_end` is requested at Dodo.
2. Only once Dodo confirms does the local row record it: `cancel_at_period_end =
   true`, `status = 'active'`, `current_period_end` unchanged.
3. The customer keeps what they paid for until the period ends; the UI says the
   exact date.
4. When the period ends, Dodo sends `subscription.cancelled` and the local status
   becomes `cancelled`. Files are kept.

Immediate cancellation is not offered, because it would mean taking money for a
period and then not providing it. The Customer Portal's "allow immediate
cancellation" is therefore **off** — see the administrator guide §E.2.

### Downgrade

1. The plan change is scheduled at Dodo for the next billing date.
2. The local row records `pending_plan_id` and `pending_plan_effective_at`. The
   `plan_id` has **not** changed.
3. When the period ends, Dodo sends `subscription.plan_changed` and
   `public.apply_scheduled_plan_change(...)` applies the confirmed plan — and only
   if the confirmed plan matches the pending one. The pending pair is cleared
   together, so the two can never disagree.

### Upgrade

An upgrade **does not create a second subscription**. The plan change is applied at
the provider on the existing subscription, and the local row follows. The unique
index on live subscriptions backs this up at the database level.

### Both are provider-confirmed

A local row that says "cancelled" while Dodo says "active" is a support incident
waiting to happen. Every provider-facing route therefore makes the provider call
first, and only writes locally after the provider confirms.

---

## 8. Currency

- The **display** currency comes from the region (existing middleware) and is a
  display preference only.
- The **billing** currency is resolved server-side at checkout and is **fixed at
  subscription time** and stored on the subscription. A customer who moves from
  India to the US keeps paying in INR for the current subscription; a new
  subscription may be in USD. Silently re-pricing someone mid-term, or converting
  their amount, is not done.
- The subscription's currency cannot be changed by a renewal or a plan change. The
  `apply_renewal` function preserves it.
- If a visitor's region maps to a currency with no approved price, the pricing
  page shows an available currency with a stated note rather than inventing a
  local figure.

---

## 9. The Customer Portal

The Customer Portal is Dodo's hosted page where a customer views their provider
invoices and updates their payment method.

- It is reached through `POST /api/billing/portal`, which is authenticated and
  resolves the provider customer id from the database. The browser never supplies
  a customer id.
- The portal is **not** where a plan is changed. A plan change moves Orindle's
  storage allowance, and the portal cannot update Orindle's database, so
  subscription updates and pauses are disabled in the portal configuration.
- Immediate cancellation is disabled there too, for the same reason the
  application does not offer it.

---

## 10. Testing the lifecycle without taking money

Dodo's test mode exercises every path. The full procedure, with what to look at in
each step, is in the administrator guide §F.1. The automated equivalents:

| Scenario | How |
| --- | --- |
| Signature verification | `tests/unit/dodo-webhook-verification.test.ts` — valid, tampered body, wrong secret, missing headers, stale timestamp, wrong webhook id |
| Webhook durability and deduplication | `tests/db/dodo-billing.test.ts` — replayed renewal writes one invoice and does not extend the period twice |
| Provider-scoped uniqueness | `tests/db/dodo-billing.test.ts` — two providers may share an external id; one provider may not |
| Legacy compatibility | `tests/db/dodo-billing.test.ts` — historical Razorpay rows stay readable and stay Razorpay |
| Checkout guards | `tests/unit/dodo-billing.test.ts` — Free refused, no approved price refused, no second subscription, no browser-supplied money |
| Price validation | `tests/unit/dodo-billing.test.ts`, `tests/db/dodo-pricing-docs.test.ts` |
| Expiry preserves files | `tests/db/billing-invariants.test.ts` |
| RLS coverage | `tests/db/rls-coverage.test.ts` — the three new tables are server-only deny-all |

A test asserts that no code path sets a file's `deleted_at` from a billing event.

---

## 11. Operational blockers — must be cleared before selling

These are **not** things this codebase can decide, and no amount of implementation
resolves them.

### 11.1 Merchant-account approval

> **Unconfirmed:** whether Dodo has approved Orindle's business model, completed
> KYC on the business and its beneficial owners, and enabled live payments.

Until confirmed:

- The health endpoint reports the Dodo configuration as present but the account is
  not serving live payments.
- The test-mode checklist in the administrator guide §F.1 must be completed in
  full, including a controlled low-value live transaction.

### 11.2 The product catalogue

> **Unconfirmed:** that the 80 Dodo products exist with the correct currency,
> recurring interval and amount.

Until they exist and are mapped in `billing_provider_prices`, every checkout fails
closed with "That plan isn't available for purchase right now." This is the
correct behaviour — an unmapped plan is refused, not sold at a guessed price.

### 11.3 Payment methods and tax

No payment method may be promised that the account has not been approved for, and
the tax configuration must not add an amount on top of the published price — the
approved prices are exact amounts, and the customer must be charged exactly those.

### 11.4 What is not a blocker

- The pricing itself: `plan_prices` is seeded and the configuration agrees with
  it.
- The code path: the tests cover it.

---

## 12. The legacy Razorpay layer

Razorpay is retained for historical records only. It is not a second provider and
not a fallback.

### What is retained

| Thing | Status |
| --- | --- |
| `src/domain/billing/razorpay.ts` | Historical price resolution, HMAC verification, activation and period helpers. **Cannot create an order.** |
| `src/app/api/webhooks/razorpay/route.ts` | **Operational.** Handles historical and delayed events. Only touches rows whose `billing_provider` is `razorpay`. |
| `src/app/api/billing/verify/route.ts` | **Legacy Razorpay only.** It can activate a historical Razorpay subscription. It cannot activate a Dodo entitlement, and it is not on the Dodo path. |
| Every historical subscription, invoice, payment id, subscription id, activity event and webhook event | **Readable and unchanged.** |
| `RAZORPAY_WEBHOOK_SECRET` | Kept in the environment while historical events may still arrive. |

### What is gone

- Razorpay checkout. `POST /api/billing/checkout` creates a Dodo checkout session
  and nothing else.
- Razorpay from the customer-facing copy.
- Razorpay from the new payment path. `NEXT_PUBLIC_RAZORPAY_KEY_ID` and
  `RAZORPAY_KEY_SECRET` are read only by the legacy module.

### The transition rules

1. **Nothing is cancelled automatically.** No local record is treated as evidence
   of a live provider mandate.
2. **Nothing is migrated automatically.** A Razorpay mandate cannot be
   transferred to Dodo — the customer must authorise a new payment method. A
   "migration" is a cancellation plus a new subscription, and the administrator
   guide §H.4 sequences it so the two never overlap.
3. **No double charges.** The checkout route refuses to create a second
   subscription for an account that already has a live one.
4. **No file is deleted** by any legacy event.

The administrator guide §H lists the per-cohort procedure for moving existing
customers over.

---

## 13. Where the code lives

| Concern | Path |
| --- | --- |
| Dodo client, price resolution, product validation, checkout, plan changes, portal, status mapping | `src/domain/billing/dodo.ts` |
| Pending checkout records, provider customer mapping | `src/domain/billing/checkout-session.ts` |
| Hosted-checkout redirect helper | `src/lib/billing/checkout.ts` |
| Legacy Razorpay compatibility | `src/domain/billing/razorpay.ts` |
| Checkout endpoint | `src/app/api/billing/checkout/route.ts` |
| Webhook endpoints | `src/app/api/webhooks/dodo/route.ts`, `src/app/api/webhooks/razorpay/route.ts` |
| Status and portal endpoints | `src/app/api/billing/status/route.ts`, `src/app/api/billing/portal/route.ts` |
| Cancellation and plan change | `src/app/api/billing/cancel/route.ts`, `src/app/api/billing/change-plan/route.ts` |
| Subscription sweep | `src/app/api/cron/subscription-sweep/route.ts` |
| Pricing configuration | `src/config/pricing.ts` |
| Schema | `supabase/migrations/0027_dodo_billing_provider.sql` |
| Administrator setup guide | `docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md` |

# Payment Lifecycle

**Status:** Design locked, with **two operational blockers** recorded in §9 that must
be cleared before subscriptions can be sold.

---

## 1. Approved prices — the complete list

| Plan | Storage | INR / month | USD / month |
| --- | --- | ---: | ---: |
| Free | 10 GB | ₹0 | $0 |
| Basic | 100 GB | ₹79 | $1.49 |
| Plus | 500 GB | ₹199 | $3.99 |
| Premium | 1 TB | ₹349 | $6.99 |
| Ultra | 5 TB | ₹999 | $19.99 |
| Max | 10 TB | ₹1,999 | $39.99 |

**No annual prices are approved.** **No GBP, EUR, AED, SGD, AUD or CAD prices
exist.** Neither is a UI convention: `plan_prices` has no rows for them, and checkout
resolves the amount from that table, so there is nothing to activate even if a client
asks for it.

Storage figures are decimal GB/TB (10 GB = 10,000,000,000 bytes). Money is stored in
minor units (paise/cents) as integers; no floating-point currency anywhere.

---

## 2. Plan state machine

```
                 checkout verified
   none ─────────────────────────────► active
     ▲                                   │  │
     │                                   │  └── cancel at period end ──┐
     │                                   │                             ▼
     │                          period ends without renewal       cancelled
     │                                   │                             │
     │                                   ▼                             │
     │                                expired ◄────────────────────────┘
     │                                   │
     │        recovery window (90 d)     │
     │                                   ▼
     └────────────── recovery_ends_at ──► downgraded to Free
                    (files preserved)
```

The important property: **expiry never deletes anything.** It downgrades the
allowance, preserves every file, keeps downloads working, and blocks new uploads that
would exceed the Free allowance.

---

## 3. Checkout

```
Client                Server                      Razorpay
  │  POST /checkout      │                           │
  │  { planId, period }  │                           │
  ├─────────────────────►│                           │
  │                      │ 1. resolve actor          │
  │                      │ 2. plan_prices WHERE      │
  │                      │    approved = true        │
  │                      │ 3. no row → unsupported   │
  │                      │ 4. create order ─────────►│
  │                      │◄────────── order id       │
  │◄─────────────────────┤                           │
  │  { orderId, amount, currency, keyId }            │
  │                                                  │
  │  (2a) redirect flow: server returns a URL, user  │
  │       pays on Razorpay's page and is sent back   │
  │  (2b) overlay flow: user pays in-page, browser   │
  │       receives payment id + signature            │
  │                      │                           │
  │  POST /billing/verify│                           │
  │  { paymentId, orderId, signature }               │
  ├─────────────────────►│                           │
  │                      │ HMAC verify ──────────────│
  │                      │ activate ONLY if valid    │
  │◄─────────────────────┤                           │
```

### Server-side price verification

The request contains a `planId` and a `period` and **nothing about money**. The steps:

1. `resolveActor()` — identity from the session.
2. `SELECT amount_minor, currency FROM plan_prices WHERE plan_id = $1 AND currency =
   $2 AND period = $3 AND approved = true`. Zero rows → `unsupported`, and the
   response names the reason: annual pricing is not announced, or that currency is not
   sold.
3. The order is created with that amount. There is no code path where a client-supplied
   figure reaches Razorpay.

### Why both verify and webhook exist

They answer different questions and both are required:

- `verify` answers *did this specific browser's payment succeed* — it lets the UI show
  the new plan immediately.
- The webhook answers *what does Razorpay's ledger say* — it is the authority for
  renewals, refunds, failures and disputes, and it arrives whether or not the customer
  ever returns to the tab.

Activation is idempotent and keyed on `provider_subscription_id` /
`provider_payment_id`, so whichever arrives first wins and the second is a no-op.

---

## 4. Signature verification

```ts
// billing/verify.ts — the shape, not the final code
const expected = crypto
  .createHmac("sha256", RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
```

- Compared with `timingSafeEqual`, never `===`, because a string comparison leaks
  timing.
- Webhooks verify `X-Razorpay-Signature` over the **raw** request body. The body must
  be read as a buffer before JSON parsing; a re-serialised object will not match.
- A missing secret means verification cannot happen, so the endpoint returns
  `not_configured` and **does not activate anything**. It never falls through to
  "assume valid".

---

## 5. Webhook handling

### Ordering

1. Read raw body.
2. Verify signature. Invalid → `400`, log, stop.
3. `INSERT INTO webhook_events (provider, event_id, …) ON CONFLICT DO NOTHING`.
   If the insert affected zero rows, this is a replay: return `200` immediately.
4. Process in a transaction. Mark `processed_at`, or record `error`.
5. Return `200` for anything we have durably stored — otherwise Razorpay retries a
   message we already have, forever.

### Events handled

| Event | Effect |
| --- | --- |
| `subscription.activated` | Set plan, period, `active` |
| `subscription.charged` | Extend period, insert invoice (unique payment id) |
| `subscription.cancelled` | `cancelled`, remaining period honoured |
| `subscription.halted` | `past_due`, advance warnings begin |
| `subscription.paused` | `past_due`; storage read-only above Free allowance |
| `payment.captured` | Invoice row if not already present |
| `payment.failed` | Record, notify, do not downgrade on first failure |
| `refund.created` | Mark invoice `refunded`; do not claw back files |

Unknown events are stored and ignored, not errored: a new Razorpay event type must not
break the endpoint.

### Duplicate delivery

The unique `(provider, event_id)` constraint is the deduplicator, and
`provider_payment_id` on `invoices` is the second line of defence. A double-delivered
`subscription.charged` produces one invoice and one period extension, which is the
only acceptable outcome — double-billing a customer from a retry is the worst bug this
system could ship.

---

## 6. Expiry, downgrade and the recovery window

When a subscription lapses, in order:

1. **Day 0 — `expired`.** Plan allowance drops to Free (10 GB). Every file is kept.
   Download, preview, share-with-existing-grantee and delete all continue to work.
   New uploads are refused when they would exceed the Free allowance, with a message
   that says exactly that and offers an upgrade — not a generic error.
2. **Warning emails** at day 0, 7, 30, 60 and 83 of the recovery window. Each states
   the date and what happens on it.
3. **`recovery_ends_at` = expired_at + 90 days** (configurable via
   `RECOVERY_WINDOW_DAYS`). Within the window, paying restores the previous plan and
   **nothing was ever lost**, because nothing was deleted.
4. **After the window**, the account is a Free account permanently. Files are still
   not deleted. Storage above the Free allowance becomes read-only: downloads work,
   new uploads are blocked until usage falls below the allowance.
5. **Deletion only via the approved process** — the same account-deletion flow,
   initiated by the customer, or a documented policy process that does not exist yet.
   **The system does not delete files because a subscription ended.** There is no
   code path for it, deliberately.

### Why this is expensive and still correct

Keeping 10 TB of files for a customer paying nothing is a real cost. Deleting their
work because a card expired is a much worse outcome, and it is the outcome that
generates the support queue and the reputation damage. The requirement is explicit and
the implementation follows it.

---

## 7. Cancellation

- Cancelling sets `cancel_at_period_end = true`. The customer keeps what they paid
  for until the period ends; the UI says the exact date.
- Immediate cancellation is not offered, because it would mean taking money for a
  period and then not providing it.
- Cancelling does not delete files and does not downgrade early.

---

## 8. Currency

- Display currency comes from region (existing middleware), and is a display
  preference only.
- **Billing currency is fixed at subscription time** and stored on the subscription.
  A customer who moves from India to the US keeps paying in INR for the current
  subscription; a new subscription may be in USD. Silently re-pricing someone
  mid-term, or converting their amount, is not done.
- INR and USD only. If a visitor's region maps to a currency with no approved price,
  the pricing page shows INR or USD with a stated note rather than inventing a local
  figure.

---

## 9. Operational blockers — must be cleared before selling

These are **not** things this codebase can decide, and no amount of implementation
resolves them.

### 9.1 Merchant-account capability

> **Unconfirmed:** whether the actual Razorpay merchant account is enabled for
> **international payments** and for **recurring/subscription** charges.

Until confirmed in the Razorpay dashboard:
- USD checkout must not be offered, and the server must refuse a USD order rather than
  creating one that Razorpay will reject.
- Recurring subscriptions must not be offered; only one-time charges are safe.

A configuration flag, `BILLING_CAPABILITIES.international` / `.recurring`, defaults to
**false**. It is flipped only after the dashboard confirms the capability, and until
then the UI says subscriptions are not yet available rather than failing at payment.

### 9.2 Payment methods

No payment method may be promised that the merchant account has not been approved for.
The product copy says "pay by card or UPI" only if that is true for the account. This
document does not assume it.

### 9.3 What is not a blocker

- Annual pricing: simply absent. No flag needed; there is no price row.
- Other currencies: absent, same.

---

## 10. Testing the lifecycle without taking money

Razorpay test keys exercise every path:

| Scenario | How |
| --- | --- |
| Successful subscription | Test card, verify activation once |
| Duplicate webhook | Post the same event twice; assert one invoice |
| Invalid signature | Post with a wrong `X-Razorpay-Signature`; assert no state change |
| Expiry | Move `current_period_end` into the past; run `subscription-sweep` |
| Recovery | Pay inside the window; assert plan restored and files intact |
| Post-recovery | Assert account is Free, files present, uploads blocked above allowance |
| Refund | Post `refund.created`; assert invoice status, files untouched |

A test asserts that no code path sets a file's `deleted_at` from a billing event.

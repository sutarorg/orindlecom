# Email System

**Status:** Resend is the provider and is implemented. Eleven templates render today
(§4.1). The rest of the table is the specification they will be added against — a
template missing from the list below is a gap, not a surprise.

**Queue semantics, and why they changed.** Mail that a job hands over is written to
`email_log` with `status = 'queued'` and the data its template needs in `payload`.
`/api/cron/email-retry` sends queued rows and retries failed ones, rendering from the
stored payload. Without the payload, a retry could only be rendered empty — and a
`verify-email` with a blank link is worse than no email at all.

Duplicate suppression uses `dedupe_key`, unique in the database (0013). The key names
the recipient *and* the notification. A global check on the template name would have
meant the first customer to receive a day-7 warning suppressed it for everyone else.

---

## 1. Principles

1. **Server-side only.** No API key reaches a browser. Every send happens in a route
   handler, server action or job.
2. **No silent drops.** A send either succeeds with a provider message id or is
   recorded as failed with the provider's error and retried. A failure the customer
   never learns about is the same as a lie.
3. **The recipient of support mail is a server constant**, never read from a request.
4. **Templates are branded in the Orindle visual language** — the same palette,
   wordmark and tone as the site. An email that looks like a different product erodes
   trust at exactly the moment trust matters.
5. **No tracking pixels.** Open tracking in transactional email is surveillance that
   buys nothing. Link tracking is likewise off.

---

## 2. Provider configuration

| Setting | Value |
| --- | --- |
| Provider | Resend |
| Sending domain | verified custom domain; `onboarding@resend.dev` only as a dev fallback |
| From | `Orindle <no-reply@…>` for transactional |
| Reply-to | the support inbox, so a reply reaches a person |
| Support inbox | `tejassutar.business@gmail.com` (constant in code) |

`RESEND_FROM_ADDRESS` currently defaults to `onboarding@resend.dev`, which is a
sandbox sender and will only deliver to the account owner. **Production requires a
verified domain.** Until then, the system reports email as not fully configured rather
than claiming delivery it cannot achieve.

---

## 3. Configuration states

| State | Behaviour |
| --- | --- |
| No `RESEND_API_KEY` | Contact form validates, then returns `unconfigured` with the support address; never claims success |
| Key, sandbox sender | Sends succeed only to the account owner; logged as `sent` but flagged in health as `sandbox` |
| Key + verified domain | Normal operation |

The distinction matters because "we sent it" is false in the middle state for any
recipient that is not the owner. The health endpoint reports `resend: "sandbox"`, and
the completion report must not claim email delivery works until the domain is verified.

---

## 4. Templates

Every template has a plain-text alternative. HTML-only mail is a deliverability and
accessibility problem.

### 4.1 Built

| Template | Trigger | Key content |
| --- | --- | --- |
| `verify-email` | Sign-up / email change | Single clear action, expiry stated |
| `reset-password` | Reset requested | 30-minute expiry, "ignore if not you" |
| `password-changed` | Password changed | Security notice; how to recover |
| `org-invite` | Member invited | Who invited, to which org, expiry, role |
| `invite-accepted` | Invite accepted | Notify the inviter |
| `storage-warning-80` | 80% of quota | Current usage, what happens at 100% |
| `subscription-started` | Verified activation | Plan, amount, currency, next date |
| `payment-failed` | Payment failed | What to do, grace period stated |
| `subscription-cancelled` | Cancelled | Access until date, no data loss |
| `subscription-expiring-N` | Day 0/7/30/60/83 of recovery | Exact date, what happens then |
| `account-deletion-requested` | Deletion scheduled | Nothing deleted yet, how to cancel |
| `account-deleted` | Deletion completed | Confirmation, retention exceptions |
| `support-received` | Contact form accepted | Reference id and the 48-hour commitment |

### 4.2 Specified, not built

| Template | Trigger | Key content |
| --- | --- | --- |
| `welcome` | Sign-up confirmed | What Orindle is, the Free allowance, one action |
| `verify-email` | Sign-up / email change | Single clear action, expiry stated |
| `reset-password` | Reset requested | 30-minute expiry, "ignore if not you" |
| `password-changed` | Password changed | Security notice; how to recover |
| `email-changed` | Email changed | Sent to **both** old and new address |
| `org-invite` | Member invited | Who invited, to which org, expiry, role |
| `invite-accepted` | Invite accepted | Notify the inviter |
| `role-changed` | Role changed | Old → new, by whom |
| `member-removed` | Member removed | Access ended, what remains |
| `storage-warning-80` | 80% of quota | Current usage, what happens at 100% |
| `storage-full` | 100% | Uploads blocked; download and delete still work |
| `subscription-started` | Verified activation | Plan, amount, currency, next date, invoice link |
| `payment-receipt` | Invoice paid | Amount, period, provider payment id |
| `payment-failed` | Payment failed | What to do, grace period stated |
| `subscription-cancelled` | Cancelled | Access until date, no data loss |
| `subscription-expiring` | Day 0/7/30/60/83 of recovery | Exact date, what happens then, how to restore |
| `subscription-expired` | Recovery ended | Now Free, files kept, how to upgrade |
| `account-deleted` | Deletion completed | Confirmation, retention exceptions |
| `data-export-ready` | Export job done | Time-limited link |
| `support-received` | Contact form accepted | Reference id and the 48-hour commitment |
| `support-reply` | Support response | Threaded reply |

### 4.1 Billing email rules

- Receipts and dunning are transactional, not marketing. No unsubscribe link, and no
  promotional content mixed in.
- The amount and currency in the email come from the database row, never recomputed,
  so an email can never disagree with the invoice.
- `subscription-expiring` is sent five times. Each names the date. "Your subscription
  is expiring soon" without a date is not a warning, it is noise.

---

## 5. The support path

```
Visitor → contact form (server action)
        → validate + honeypot + minimum fill time + rate limit
        → INSERT support_requests (delivery_status = 'pending')
        → Resend send to SUPPORT_INBOX
        → 2xx?  delivery_status = 'delivered', provider_message_id stored
                return { delivered: true }
        → else delivery_status = 'failed', error stored
                return { delivered: false } + the support address as fallback
```

This contract is already implemented in `src/app/contact/actions.ts` and is written up
in `docs/support/contact-form-contract.md`. It does not change.

### 5.1 Commitments in user-facing copy

The contact page states an acknowledgement within 48 hours and a resolution within one
month, matching the Consumer Protection (E-Commerce) Rules 2020. Those are operational
commitments, not code, but `support-received` restates the 48-hour figure so the
promise appears in writing at the moment of submission.

---

## 6. Delivery, retries and logging

```sql
email_log (to_address, template, status, provider_message_id, error, attempts, next_attempt_at)
```

- Every send appends a row. `status` starts `queued` and moves to `sent` or `failed`.
- `email-retry` runs every 15 minutes: `failed AND attempts < 5 AND next_attempt_at <=
  now()`, with exponential backoff (1 m, 5 m, 30 m, 2 h, 12 h).
- After 5 attempts it stays `failed` and is surfaced in the daily reconciliation, not
  deleted. A permanently failing address is information.
- Provider rate limits (429) are treated as retryable, not as failures.
- Hard bounces (invalid address) are terminal and marked as such.

### 6.1 Never silently dropped

Three specific cases that would otherwise vanish:

1. Verification email fails → the user is told on screen that the email could not be
   sent, with a retry action. Without this they wait forever for a message that will
   never arrive.
2. Invite email fails → the invite row still exists and the UI offers a copyable
   invite link, so the invite is not lost with the delivery.
3. Receipt fails → the invoice is still visible in the dashboard. The email is a
   convenience; the record is the truth.

---

## 7. Security

- The template set is a closed enum. No user input selects a template or a recipient.
- The support inbox is a constant. A crafted form cannot redirect mail.
- Email addresses are validated and normalised, but the **content** sent to a user is
  never derived from another user's input — an invite email includes the inviter's
  name, which is escaped, and the organisation name, which is escaped. HTML injection
  into an email body is still HTML injection.
- Unsubscribe links appear only on marketing mail. There is currently no marketing
  mail.
- No secrets in templates, no internal ids beyond the reference id shown to the user.

---

## 8. Compliance touchpoints

- **DPDP:** transactional email is a legitimate-use processing activity for the
  service contract. Erasure requests remove the address from `email_log` except where
  retention is required for financial records (invoices).
- **CP(E-Commerce) 2020:** the grievance acknowledgement and resolution windows are
  restated in `support-received`.
- **CAN-SPAM / PECR:** not applicable to transactional mail, but every template
  identifies Orindle and includes a physical/contact address in the footer, which is
  good practice and required the moment any marketing mail is added.

---

## 9. What is not implemented yet

Stated plainly so no completion report overclaims:

- Only the contact-form send exists. **No other template is wired.**
- No verified production domain.
- No bounce or complaint webhook from Resend.
- `email_log` and the retry job are designed, not built.

The audit records these as outstanding rather than describing them as complete.

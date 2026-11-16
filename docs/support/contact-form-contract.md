# Orindle — Contact Form Contract

The contract between the contact form and the backend that will deliver it, the
security properties it must hold, and the states the UI is allowed to show.

Recipient, permanently: **`tejassutar.business@gmail.com`**.
Transport: **Resend**, called from a `"use server"` action only.

---

## 1. The two rules that govern everything else

1. **A success message appears only after the provider accepts the message.** Not
   "after validation", not "optimistically", not "because the request didn't throw".
   `delivered: true` is set in exactly one place: after a 2xx from Resend.
2. **The recipient is never taken from the request.** `SUPPORT_INBOX` is a
   module-level constant in `src/app/contact/actions.ts`. There is no hidden field,
   no query parameter and no header that can change where mail goes.

Everything below exists to keep those two true.

---

## 2. Where things live

| Concern | Location |
| --- | --- |
| Form UI | `src/components/forms/contact-form.tsx` (`"use client"`) |
| Handler | `src/app/contact/actions.ts` (`"use server"`) |
| Page | `src/app/contact/page.tsx` |
| Recipient constant | `SUPPORT_INBOX` in the action file |
| Support address shown in copy | `SITE.supportEmail` in `src/config/site.ts` |

Both must hold the same value; the cross-document check in
`docs/legal/policy-content-review.md` §7 covers it.

---

## 3. Request shape

The form posts to a server action, never to a third-party endpoint. That is what
keeps the API key off the client — there is no `fetch("https://api.resend.com/...")`
anywhere in a client bundle.

### Fields

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `name` | text | yes | 2–80 characters after trim |
| `email` | email | yes | matches `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`, ≤160 chars |
| `subject` | select | yes | one of `sales` · `support` · `billing` · `privacy` · `other` |
| `message` | textarea | yes | 10–2000 characters after trim |
| `company_website` | text | — | honeypot; must be empty |
| `elapsed_ms` | hidden | — | milliseconds between render and submit |

`elapsed_ms` is set from a `useEffect` at mount and refreshed `onSubmit`, so it
measures real time-to-fill rather than a constant.

---

## 4. Server-side validation

Validation runs in the action and is authoritative. The browser's `required` and
`type="email"` are a convenience, not a control.

```ts
export interface ContactState {
  status: "idle" | "success" | "error" | "unconfigured";
  message: string;
  /** True ONLY after the provider returned 2xx. Gates the success UI. */
  delivered: boolean;
  fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
}
```

Field errors are returned as a map so the form can show each one under its input
with `aria-invalid` and `aria-describedby` wired up. A general message accompanies
them: *"Please check the highlighted fields."*

---

## 5. Spam protection

Three layers today, deliberately layered so a fourth can be added without touching
the component.

### 5.1 Honeypot

A field named `company_website` inside a visually hidden container, `tabIndex={-1}`,
`aria-hidden="true"`, `autoComplete="off"`. A human never sees it; naive bots fill
every input they find.

On a non-empty honeypot the action returns `{ status: "success", delivered: true }`
**and sends nothing**. The bot learns nothing; no real message is lost because a
real person cannot reach the field.

### 5.2 Time-to-fill

A submission arriving in under 1,500 ms is rejected with a message that says so. A
human cannot read and fill four fields in that window.

### 5.3 Rate limit

In-memory, 5 attempts per 15 minutes per client address (from `x-forwarded-for`, then
`x-real-ip`). Explicitly a speed bump, not a security control:

- It resets on deploy and is not shared between instances.
- The durable limit belongs at the edge — see §7.

### 5.4 The integration point for CAPTCHA

The structure is ready for a token check without restructuring. To add Cloudflare
Turnstile:

1. Render the widget in `contact-form.tsx` and pass its token as a hidden field
   `cf-turnstile-response`.
2. In the action, between the time-to-fill check and validation, verify the token
   server-side against `https://challenges.cloudflare.com/turnstile/v0/siteverify`
   using `TURNSTILE_SECRET_KEY`. Reject on failure with the same shape as a rate
   limit.
3. The honeypot and time check stay — they cost nothing and catch different traffic.

No component outside `contact-form.tsx` needs to change.

---

## 6. Delivery via Resend

```ts
POST https://api.resend.com/emails
Authorization: Bearer <RESEND_API_KEY>
Idempotency-Key: <subject>-<email>-<message.length>-<minute>
{
  from: RESEND_FROM_ADDRESS ?? "Orindle <onboarding@resend.dev>",
  to: ["tejassutar.business@gmail.com"],
  reply_to: <submitter email>,
  subject: "[Orindle · <Label>] <name>",
  text: "Name: …\nEmail: …\nSubject: …\nSite: …\n\n<message>"
}
```

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | yes, for delivery | Never read outside the action. Never prefixed `NEXT_PUBLIC_`. |
| `RESEND_FROM_ADDRESS` | no | Verified sender. Falls back to Resend's onboarding address, which only delivers to the account owner — so a real deployment must set this. |

### Why `reply_to` matters

Support replies by hitting reply in Gmail. Without `reply_to`, that reply goes to
Orindle's own address and the conversation dies. This is the single most common way a
contact form silently loses customers, and it is one header.

### Idempotency

A double-submit (double click, flaky network, React retry) should resolve to one
delivered message. The key includes the minute, so a genuine second message a minute
later is still delivered.

---

## 7. States the UI may show

| State | When | What the reader sees |
| --- | --- | --- |
| `idle` | Initial | The form |
| `success` + `delivered` | Provider returned 2xx | The form is **replaced** by a confirmation panel |
| `error` + field errors | Validation failed | Fields highlighted, general message, draft preserved |
| `error` + rate limit / too-fast | Spam heuristics | Inline error naming the cause, with the inbox as fallback |
| `error` + provider refusal | Resend returned non-2xx | *"Your message wasn't sent — the mail service refused it."* + direct address |
| `error` + network throw | `fetch` threw | *"Your message wasn't sent — the request failed."* + direct address |
| `unconfigured` | `RESEND_API_KEY` absent | *"Email delivery isn't connected on this deployment yet, so nothing was sent."* + direct address |

### Draft preservation

React 19 resets a form after a server action resolves. That would throw away a
600-word message on a delivery failure, so `contact-form.tsx` captures every field on
submit and restores them whenever `delivered` is false.

### What the UI must never do

- Show "Thanks, we'll be in touch" after anything other than a 2xx.
- Show a success toast for an unconfigured deployment.
- Clear the form on failure.
- Hide the fallback address behind a "contact us" link.

---

## 8. Accessibility

- Every input has a visible `<label>`. No placeholder-as-label.
- Required fields carry a visible `*` and the `required` attribute.
- Errors: `aria-invalid="true"` and `aria-describedby` pointing at the error element,
  which has a stable `id`. Errors are text, not colour alone.
- The submission result is inside `role="status" aria-live="polite"`, so it is
  announced without moving focus.
- Hints are separate from errors and linked with `aria-describedby` only when no
  error is present, so a screen reader never reads both.
- The submit button is `disabled` while pending and shows a spinner plus "Sending…".
- Focus rings are never removed.
- Touch targets are 44px; the submit button is `h-11`.

---

## 9. Failure modes and what happens

| Scenario | Result | Reader impact |
| --- | --- | --- |
| No `RESEND_API_KEY` | `unconfigured`, nothing sent | Told plainly, given the address |
| Resend 4xx (bad payload or key) | `error` | Told it wasn't sent, given the address |
| Resend 429 (rate limited) | `error` | Told it wasn't sent, given the address |
| Resend 5xx | `error` | Told it wasn't sent, given the address |
| Timeout / DNS failure | `error` | Told it wasn't sent, given the address |
| Client offline | Action never runs | Browser shows the native network error; the draft survives |
| Double submit | One message, via `Idempotency-Key` | Nothing visible |

Note what every row has in common: the reader is told the message did not arrive, and
given a way to send it anyway. There is no row where a failure looks like a success.

---

## 10. Phase 6 checklist

What has to be true before this is a production support channel:

- [ ] `RESEND_API_KEY` set in the deployment environment
- [ ] `RESEND_FROM_ADDRESS` set to a domain-verified sender (not `onboarding@resend.dev`)
- [ ] SPF and DKIM records published for the sending domain
- [ ] A durable rate limit at the edge, replacing reliance on the in-memory map
- [ ] Turnstile (or equivalent) wired per §5.4
- [ ] Delivery monitored, with an alert when the provider starts failing
- [ ] The inbox actually monitored, against the response time the page promises
- [ ] A named grievance officer, if the form is also the grievance channel
      (Consumer Protection (E-Commerce) Rules 2020, r.4(4)–(6): 48h acknowledgement,
      one month resolution)
- [ ] Privacy Policy §2 updated with the processor relationship if Resend is added to
      the sub-processor list

Until at least the first two are done, the form correctly reports that delivery is
not configured — which is the point of building it this way.

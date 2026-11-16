# Orindle — Auth State Handling

How the screens decide what to show, and how failures travel from the provider to
a sentence next to a field. Companion to `auth-screen-specification.md` (what it
looks like) and `auth-service-contract.md` (what the backend returns).

---

## 1. The three layers

```
┌─ Client component ─────────────────────────────────────────────┐
│  local field errors (eager, on blur)                           │
│  useActionState → state, formAction, pending                   │
│  renders: field errors, alerts, loading, success panel         │
└───────────────────────────┬────────────────────────────────────┘
                            │ FormData
┌───────────────────────────▼────────────────────────────────────┐
│ Server action (src/app/(auth)/actions.ts)                      │
│  re-validates every field                                      │
│  calls the service, maps failure → AuthFormState               │
│  redirects on success, returns state on failure                │
└───────────────────────────┬────────────────────────────────────┘
                            │ typed input
┌───────────────────────────▼────────────────────────────────────┐
│ AuthService (src/lib/auth/supabase/service.ts)                 │
│  never throws; returns AuthResult<T>                           │
│  maps provider errors → AuthErrorCode                          │
└────────────────────────────────────────────────────────────────┘
```

Each layer has exactly one job. The client validates for speed; the server
validates for truth; the service translates the provider. No layer re-implements
another's.

---

## 2. Form state

```ts
interface AuthFormState {
  status: "idle" | "error" | "success";
  message: string;
  code?: AuthErrorCode;
  fieldErrors?: Partial<Record<AuthField, string>>;
  retryAfterSeconds?: number;
}
```

`INITIAL_AUTH_STATE` is `{ status: "idle", message: "" }`. `status` drives the
render:

| `status` | Render |
|---|---|
| `idle` | Form as normal |
| `error` + `fieldErrors` | Per-field messages; no form-level alert |
| `error` without `fieldErrors` | Form-level `Alert tone="error"` |
| `success` | Form replaced by `SuccessPanel` |

**Field errors suppress the form-level alert.** If every message is already next
to its field, a banner repeating "check the fields below" is noise.

---

## 3. Validation timing

The rule: **validate on blur, not on keystroke; clear on keystroke, not on blur.**

| Moment | Behaviour | Why |
|---|---|---|
| Typing | Errors for that field clear | Keeps the correction path open; a red border that stays while you fix it is hostile |
| Blur | Field validates, if non-empty | Earliest point the visitor has finished their intent |
| Submit | Full validation, client then server | The authoritative check |
| Server returns | Field errors mirrored into local state | They clear on the next edit without another round trip |

An empty field is not validated on blur. Tabbing through a form shouldn't paint
it red before anything has been typed.

The confirmation-password field re-checks whenever *either* password changes, but
only once the confirmation field is non-empty — so it can't complain before the
visitor has started.

---

## 4. Duplicate validation

`src/lib/auth/validation.ts` is imported by both the client components and the
server actions. There is one definition of valid email, one minimum password
length, one name rule. The two layers cannot drift.

The server re-validates even though the client already did: a client can be stale,
and it can be bypassed entirely.

---

## 5. Loading state

`pending` from `useActionState` threads through to:

- The submit button: `disabled`, `aria-busy="true"`, spinner, label swaps to a
  present participle ("Signing in…", "Creating account…", "Updating…").
- Every input in the form: `disabled`.

Why disable inputs too: on the signup form a second submit means a second
confirmation email, and on a free-tier project that burns the rate limit.

The button keeps its width by swapping only the label — a button that resizes
mid-click moves the target out from under the pointer.

Verified: label `"Signing in…"`, `disabled: true`, `aria-busy: "true"`,
`.animate-spin` present, inputs disabled.

---

## 6. Error rendering

| Scope | Component | ARIA |
|---|---|---|
| Field | inline `<p>` with alert circle icon | `role="alert"`, wired via `aria-describedby` + `aria-invalid` |
| Form | `Alert tone="error"` | `role="alert"` |
| Form (non-failure) | `Alert tone="warning" \| "info"` | `role="status"` |
| Success | `SuccessPanel` | `role="status"` |

**Tone selection matters.** `oauth_denied` is the visitor pressing Cancel. It
renders in **info**, not error — nothing went wrong, they changed their mind.

The error is announced because the live region updates, and it is visible because
it sits next to the control. An error that only changes border colour is invisible
to a screen reader; one rendered above the fold while the visitor is looking at a
field further down is invisible to everyone else.

---

## 7. Per-screen state machines

### Login

```
idle
 ├─ blur invalid ─────────────► field error (no request)
 ├─ submit, invalid ──────────► field errors
 ├─ submit, provider fails ───► code-specific state:
 │                               invalid_credentials → form alert
 │                               email_not_confirmed → warning + resend link
 │                               rate_limited        → form alert + retry hint
 │                               not_configured      → explicit notice
 └─ submit, success ──────────► redirect (form never renders success)
```

Login has **no success state** — a signed-in visitor belongs on `/account`, not
looking at a form that says "signed in".

### Signup

```
idle
 ├─ submit, invalid ──────────► field errors incl. terms
 ├─ submit, duplicate ────────► warning + "Sign in instead"
 ├─ needsVerification ────────► redirect /verify-email?email=…
 └─ session issued ───────────► redirect /account
```

### Forgot password

```
idle
 ├─ submit, invalid email ────► field error
 ├─ rate_limited / network ───► form alert (actionable)
 └─ anything else ───────────► success panel, identical either way
```

The success panel does not echo the address. Neither branch reveals existence.

### Reset password

Decided server-side before render:

```
no recovery session → expired-link panel (no form)
recovery session    → form
   ├─ mismatch ─────► field errors
   ├─ link expired ─► form alert with code link_expired
   └─ success ──────► SuccessPanel + button to /login
```

### Verify email

```
idle → resend → success alert + button disabled (prevents rate-limit burn)
             → rate_limited → alert with retry hint
```

### Callback

```
code         → exchange → session → redirect successPath
token_hash   → verifyOtp → session → redirect successPath
error=denied → /login?error=oauth_denied      (info tone)
no params    → /login?error=callback_failed
failure      → destination chosen so the next action is available (see flow doc)
```

---

## 8. Network failure

Distinct from an auth failure and handled as one:

- `mapProviderError` maps `fetch`, `network`, `timeout` and thrown transport
  errors to `network`.
- Message: "We couldn't reach the server. Check your connection and try again."
- The form stays populated and enabled — the visitor's typed values are not lost.

**React 19 form reset.** React resets a `<form>` after a server action resolves,
which would wipe a password on a failed submit. The contact form solved this by
capturing values `onSubmit` into a ref and restoring them when the result isn't
success. The auth forms avoid the problem differently: every field is a
controlled input whose value lives in React state, so a native reset has nothing
to clear. Verified — after a failed signup submit the name and email are still
populated.

---

## 9. Redirect handling

- On success the action calls `redirect()`. That throws by design in Next; it is
  not caught, and it is the last statement in each success path.
- `next` is validated by `safeRedirectPath` before use — root-relative only,
  parsed and normalised, and restricted to paths we serve.
- Callback failures attach a **code**, never provider text. `/login` maps known
  codes to sentences and renders nothing for an unknown one.

---

## 10. Session state

`getCurrentSession()` returns `null` rather than a failure when there is no
session, so "signed out" is a value, not an error:

| Consumer | Behaviour |
|---|---|
| `/account` | null → redirect `/login?next=/account` |
| `/reset-password` | null → expired-link panel |
| `/login`, `/signup` | do not read it; a signed-in visitor is not redirected away |

That last row is deliberate. Auto-redirecting a signed-in visitor away from
`/login` breaks the "sign in as someone else" path and traps people who arrive
with a stale cookie.

---

## 11. Verification log

Checks run against the production build with no Supabase credentials — the
worst-case path, where every operation must fail honestly.

| Check | Result |
|---|---|
| Login: empty submit | `Enter your email address.` / `Enter your password.`, both `aria-invalid` |
| Login: malformed email on blur | `Enter an email address we can reply to.` |
| Login: reveal toggle | `type` text ↔ password, `aria-pressed` true, label flips |
| Login: valid submit, unconfigured | Explicit notice; stays on `/login`; email preserved |
| Signup: strength 4 levels | `abc` → 0, `password123` → 1 Weak, `abcdefgh1` → 1 Weak, long+varied → 4 Strong |
| Signup: mismatch + no terms | `Those passwords don't match yet.` / `Accept the terms to create an account.` |
| Signup: valid submit, unconfigured | Explicit notice; name and email preserved |
| Forgot: valid submit | "Check your inbox"; address **not** echoed |
| Reset: no session | Title "This link has expired" + warning alert |
| Loading state | `"Signing in…"`, disabled, `aria-busy`, spinner, inputs disabled |
| Callback errors | `?error=oauth_denied` → info alert; missing params → `callback_failed` |
| Focus (keyboard) | 3px `rgba(49,120,251,.16)` halo + solid blue border at every tab stop |
| Autocomplete | `username`, `current-password`, `new-password`, `name`, `email` on the right fields |
| Labels | Every input labelled; exactly one `h1`; `main` present |
| Reduced motion | Transitions collapse to `1e-06s` |
| Mobile input size | 16px at 360px (no iOS zoom) |
| Console errors | **none** across all flows |
| Responsive | 63 screenshots, 9 widths × 7 routes, zero overflow |

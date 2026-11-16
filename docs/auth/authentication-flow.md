# Orindle — Authentication Flow

How a person gets in, gets back in, and gets out. Written to be read alongside
`auth-screen-specification.md` (what each screen looks like),
`auth-service-contract.md` (what the backend must answer) and
`auth-state-handling.md` (what the UI does with those answers).

Source of truth for behaviour is the code: `src/app/(auth)/actions.ts`,
`src/app/auth/callback/route.ts`, `src/lib/auth/`.

---

## 1. Design constraints

These are requirements, not preferences. Each one has a comment at the place in
the code where it is enforced.

1. **Never claim success the backend didn't confirm.** No screen sets a success
   state from a client-side guess. The unconfigured deployment says so plainly
   instead of pretending to log anyone in.
2. **Never reveal whether an email address has an account.** Password recovery
   gives the same response either way, and the signup duplicate check is the one
   deliberate exception (Supabase already leaks it, and hiding it there would
   strand a returning visitor on a form that can never succeed).
3. **No authentication secrets in client code.** The service key never leaves the
   server; `src/lib/auth/` is `server-only`. The browser talks to our own route
   handlers, never to the provider directly.
4. **No browser alert boxes.** All feedback is inline (`Alert`), with live regions
   so it is announced.
5. **Every redirect parameter is validated.** `next` is attacker-controlled; see
   `safeRedirectPath` in `src/lib/auth/redirect.ts`.

---

## 2. Routes

| Route | Rendering | Purpose |
|---|---|---|
| `/login` | dynamic | Email + password, OAuth, remember-me |
| `/signup` | dynamic | Full name, email, password, confirm, terms |
| `/forgot-password` | dynamic | Request a reset link |
| `/reset-password` | dynamic | Choose a new password — requires a recovery session |
| `/verify-email` | dynamic | Explain confirmation + resend the link |
| `/auth/callback` | route handler | Exchanges a code/token for a session, then redirects |
| `/api/auth/oauth/[provider]/start` | route handler (POST) | Returns the provider consent URL |
| `/account` | dynamic | Where a confirmed session lands (product shell lands in PROMPT 3) |

Legacy `/sign-in` and `/sign-up` are 308 redirects that preserve the query
string, so `/sign-up?plan=plus` still arrives at `/signup?plan=plus`.

`/auth/callback` never renders. Every outcome is a redirect, because a callback
URL in history must not be re-openable into a live error page.

---

## 3. Sign in

```
/login
  │
  ├─ client validation on blur ──► inline error, no request
  │
  ├─ submit ──► signInAction (server action)
  │               │
  │               ├─ re-validate ──► field errors + form message
  │               │
  │               └─ signIn({email, password, remember})
  │                     │
  │                     ├─ failure ──► mapped code + message
  │                     │               ├─ invalid_credentials  → "That email and password don't match an account."
  │                     │               ├─ email_not_confirmed  → warn + link to /verify-email
  │                     │               ├─ rate_limited         → retry hint
  │                     │               ├─ network              → "couldn't reach the server"
  │                     │               └─ not_configured       → explicit notice
  │                     │
  │                     └─ success ──► redirect(next ?? /account)
  │
  └─ OAuth (only if enabled) ──► POST /api/auth/oauth/google/start
                                     └─ JSON { ok, url } ──► window.location.assign(url)
                                            └─ provider ──► /auth/callback?code=…&next=…
```

**Remember me.** Supabase's SSR helper always writes persistent cookies. When the
box is unchecked, `shortenAuthCookiesToSession()` rewrites every `sb-*` cookie
without a `maxAge`, giving a browser-session cookie. It is checked by default
because the alternative — being signed out every time the browser closes — is
the more common complaint.

**Error precedence.** `status` is checked before message text, because a 429 on a
free-tier project is the most common real failure and its message is generic.

---

## 4. Sign up

```
/signup?plan=<id>
  │
  ├─ submit ──► signUpAction
  │               ├─ re-validate all five fields
  │               └─ signUp({fullName, email, password, emailRedirectTo})
  │                     ├─ user_already_exists ──► warn + "Sign in instead"
  │                     ├─ weak_password       ──► field error on password
  │                     ├─ needsVerification   ──► redirect /verify-email?email=…
  │                     └─ session issued      ──► redirect /account
  │
  └─ (no email confirmation configured) ──► straight to /account
```

The `plan` query parameter is matched against `PLANS` before being echoed back;
an arbitrary string is dropped rather than rendered. It changes the helper copy
and travels as a hidden field, but it does **not** create a subscription — there
is no payment integration in this phase and the UI says nothing to suggest
otherwise.

Registration asks for four fields and a consent checkbox. Nothing else: no
company, phone, role or "how did you hear about us". Every one of those reduces
completion and none is needed to create an account.

---

## 5. Password recovery

Two screens, deliberately separate, because the second one needs a live session.

```
/forgot-password
  │  submit ──► requestPasswordResetAction
  │               └─ resetPassword({email, redirectTo: /auth/callback?next=/reset-password})
  │                     │
  │                     ├─ rate_limited / network ──► surfaced (the visitor must act)
  │                     └─ anything else ──────────► success state, identical either way
  │
  └─ email link ──► /auth/callback?token_hash=…&type=recovery
                        └─ verifyOtp ──► session ──► redirect /reset-password
                                                        │
                                                        ├─ no session ──► expired-link state
                                                        └─ session ──► ResetPasswordForm
                                                                          └─ updateUser({password})
```

**Why the outcome is identical either way.** Anything that differs — the message,
the HTTP status, a longer pause — turns this into an account-enumeration oracle.
`requestPasswordResetAction` therefore never branches on existence, and the
confirmation deliberately does not echo the address back.

The exception is rate limiting and transport failure. Those are real conditions
the visitor can act on, and swallowing them would leave someone staring at
"check your inbox" for an email that was never sent.

**Reset password is guarded on the server.** `ResetPasswordPage` calls
`getCurrentSession()` first. No session means no form — just an honest
expired-link state with a link to request another. Rendering the form anyway and
failing on submit would waste the visitor's time and their new password.

---

## 6. Email verification

```
/signup ──► needsVerification ──► /verify-email?email=…
                                        │
                                        ├─ ResendVerificationForm ──► resend({type:"signup"})
                                        │
                                        └─ email link
                                             └─ /auth/callback?token_hash=…&type=signup
                                                  │
                                                  ├─ verifyOtp success ──► /account
                                                  ├─ link_expired      ──► /verify-email?error=link_expired
                                                  └─ other             ──► /login?error=callback_failed
```

Verification only ever completes through `/auth/callback` with a real token.
`/verify-email` is an explanation and a resend button; it has no path that marks
anything verified on its own.

The address is prefilled when we know it (arriving from signup) and honestly
blank when we don't (opening the URL directly). We never guess.

---

## 7. OAuth callback

`/auth/callback` handles four input shapes:

| Input | Meaning | Handling |
|---|---|---|
| `?code=…` | PKCE — OAuth or magic link | `exchangeCodeForSession(code)` |
| `?token_hash=…&type=…` | Email confirmation or recovery | `verifyOtp({token_hash, type})` |
| `?error=access_denied` | Visitor pressed Cancel at the provider | `→ /login?error=oauth_denied` (info tone, not an error) |
| neither | Malformed or truncated link | `→ /login?error=callback_failed` |

Failure destinations are chosen so the visitor's *next* action is available:

| Failure | Destination |
|---|---|
| `link_expired` (confirmation) | `/verify-email?error=link_expired` — has the resend form |
| `link_expired` (recovery) | `/forgot-password` — has the request form |
| `session_missing` (recovery) | `/forgot-password` |
| `oauth_denied` | `/login?error=oauth_denied` |
| `not_configured`, `network`, `rate_limited`, other | `/login?error=<code>` |

Destinations carry a **code**, never provider text: provider strings leak
internals and change without notice. `/login` maps known codes to sentences and
renders nothing for an unrecognised one.

Every callback response sets `Cache-Control: no-store` — the URL carries a
one-time code.

**Why POST starts OAuth.** A GET would let any page navigate the visitor into a
sign-in flow with `next` pre-set, which is the first half of a login-CSRF. The
start endpoint is POST-only and validates `next` before use.

---

## 8. Session lifetime

- Supabase refreshes the session on each request through the SSR cookie helper.
- Standard auth cookies are `sb-*`, `path=/`, `sameSite=lax`, `secure` in
  production.
- `getCurrentSession()` calls `getUser()`, which revalidates against the auth
  server. It does not trust the cookie alone — anything gating access must use
  this, not `getSession()`.
- Signing out calls `signOut()`, which clears the cookie scope, then redirects to
  `/login`.

---

## 9. Redirect safety

Every `next`, `redirectTo` and `returnTo` passes through `safeRedirectPath`:

1. Must be root-relative and must not start `//` or `/\` (protocol-relative).
2. Parsed against a throwaway origin so `..` segments and encoded slashes
   normalise before inspection.
3. The normalised path must be one we serve (`/`, `/account`, `/pricing`,
   `/features`). Anything else falls back.

String-prefix matching alone is not enough: `/\/evil.com` and `/%2F%2Fevil.com`
both defeat it.

---

## 10. What this phase does not do

- No password is stored, hashed or checked in this repository. All of that is the
  provider's job.
- No file library exists behind `/account` yet. The page shows the confirmed
  identity and says plainly that uploads are not stored.
- No plan is purchased at signup. The `plan` parameter is copy, not commerce.
- No email is sent by this codebase — the provider sends it.

Observed behaviour with no `NEXT_PUBLIC_SUPABASE_URL` configured: every form
validates fully, then answers with an explicit "accounts aren't connected on this
deployment yet" notice. Nothing is created, nothing is sent, and nothing pretends
otherwise.

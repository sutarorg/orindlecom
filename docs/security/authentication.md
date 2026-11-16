# Authentication

**Methods:** email + password, and Google OAuth
**Second factor:** optional TOTP
**Phone numbers:** never collected

---

## 1. The two ways in

| Method | Route | Verification |
| --- | --- | --- |
| Email + password | `/signup`, `/login` | Confirmation link before any storage is granted |
| Google | `Continue with Google` on both | Provider's `email_confirmed_at` claim, read server-side |

Both converge on one `auth.users` row, one profile, one `account_security` row and one
storage allowance. There is no separate "Google account" concept anywhere in the schema.

Full detail: `google-authentication.md`, `two-factor-authentication.md`.

---

## 2. Routes

| Route | Purpose | Auth required |
| --- | --- | --- |
| `/signup` | Create an account | No |
| `/login` | Sign in | No |
| `/forgot-password` | Request a reset link | No |
| `/reset-password` | Set a new password from a link | Recovery session |
| `/verify-email` | Confirm an address, resend the link | No |
| `/auth/callback` | OAuth and email-link landing | No (one-time code) |
| `/auth/set-password` | Finish Google onboarding | Yes |
| `/auth/mfa` | Second-factor challenge | Yes, at AAL1 |

None of these is indexable — all are `noIndex` and disallowed in `robots.txt`.

---

## 3. Registration

```
1. Validate (client, then server — the server's check is the one that counts)
2. Anti-abuse gate:  rate limit → disposable domain → Turnstile → risk assessment
3. supabase.auth.signUp()
4. Record the outcome (applies any cooldown the band calls for)
5. → /verify-email
```

The gate runs **before** the account exists, because a refusal must leave no trace of one.
Full detail: `../security/anti-abuse-system.md` §7.

A refused signup returns a sentence a person can act on:

| Refusal | Copy |
| --- | --- |
| Disposable domain | "Orindle needs an address you'll keep. Temporary inboxes can't verify an account, so please use a permanent email." |
| Rate limited | "That's several attempts in a short time. Wait a few minutes and try again." |
| Device throttled | "Several accounts have been created from this device recently. Try again later, or sign in if you already have an account." |

---

## 4. Sign-in

```
1. Rate limit on the client address
2. supabase.auth.signInWithPassword()
3. mfaState() → if nextLevel is aal2, redirect /auth/mfa and stop
4. readOwnSecurity() → if a password is still owed, redirect /auth/set-password
5. → next
```

Steps 3 and 4 are both redirects rather than warnings, because a check that can be
dismissed is not a gate.

**Failures never reveal whether an address exists.** A wrong password and an unknown
address produce the same sentence. The password-reset screen is the same: it returns
"check your inbox" for both, and only a rate-limit or transport failure is surfaced.

---

## 5. Sessions

| Property | Value |
| --- | --- |
| Storage | `HttpOnly` cookies managed by `@supabase/ssr` |
| Refresh | Middleware refreshes on every request that needs a session |
| Validation | `getUser()` — revalidates with the auth server. `getSession()` trusts the cookie and is never used for gating |
| "Remember me" | Unchecked makes the cookies session-scoped |
| Assurance | AAL1 after one factor, AAL2 after a second; checked server-side |

The distinction between `getUser()` and `getSession()` is the most important line in the
auth layer: a forged or stale cookie passes `getSession()` and fails `getUser()`.

---

## 6. Password policy

- Minimum 8 characters, maximum 72 (bcrypt's ceiling)
- Strength is *advisory* — length and variety produce a meter, and there are penalties
  for common passwords, repeats, sequences and the product's own name
- No forced character classes: they push people toward `Password1!` without adding
  entropy
- Argon2/bcrypt hashing is Supabase's; this product never sees a password hash

Change password requires the current password (`/api/users/me/password`). Reset uses a
Supabase recovery link.

---

## 7. Enumeration resistance

| Surface | Behaviour |
| --- | --- |
| Sign-in | Same message for wrong password and unknown address |
| Password reset | "Check your inbox" either way |
| Resend verification | Same response either way |
| Signup | Says "already registered" — **deliberately** |

The signup case is the one exception, and it is a considered one: Supabase already
exposes it through its own response, hiding it would make the form useless ("check your
email" when nothing was sent), and rate limiting makes the enumeration channel expensive.
It is documented rather than pretended away.

---

## 8. Security properties

| Property | Mechanism | Test |
| --- | --- | --- |
| No open redirect | `safeRedirectPath()` parses rather than prefix-matches | `validation.test.ts` |
| No client-supplied identity | `resolveActor()` reads the verified session | `architecture.test.ts` |
| Callbacks not cached | `Cache-Control: no-store` | `auth-security-flow.test.ts` |
| No `isNewUser` trust | Onboarding state from `account_security` | `auth-security-flow.test.ts` |
| Set Password not skippable | Middleware gate on every route | `auth-security-flow.test.ts` |
| MFA not bypassable | AAL2 confirmed before redirect | `auth-security-flow.test.ts` |
| No phone collection | No `phone_number` token anywhere | `auth-security-flow.test.ts` |
| Verified email before storage | `effective_plan_bytes()` returns 0 | `anti-abuse.test.ts` |

---

## 9. Not verified in this repository

Nothing in this project has run against a live Supabase project. Specifically unverified:

- a real Google OAuth round trip
- a real confirmation email arriving and its link working
- real TOTP enrolment and challenge
- Supabase's own project-level rate limits (configured in its dashboard, not here)
- email deliverability from the configured sending domain

The logic is tested against the real database schema and by static assertions on the
flows. The third-party integrations are configured but unexercised.

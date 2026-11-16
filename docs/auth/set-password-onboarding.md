# Set Password Onboarding

**Route:** `/auth/set-password`
**Required for:** accounts created by Google that have no password yet
**Never shown for:** email/password accounts, or a Google account that has completed it

---

## 1. Why it exists

A person who signs up with Google has an account but no password. Today that is fine —
they sign in with Google. It becomes a problem the first time Google is unavailable, the
account is locked, or they simply want to sign in from a device where they are not signed
in to Google.

This step closes that gap at the moment it is cheapest: right after signup, when the
person is already authenticated and already engaged.

---

## 2. The gate

Three independent places enforce it, and all three are needed:

| Layer | File | What it catches |
| --- | --- | --- |
| Database trigger | `handle_new_user_security()` (0014) | Sets `password_setup_required = true` for every Google-created account, so it can never be missed by a code path |
| Middleware | `src/middleware.ts` | Every authenticated route, including a bookmarked deep link |
| Page | `src/app/auth/set-password/page.tsx` | The route itself, and the "already done" redirect |

The middleware check is the one that matters. A per-page check means the page that is
forgotten is the hole; middleware covers every route at once.

**Failing open in middleware is deliberate.** A database blip must not lock every Google
user out of their files. The page-level check still applies when the read succeeds.

---

## 3. The screen

| Element | Value |
| --- | --- |
| Eyebrow | `Almost there` or `Almost there, {firstName}` |
| Heading | `Set a password for your account` |
| Description | `Create a password so you can also sign in to Orindle using your email address.` |
| Fields | New password · Confirm new password, both with show/hide |
| Button | `Set password` |
| Supporting | Strength meter, per-field validation, loading state, error state, success state |

It also restates **which address** the password belongs to. Two accounts open in two tabs
is a real situation, and setting a password on the wrong one is silent and confusing.

Styling comes entirely from the existing auth components — `AuthLayout`, `AuthCard`,
`PasswordInput`, `PasswordStrength`, `SubmitButton`, `Alert`. No new design language.

---

## 4. The action

`src/app/auth/set-password/actions.ts`

```
1. Validate the password (length, match) — server-side, authoritatively
2. Session must exist
3. Rate limit: 10 per 15 minutes per account
4. readOwnSecurity():
     not a Google account      → refuse, point at Settings → Change password
     setup already complete    → redirect onward (stale tab, harmless)
5. supabase.auth.updateUser({ password })
6. Only if step 5 resolved: markPasswordSet(userId)
7. → next (default /dashboard)
```

### Guard 4 is the one that protects existing accounts

Without it, an email/password account could reach this route and set a new password
**without knowing the current one** — a complete account takeover for anyone with a
momentary session. The check is on `signup_provider`, which is written by the trigger and
not by anything a client can influence.

### Guard 6 is the ordering that matters

`markPasswordSet` runs only after `updateUser` resolves successfully. If it ran first, or
in parallel, a failed password update would still discharge the onboarding requirement and
the person would be left with no password and no prompt.

If `markPasswordSet` itself fails, the action returns an error and the requirement
**stays**. That is the safe direction: asked again, rather than let through on an
unrecorded change.

---

## 5. The flag

`public.account_security.password_setup_required`

| Property | Why |
| --- | --- |
| In a table, not `auth.users.user_metadata` | User metadata is user-writable. A flag the client can clear is not a gate |
| Written by a trigger, never by application code at creation | No signup path can forget it, including a future provider |
| Read via RLS-scoped client for the user's own row | No service-key shortcut for a user-facing check |
| Written only by the service role | No client write policy exists (0015 grants SELECT only) |
| Never re-armed | Only the INSERT trigger sets it true; an UPDATE never does |

**Linking Google to an existing email/password account** therefore does not re-arm it,
because linking is not an insert. That is the "do not overwrite an existing password"
requirement, and it holds structurally rather than by a check someone has to remember.

---

## 6. The three situations the route serves

| Situation | Behaviour |
| --- | --- |
| First Google signup | Renders the form. The normal case |
| Browser closed mid-onboarding, person returns | Sign-in succeeds, callback sees the flag, redirects back here. **Resumable by construction** — the state is in the database, not in a client flow |
| Stale bookmark after completion | Redirects onward. Never re-shown |

Also handled: no session → `/login?next=/auth/set-password`, so the visitor lands back
here after signing in rather than on the dashboard with the requirement silently pending.

---

## 7. Verification

`tests/unit/auth-security-flow.test.ts` asserts:

- the flag is read from `account_security`, never from user metadata
- a non-Google account is refused by the action
- `await markPasswordSet(` appears **after** `.updatePassword(` in the action body
- a failed `markPasswordSet` returns an error rather than redirecting
- the page redirects when `password_setup_required` is false
- middleware contains the `needsPasswordSetup` gate

**Not verified:** the live round trip. No Supabase project is configured here, so
`updateUser({ password })` has never run against the real service.

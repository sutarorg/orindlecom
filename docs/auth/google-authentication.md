# Google Authentication

**Provider:** Supabase Auth with the built-in Google OAuth provider
**Scopes:** `openid email profile` — nothing else
**Flow:** PKCE (`exchangeCodeForSession`), started server-side

---

## 1. What the button does

`Continue with Google` appears on `/login` and `/signup`, and only when
`NEXT_PUBLIC_AUTH_PROVIDERS` lists `google`. A button that always fails is worse than no
button, so its presence is a deployment fact rather than a design choice.

| State | Behaviour |
| --- | --- |
| Default | Four-colour Google mark, white button, `Continue with Google` |
| Hover | Border darkens, surface shifts, 1px lift |
| Loading | Spinner, label becomes `Opening Google…`, button disabled |
| Disabled | 60% opacity, no pointer events |
| Error | Sentence below the button, `role="alert"`, button returns to default |

Component: `src/components/auth/social-sign-in.tsx`.

**On the branding:** the mark is drawn as four explicit `<path>` elements in Google's
four colours rather than a single-colour icon. Google's guidelines require the
multicolour mark on a light background, and a monochrome G is the most common violation
of them.

---

## 2. Configuration

### Google Cloud Console

1. **Create a project** (or select one), then **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `Orindle`, support email, developer contact
   - **Scopes:** add only `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`
   - **Do not** add any Google Drive scope. Orindle reads a person's email address and
     name to create an account; it has no business in their Drive
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorised JavaScript origins:** `https://orindle.com`
     (plus `http://localhost:3000` for development)
   - **Authorised redirect URIs:** the **Supabase** callback, not an Orindle URL:

     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```

     Copy this from Supabase's provider page rather than typing it. A typo here produces
     `redirect_uri_mismatch`, which tells you nothing about which part is wrong.
3. Copy the **Client ID** and **Client secret**.

### Supabase dashboard

**Authentication → Providers → Google**

- Enable
- Paste the Client ID and secret
- Copy the **Callback URL** shown there — that value is authoritative

**Authentication → URL Configuration**

| Setting | Value |
| --- | --- |
| Site URL | `https://orindle.com` |
| Redirect URLs | `https://orindle.com/auth/callback`, `http://localhost:3000/auth/callback` |

The redirect allow-list is what stops an attacker turning Supabase's callback into an
open redirect for their own domain. `http://localhost:3000` belongs in development only;
remove it from a production project.

### Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_AUTH_PROVIDERS=google
```

`NEXT_PUBLIC_AUTH_PROVIDERS` is what renders the button. Setting it before the provider
is configured produces a visible, failing button — so set it last.

---

## 3. The signup flow, step by step

```
1. /signup                          Visitor clicks Continue with Google
2. POST /api/auth/oauth/google/start  Server asks Supabase for a consent URL
3. accounts.google.com               Consent screen (openid email profile)
4. GET /auth/callback?code=…         Supabase verifies, sets the session cookie
5. callback route                    Reads account_security for this user id
6.  ├─ password_setup_required=true  → /auth/set-password?next=…
    └─ already set                   → next (default /account)
7. /auth/set-password                Sets a password, updates account_security
8. → /dashboard
```

### Step 5 is the whole design

The callback decides "new or returning" from **`account_security.password_setup_required`**,
a column the client cannot write. It does **not** use:

| Rejected source | Why |
| --- | --- |
| `?isNewUser=true` | Client-supplied. Anyone can add it to a URL |
| `user.created_at` alone | A returning user on a new browser looks identical by timing |
| Absence of a prior session | Always true after a fresh OAuth |
| `user_metadata` | User-writable. A flag the client can set is not a gate |

The row is written by a database trigger (`handle_new_user_security`, migration 0014) on
`auth.users`, so it exists for every account regardless of how it was created — including
accounts created by a future provider nobody has thought of yet.

### No duplicate accounts

Supabase's identity model does this: a second Google sign-in with the same Google
account resolves to the same `auth.users` row and the same identity. Nothing in this
codebase creates a profile, an entitlement or a `account_security` row on sign-in — the
trigger fires on INSERT, and a returning sign-in is not an insert.

**Linking to an existing email/password account** also resolves to one user row. Because
`password_setup_required` is only ever set true at *creation* for a Google-created
account, linking Google to an account that already has a password does **not** re-arm the
Set Password step. That is the "do not overwrite an existing password" requirement, and
it holds structurally rather than by a check.

---

## 4. Failure handling

| Situation | What the person sees |
| --- | --- |
| Cancel at Google | Redirect to `/login?error=oauth_denied` — "Sign-in was cancelled. Nothing changed on your account." Quiet blue note, not a red error |
| Code exchange failed | `/login?error=callback_failed` — "That sign-in link didn't work. Please sign in again." |
| Provider not enabled | The button is not rendered, and the start route returns `provider_disabled` |
| Supabase not configured | `/login?error=not_configured` — the accurate explanation |
| Session exchange succeeded but no user | `session_missing` → back to `/login` |

Every failure is a **redirect with a code**, never a rendered error page: a callback URL
in browser history must not be re-openable into a stale error state. Provider message
strings are never passed through — they leak internals and change without notice.

---

## 5. Security properties

| Property | Mechanism |
| --- | --- |
| CSRF resistance | PKCE; the code verifier lives in an `HttpOnly` cookie |
| No open redirect | `safeRedirectPath()` validates every `next`, parsing rather than prefix-matching so `//evil.com` and `/%2F%2Fevil.com` both fail |
| Start is POST-only | A GET would let any page navigate someone into a sign-in flow with `next` pre-set — the first half of a login-CSRF |
| No cacheable callback | `Cache-Control: no-store` on every callback response (asserted in tests) |
| Minimum scopes | `openid email profile`; Drive is never requested |
| Email verification from the provider | Read from `user.email_confirmed_at`, never from the request |

---

## 6. Testing

`tests/unit/auth-security-flow.test.ts` asserts, among others:

- the callback never references `isNewUser` or `is_new`
- it derives the provider claim from `emailConfirmed`
- an unfinished onboarding redirects to `/auth/set-password` on a returning login
- every callback response carries `no-store`
- the set-password action refuses an account whose provider is not Google
- `markPasswordSet` is called only after `updatePassword` resolves successfully

---

## 7. Not verified in this repository

- **The live OAuth round trip.** No Google client ID or Supabase project is configured
  here, so no real handshake has run. The configuration above is the correct procedure;
  it is not evidence that it has been executed.
- **The consent screen's publishing status.** Google requires verification for certain
  scopes; `openid email profile` normally does not, but the project's status in the
  console must be checked rather than assumed.

# Orindle — Auth Service Contract

The typed boundary between the UI and any auth backend. UI components never
import a provider SDK; they call `getAuthService()` and switch on stable codes.

Source of truth: `src/lib/auth/types.ts` (the contract),
`src/lib/auth/supabase/service.ts` (the implementation),
`src/lib/auth/supabase/errors.ts` (error mapping).

---

## 1. Design rules

1. **Every method returns a result object. Nothing throws.**
   Providers throw on network failure, and an unhandled rejection inside a server
   action surfaces as a Next error page instead of a sentence a person can act on.
   `AuthResult<T>` makes "did it work" an inspectable value.

2. **Failures carry a code for logic and a message for humans.**
   Components switch on `AuthErrorCode`, never on provider message strings —
   those change without notice and leak implementation detail.

3. **The returned user is narrower than the provider's.**
   `AuthUser` has five fields. Provider records carry metadata the frontend has
   no business knowing.

4. **Success means the provider said so.**
   Every success path sits downstream of a resolved provider call with no error.
   There is no optimistic success anywhere in the layer.

---

## 2. Operations

```ts
interface AuthService {
  readonly configured: boolean;
  readonly providers: ReadonlyArray<OAuthProvider>;

  signUp(input: SignUpInput): Promise<AuthResult<{ user: AuthUser; needsVerification: boolean }>>;
  signIn(input: SignInInput): Promise<AuthResult<AuthSession>>;
  signOut(): Promise<AuthResult<null>>;
  resetPassword(input: ResetPasswordInput): Promise<AuthResult<null>>;
  updatePassword(input: UpdatePasswordInput): Promise<AuthResult<null>>;
  resendVerification(input: { email: string; emailRedirectTo: string }): Promise<AuthResult<null>>;
  handleOAuthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackOutcome>;
  getCurrentSession(): Promise<AuthSession | null>;
  startOAuth(provider: OAuthProvider, options: { redirectTo: string; next?: string }): Promise<AuthResult<{ url: string }>>;
}
```

### `signUp`

| Input | Type | Notes |
|---|---|---|
| `fullName` | string | Sent as `user_metadata.full_name` |
| `email` | string | |
| `password` | string | 8–72 chars; 72 is bcrypt's ceiling |
| `emailRedirectTo` | string | Absolute URL back to `/auth/callback?next=…` |

Returns `needsVerification: true` when the provider created the account but
issued no session — i.e. confirmation is required. The UI must then send the
visitor to `/verify-email`, never to `/account`.

**Duplicate detection.** Supabase returns a fake user with an empty `identities`
array instead of an error when the address already exists (to avoid leaking
account existence). The adapter reads that shape and returns
`user_already_exists`, because stranding a returning visitor on a signup form
that can never succeed is the worse failure.

### `signIn`

| Input | Type | Notes |
|---|---|---|
| `email` | string | |
| `password` | string | |
| `remember` | boolean | `false` → session cookie rather than persistent |

### `resetPassword`

Returns `{ ok: true }` for **both** "address exists" and "address doesn't".
Only `rate_limited` and `network` are surfaced; anything else would leak
existence. Implementations must not branch on whether the user was found.

### `updatePassword`

Requires a live session. Callers should check `getCurrentSession()` first so the
UI can render an expired-link state instead of a form that fails on submit.

### `handleOAuthCallback`

Accepts both shapes the provider sends:

```ts
{ code: string }                            // PKCE — OAuth, magic link
{ tokenHash: string, tokenType: string }    // email confirmation, recovery
{ error: string }                           // visitor cancelled at the provider
```

Returns `OAuthCallbackOutcome`:

```ts
| { ok: true; session: AuthSession; confirmation: boolean }
| AuthFailure
```

`confirmation: true` distinguishes "you just confirmed your email" from "you just
signed in", because the two land on different screens.

### `getCurrentSession`

Returns `AuthSession | null`. Null — not a failure — when there is no session, so
callers don't have to treat "signed out" as an error.

The Supabase implementation calls `getUser()`, which revalidates against the auth
server. It does **not** trust the cookie alone. Anything gating access must use
this method, never `getSession()`.

### `startOAuth`

Returns the consent URL rather than redirecting, so the client can render its own
error state when the provider isn't enabled. Rejects providers absent from
`NEXT_PUBLIC_AUTH_PROVIDERS` with `provider_disabled`.

---

## 3. Types

```ts
interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  emailConfirmed: boolean;
  avatarUrl: string | null;
}

interface AuthSession {
  user: AuthUser;
  expiresAt: number | null;   // unix seconds
}

type AuthResult<T> = { ok: true; data: T } | AuthFailure;

interface AuthFailure {
  ok: false;
  code: AuthErrorCode;
  message: string;                              // safe to render
  fieldErrors?: Partial<Record<AuthField, string>>;
  retryAfterSeconds?: number;                   // set on rate_limited
}
```

---

## 4. Error codes

| Code | Cause | Surfaced to visitor? |
|---|---|---|
| `not_configured` | No credentials in the environment | Yes — explicit notice |
| `invalid_credentials` | Wrong email or password | Yes |
| `email_not_confirmed` | Account exists, address unverified | Yes + resend link |
| `user_already_exists` | Duplicate signup | Yes + sign-in link |
| `weak_password` | Provider rejected the password | Yes, on the field |
| `same_password` | Reusing the current password | Yes, on the field |
| `rate_limited` | Email or attempt rate limit (`retryAfterSeconds`) | Yes |
| `link_expired` | Token used, expired, or from another browser | Yes + request another |
| `session_missing` | Callback produced no session | Yes |
| `oauth_denied` | Visitor cancelled at the provider | Yes, **info tone** — not an error |
| `provider_disabled` | OAuth not enabled for this deployment | Yes |
| `network` | Transport failure | Yes |
| `invalid_input` | Server-side validation rejected the payload | Yes, per field |
| `unknown` | Anything unmapped | Yes, generic |

**Mapping order.** `status` is checked before message text. Supabase's free tier
returns 429 for email-rate limits, which is the most common real failure on a
signup form and whose message is otherwise generic.

Unmapped provider errors become `unknown` with a generic message. Raw provider
text is never rendered.

---

## 5. Implementation notes (Supabase)

### Server-only

`src/lib/auth/service.ts` and everything under `src/lib/auth/supabase/` import
`server-only`. The provider SDK never reaches the browser bundle. The browser
talks only to our own route handlers.

### Key handling

| Variable | Exposure | Use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | RLS-scoped key; safe to ship |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | public | Comma list of enabled providers (`google`) |
| `RESEND_API_KEY` | **server only** | Contact form, unrelated to auth |
| service-role key | **must never appear in this repo** | Bypasses RLS |

The service-role key is not read anywhere in this codebase. If a future phase
needs it (e.g. admin operations), it goes in a server-only module that is never
imported from a client boundary.

### One client per request

`createSupabaseServerClient()` builds a client bound to the request's cookie jar.
The SSR helper caches cookie writes on the instance, so reusing one across
requests could drop a session. Do not hoist it into a module-level singleton.

### Cookie writing in Server Components

Server Components cannot mutate cookies; `setAll` catches and ignores that. The
tradeoff is that a refresh triggered inside a Server Component is applied on the
next request rather than immediately. Route handlers and server actions, which
can write cookies, are used for every operation that must persist a session.

### Enabled providers

`NEXT_PUBLIC_AUTH_PROVIDERS` is an explicit statement that the provider is
configured in the Supabase dashboard. The UI renders a social button only for
providers in that list — a button that always fails is worse than no button.

---

## 6. Porting to another backend

The contract exists so this is a contained change. To swap providers:

1. Implement `AuthService` in a new module.
2. Map its errors onto `AuthErrorCode` in a `mapProviderError` equivalent.
3. Point `getAuthService()` at the new factory.

No component changes. The UI consumes only `AuthResult`, `AuthFailure` and
`AuthSession`.

---

## 7. Current deployment state

With no Supabase environment variables set, `configured` is `false` and every
mutation returns:

```
{ ok: false, code: "not_configured", message:
  "Accounts aren't connected on this deployment yet. Nothing was sent and no
   account was created — write to us and we'll let you know the moment sign-in
   opens." }
```

The forms still render and still validate. Submitting explains the situation.
This is the verification path used while no backend exists, and it is the
behaviour a misconfigured production deploy would fall back to — which is why the
message is written for a visitor rather than an operator.

Configured or not, `getCurrentSession()` returns `null`, so `/account` and
`/reset-password` take their signed-out branches.

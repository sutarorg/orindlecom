# Two-Factor Authentication

**Method:** TOTP via Supabase Auth MFA — authenticator apps only
**Mandatory:** No. Never for signup, never for the Free plan, never for existing users
**Recovery codes:** Supabase does not issue them. This document says what to do instead
rather than pretending otherwise.

---

## 1. What it is

A six-digit code from an authenticator app, required as a second factor at sign-in for
accounts that have enrolled one.

Works with Google Authenticator, Microsoft Authenticator, 1Password, Authy, Bitwarden,
Aegis and anything else implementing TOTP (RFC 6238).

**TOTP only.** No SMS, no phone calls, no WhatsApp, no email OTP. No phone number is
collected anywhere in this product, at any point, for any reason.

---

## 2. Enrolment

**Where:** `/dashboard/settings` → Account security → Two-factor authentication

```
1. Click "Enable two-factor authentication"
2. POST /api/account/mfa { action: "enroll" }
   → factor id, otpauth QR, Base32 secret
3. Scan the QR, or expand "Can't scan? Enter the key manually"
4. POST /api/account/mfa { action: "verify", factorId, code }
5. Supabase verifies the code and activates the factor
6. The UI re-reads the factor list and reports it as enabled
```

**Step 6 is not decoration.** The panel reports "enabled" only after the provider's own
factor list contains a verified factor. A 200 from `verify` is not enough: the requirement
is that 2FA is never shown as active before it is.

### The secret

Shown **once**, in the enrol response. Never stored in a table, never logged, never
included in an error. It lives in React state in the enrolment dialog and is gone when
the dialog closes.

If someone closes the dialog mid-enrolment, an unverified factor is left behind. It grants
nothing — Supabase only requires *verified* factors — and enrolling again works. It is
listed in the factor array with `status: "unverified"`.

---

## 3. Signing in with a factor enrolled

```
1. Email + password (or Google)
2. Supabase returns a session at AAL1
3. signInAction calls mfaState()
4. nextLevel === "aal2"  →  redirect /auth/mfa?next=…
5. Six-digit code → verifyTotp → Supabase upgrades the session to AAL2
6. The action re-reads the level and confirms it is aal2 before redirecting
```

**Step 4 is the bypass guard.** Sending someone straight to `/dashboard` after a correct
password would be a complete MFA bypass with extra steps — the session would still be
AAL1 and every server-side check would still have to catch it. The action redirects
instead, and the destination is only reached after step 6 confirms the upgrade.

**Step 6 is the second guard.** `verify()` returning without an error is not the same as
the session having been upgraded. The action reads `getAuthenticatorAssuranceLevel()`
again and refuses to continue if the level did not change.

### The challenge screen

`/auth/mfa` redirects away from every state except "one factor in, two required":

| State | Destination |
| --- | --- |
| No session | `/login?next=…` |
| No enrolled factor | onwards — nothing to challenge |
| Already AAL2 | onwards — nothing left to prove |
| Google account owing a password | `/auth/set-password` first |

That third row is what stops the page becoming a soft lock: after a successful challenge
the session is AAL2, so a back-button return skips straight through.

The input is **one field**, not six boxes: `inputMode="numeric"`, `autoComplete="one-time-code"`,
and it submits itself at six digits. Six separate inputs are a known screen-reader
annoyance and force five extra focus moves on desktop.

---

## 4. Managing factors

### Adding a backup device

Repeat the enrolment flow. Supabase supports multiple TOTP factors, and a second verified
factor is the recommended backup — it is the closest available substitute for recovery
codes, and it is what the settings panel suggests.

Either factor satisfies the challenge, so a lost phone with a second device enrolled is
an inconvenience rather than a lockout.

### Removing a factor

`DELETE /api/account/mfa { factorId, password }`

**Reauthentication is required, and it takes two steps, deliberately:**

1. The password is checked by attempting a real sign-in with the session's own address —
   Supabase validates the credential, so this is not a formality.
2. That sign-in *replaces* the session with a fresh **AAL1** one. Removing a factor at
   AAL1 would mean a stolen password alone could strip the second factor, so removal
   completes only after the person passes a challenge in the new session.

The response says so explicitly (`reauthRequired: true`) and the dialog offers a button
straight to `/auth/mfa`. Without that, the flow would look like a failure.

**Passwordless accounts** (Google-created, no password set) prove themselves with AAL2
instead. Neither path can be satisfied by possessing the session alone.

---

## 5. Recovery, honestly

**Supabase's MFA API does not issue recovery codes.** This product does not claim it
does, does not render a fake "download your codes" screen, and returns
`recoveryCodes: false` from the API so no future UI can imply otherwise.

What actually exists:

| Situation | What to do |
| --- | --- |
| Lost the phone, second factor enrolled | Use the other authenticator app |
| Lost the only device | `/contact` → subject **Product support**. Proof of account ownership is required — this is a human process, and it is the only manual step in the whole security system |
| Authenticator app deleted, account accessible elsewhere | Remove the factor from Settings on a session that is already AAL2 |
| Locked out at the challenge screen | "Sign out instead" on `/auth/mfa` — the account is not locked, and sign-in can be retried |

**Why there is no self-service bypass:** any mechanism that lets someone skip the second
factor without the second factor is a mechanism an attacker can use. A support process
with identity checks is slower and worse, and it is the honest option.

This is the one place where a human is in the loop. The requirements forbid a dashboard
for *routine* enforcement; a lost-device recovery request is not routine, and there is no
automatic way to distinguish "I lost my phone" from "I stole this password".

---

## 6. What 2FA does not do

| Claim | Reality |
| --- | --- |
| "Protects your files from everyone" | It protects **sign-in**. An already-open session stays open |
| "Required for the Free plan" | No. Nothing about the Free plan depends on it |
| "Recovery codes included" | No. See §5 |
| "Blocks a stolen password" | Yes, for enrolled accounts — that is exactly its job |
| "Works with SMS" | No SMS path exists in this product |

Sessions already signed in are not revoked when a factor is added. Someone who enrols 2FA
because they suspect a compromise should also change their password, which does revoke
other sessions in Supabase.

---

## 7. Verification

```bash
npx vitest run tests/unit/auth-security-flow.test.ts
```

Asserted:

- no `SMS` or `phone_number` token in the MFA modules
- no recovery-code claim in the API or the panel
- a factor is reported enabled only from the provider's factor list
- removal requires a password or an AAL2 session
- the challenge action confirms AAL2 before redirecting
- a user with no factor is sent onward, not trapped
- the TOTP secret is never inserted or updated in any table

**Not verified:** the live enrolment round trip. No Supabase project is configured in
this repository, so `mfa.enroll()` has never run against the real service. The logic is
tested; the integration is not.

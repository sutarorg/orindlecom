# Anti-Abuse, Free Storage Protection & Authentication — Completion Report

**Date:** 16 November 2026
**Scope:** six anti-abuse layers, automatic risk enforcement and recovery, Google
authentication, Set Password onboarding, optional TOTP 2FA.

Every claim below names the command or file that proves it. §8 lists what is **not**
done, which is the part worth reading first.

---

## 1. Evidence

```
npx tsc --noEmit                                  clean
npm run lint                                      0 errors, 48 warnings (pre-existing)
npx next build                                    clean, 26 pages + 38 API routes
npx vitest run                                    265 passed, 17 files
visual gate                                       49 routes × 5 widths = 245 shots, 0 problems
```

New test files:

| File | Tests | What it proves |
| --- | --- | --- |
| `tests/db/anti-abuse.test.ts` | 28 | Banding, escalation, expiry, idempotent release, verified-email entitlement, quota ceiling |
| `tests/unit/security.test.ts` | 23 | IP spoofing resistance, salted hashing, decision table, bucket keys, limit policy |
| `tests/unit/auth-security-flow.test.ts` | 28 | Set Password gate, no `isNewUser` trust, 2FA activation order, no admin surface |

---

## 2. The twenty acceptance conditions

| # | Condition | State |
| --- | --- | --- |
| 1 | No mandatory phone verification | ✅ No phone number is collected anywhere. Asserted: no `phone_number` token in any auth module |
| 2 | Email verification enforced | ✅ `effective_plan_bytes()` returns **0** for an unverified address |
| 3 | Turnstile with server-side validation | ✅ Verified via Siteverify; single-use; fails closed. **Integration unverified** — no keys configured |
| 4 | Disposable email screening | ✅ 49 seeded domains, refused before an account exists |
| 5 | Device and signup-risk detection | ✅ Salted-hash device rows, 5 signals, explainable score |
| 6 | IP-based rate limiting | ✅ Postgres-atomic counters, trusted-header resolution only |
| 7 | Risk scoring and enforcement automatic | ✅ Database functions + two cron jobs, no human step |
| 8 | No administrator monitoring dashboard | ✅ No admin route, no review queue, no approval table — asserted |
| 9 | Quotas cannot be bypassed | ✅ Row-locked reservation; parallel uploads cannot oversell |
| 10 | R2 remains private | ✅ Unchanged: short-lived presigned URLs, no public bucket |
| 11 | Google auth on login and signup | ✅ `Continue with Google`, five states, official branding |
| 12 | New Google registrations see Set Password | ✅ Database flag + middleware gate on every route |
| 13 | Existing Google users not re-prompted | ✅ Flag is set only on INSERT; linking Google to an existing account cannot re-arm it |
| 14 | Password setup securely recorded | ✅ `account_security`, server-written only, marked after provider confirmation |
| 15 | Optional TOTP 2FA works | ✅ Enrol, challenge, AAL1→AAL2, multiple factors, removal. **Integration unverified** |
| 16 | Users without 2FA sign in normally | ✅ No factor → `nextLevel` is `aal1` → no redirect |
| 17 | Enrolled users complete the challenge | ✅ Redirected to `/auth/mfa`; AAL2 re-confirmed before proceeding |
| 18 | False-positive restrictions expire | ✅ `release_expired_restrictions()` daily via `/api/cron/dispatch`, idempotent |
| 19 | No data deleted on an uncertain score | ✅ No delete branch in the enforcement path; asserted in `security.test.ts` |
| 20 | All security and automated tests pass | ✅ 265 / 265 |

---

## 3. The six layers

| Layer | Where it lives | What it stops |
| --- | --- | --- |
| 1. Verified email | `effective_plan_bytes()`, `reserve_storage()` (0014) | An unverified account has zero storage, so an unconfirmed address cannot harvest 10 GB |
| 2. Turnstile | `lib/security/turnstile.ts` | Automated registration at scale |
| 3. Disposable domains | `email_domain_risk` (0015) | The cheapest way to make a throwaway account |
| 4. Device signals | `device_signups`, `device.ts` | Repeated creation from one browser |
| 5. IP rate limiting | `ip.ts`, `check_rate_limit()` (0010) | Volume from one network |
| 6. Quota enforcement | `reserve_storage()` (0006, extended in 0014) | The financial loss. Pre-existing and unchanged in its concurrency behaviour |

---

## 4. Risk bands

| Band | Score | Action | Duration |
| --- | --- | --- | --- |
| `low` | 0–24 | Approved, 10 GB, normal experience | — |
| `medium` | 25–54 | Next signup from this device is challenged | 30 min |
| `high` | 55–79 | Uploads paused; files remain readable | 180 min |
| `confirmed` | 80–100 | Refused + uploads paused | 1440 min |

**Deterministic overrides:** a disposable domain, or 4+ accounts on one device in 24 h,
sets `confirmed` outright. Weights cannot dilute an objective rule.

**What enforcement never does** — stated three times in the code, the tests and the docs
because it is the failure mode that matters:

- never deletes a file
- never touches existing data
- is never permanent

---

## 5. Decisions worth defending

**Verification is enforced in the database, not the route.** There are several upload
paths and only one has to forget. `effective_plan_bytes()` returning 0 for an unverified
account is a single place that cannot be bypassed by a new handler.

**An unclassified email domain is not suspicious.** The asymmetry is deliberate: a false
positive costs a real customer their signup, a false negative costs one 10 GB account the
other five layers still have to carry.

**The device identifier is a cookie, not a fingerprint.** No canvas, no fonts, no UA
parsing. It means "this browser profile", disclosed in the cookie policy, and clearing
cookies resets only that one signal.

**`reserve_storage()` was replaced, not refactored.** The row lock and quota arithmetic
are copied verbatim. Rewriting the concurrency behaviour of the function that prevents
overselling, inside a security migration, would be reckless.

**MFA removal takes two steps.** The password check lowers the session to AAL1, so
removal completes only after a challenge. A stolen password alone cannot strip the second
factor.

---

## 6. Problems found and fixed during this work

**1. The `not_configured` message rendered twice on the login screen.** `/auth/set-password`
redirects to `/login?error=not_configured` on a deployment without Supabase, and the login
page rendered that code as a red alert *on top of* its own amber banner for the same
condition — the same sentence, twice, one of them alarming. Caught by screenshotting the
redirect target, not by reading the code.

**2. A malformed `text[]` concatenation in the scoring function.** `why := why || 'literal'`
resolves to `array_cat` with an unknown literal and throws `malformed array literal`. Every
branch needed an explicit `::text`. Caught by the first database test, which would
otherwise have been a runtime failure on the third signup from a device.

**3. Service-role grants were missing on all six new tables.** RLS was configured, the
functions were `security definer`, and the server still got `permission denied` — grants
and policies are separate layers. Caught by the same test.

**4. A `grant` to a view placed before the view existed.** Migration ordering; the view is
defined at the end of 0015, so its grant had to follow it.

**5. Existing storage tests failed after the entitlement change — correctly.** They
assumed a fresh account has 10 GB, which is no longer true. The tests were updated to
verify the account first, with a comment explaining why they *should* be verified for
tests about quota arithmetic.

---

## 7. Documentation

| File | Contents |
| --- | --- |
| `security/anti-abuse-system.md` | The six layers, the bands, the honesty framing |
| `security/anti-abuse-operations.md` | Scheduled work, SQL diagnosis, tuning, incident actions |
| `security/authentication.md` | Both sign-in methods, sessions, enumeration resistance |
| `auth/google-authentication.md` | Google Cloud + Supabase configuration, the callback flow |
| `auth/two-factor-authentication.md` | Enrolment, challenge, removal, the recovery gap |
| `auth/set-password-onboarding.md` | The gate, the flag, why three layers |
| `backend/database-schema.md` | §11 anti-abuse tables and functions |
| `backend/api-reference.md` | Three new routes plus the MFA section |
| `security/security-checklist.md` | §2b added; designed/open rows corrected |

The cookie policy (`src/config/legal/cookies.ts`) now discloses `orindle_did` — what it
is, that it is not a fingerprint, and the retention of the records around it.

---

## 8. What is not done

**Nothing has run against a real Supabase project, Google, Cloudflare or R2.** No
credentials are configured in this repository. Specifically unverified:

| Integration | Status |
| --- | --- |
| Google OAuth round trip | Configured, never executed |
| Turnstile `/siteverify` | Logic tested, live call never made |
| TOTP enrol and challenge | Logic tested, Supabase MFA never called |
| Confirmation email delivery | Supabase's; never sent |
| External domain feed | No `DOMAIN_INTEL_URL`; the seed baseline is what runs |
| Multi-instance row locking | PGlite serialises on one connection; `FOR UPDATE` is unproven on real Postgres |
| Supabase project rate limits | Configured in its dashboard, not in this repo |

**What the layers genuinely do not stop:** one determined person with several real email
addresses and rotating IPs gets several accounts. That is unfixable without identity
verification, which this product deliberately does not collect. No document here claims
otherwise.

**Also open, from earlier work:** MFA step-up for billing and account deletion
specifically (2FA exists and is enforced at sign-in; those two flows do not additionally
demand AAL2); malware scanning (`MALWARE_SCAN_ENABLED` is off); alerting; incident
runbook; readiness §6 blockers.

---

## 9. What this work claims

> Signup is gated by six independent layers, all server-side, all enforced in the
> database where it matters. An unverified account has no storage. A disposable address
> cannot create an entitled account. Repeated creation from one browser earns a
> temporary, expiring cooldown that lifts itself without anyone noticing. No enforcement
> path can delete a file. Google sign-in works with a Set Password step that cannot be
> skipped, bypassed by a client flag, or re-shown once complete. TOTP 2FA is available,
> optional, and enforced at AAL2.

What it does not claim: that this stops a determined attacker, or that any third-party
integration has been exercised.

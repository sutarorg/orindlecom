# Anti-Abuse System

**What this is:** six layered protections that make repeated free-plan exploitation
expensive, plus the automatic enforcement and automatic recovery around them.

**What this is not:** a guarantee of one account per human. That requires identity
verification this product deliberately does not collect. Any document claiming
otherwise would be lying.

---

## 1. The honest framing

The Free plan grants 10 GB. Creating a second account is free, takes one disposable
email address, and yields another 10 GB. Every product with a free tier has this
problem, and none of them solve it — they make it expensive enough that it stops being
the easy path.

**What is actually enforceable here:**

| Claim | True? |
| --- | --- |
| "Only one account per person is possible" | **No.** No system can promise this without identity verification |
| "A disposable address cannot create an entitled account" | **Yes** — enforced in the database, before an account is usable |
| "Automated scripts are substantially slowed" | **Yes** — rate limits, challenges and velocity signals |
| "Repeated exploitation from one browser accrues escalating friction" | **Yes** — device signals and expiring cooldowns |
| "An abuser is permanently banned" | **No.** Nothing here is permanent, by design |

The last row is not a weakness to apologise for. Consider what the alternative means
for a real customer who shares a tablet with their family, uses a university network,
or has an unfamiliar business domain. A system that permanently bans on a heuristic will
eventually ban them, and there is nobody reading a queue to undo it.

---

## 2. Layer 1 — verified email is a precondition, not a step

**Enforced in `effective_plan_bytes()` and `reserve_storage()` (migration 0014).**

An unverified account's allowance is **zero bytes** — not a smaller plan, no allowance
at all. This is deliberately in the database rather than in application code, because
there are several upload paths and only one of them has to forget.

```sql
-- effective_plan_bytes, 0014
when not coalesce((select u.email_confirmed_at is not null
                    from auth.users u where u.id = p_owner), false)
  then 0
```

`reserve_storage()` additionally raises `email_unverified` before it reaches the quota
arithmetic, so the failure is a specific message rather than "you're out of space".

**Why the database:** a quota bypass found by changing one `if` in a route handler is a
bug. One that requires changing a function every upload path calls through is a design.

**Verification links** are Supabase's, with its own expiry. Resend is rate-limited to
3 per hour per address (`LIMITS.verificationResend`).

**Google signups** carry `email_confirmed_at` from the provider's assertion. That is read
from the auth server's user record — `user.email_confirmed_at` — never from a request
field. A client cannot assert its own verification.

---

## 3. Layer 2 — Cloudflare Turnstile, verified server-side

**Module:** `src/lib/security/turnstile.ts` · **Widget:** `src/components/security/turnstile-widget.tsx`

| Property | Implementation |
| --- | --- |
| Server-side verification | POST to `challenges.cloudflare.com/turnstile/v0/siteverify` with the secret |
| Single use | Cloudflare's `timeout-or-duplicate` **plus** a `turnstile_tokens` row, so a lost response cannot allow a replay |
| Expiry | Cloudflare's own token lifetime; an expired token is refused with distinct copy |
| Fresh challenge on retry | The form bumps a `resetKey`, which calls `turnstile.reset()` — a used token is never resubmitted |
| Not configured | Returns `skipped`, and every caller treats `skipped` as *no challenge available*, never as *passed* |
| Cloudflare unreachable | Fails **closed** with `verification_error`. Failing open would let an attacker disable CAPTCHA by cutting our egress |

**The failure that would matter most** is treating `skipped` as success. The type union
makes that a compile error rather than a review catch:

```ts
type TurnstileOutcome =
  | { status: "passed" }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; code: TurnstileErrorCode; message: string };
```

---

## 4. Layer 3 — disposable domain screening

**Table:** `public.email_domain_risk` · **Seeded in:** migration 0015

Three classifications, and the third one is the important one:

| Classification | Meaning | Effect on a signup |
| --- | --- | --- |
| `safe` | A known legitimate provider | No signal |
| `disposable` | A known throwaway service | **Refused**, band set to `confirmed` |
| `risky` | Marked by a feed, not definitively disposable | +25 points |
| *(absent)* | Never seen | **No signal** |

**An unclassified domain is not suspicious.** That asymmetry is the whole safety
argument. A false positive costs a real customer their signup — someone with a small
business on their own domain, or on a provider we have not heard of. A false negative
costs one 10 GB account that the other five layers still have to carry. The asymmetry is
the right way round.

**Seeded safe list** includes Gmail, Outlook, iCloud, Yahoo, Proton, Tuta, Zoho, Fastmail,
GMX, Yandex and the common Chinese and Korean providers — named explicitly so no future
heuristic can catch them by accident.

**Refresh:** `src/app/api/cron/domain-intel/route.ts`, daily. A feed must pass three
gates before it is applied:

1. At least 100 entries. A feed that collapses to 50 is broken, not new intelligence.
2. It may never mark a protected domain disposable — that list is in the route, and a
   feed that violates it has those entries stripped rather than the whole feed applied.
3. If anything fails, the existing table is left untouched. That *is* the last-known-good
   behaviour: the curated baseline is never deleted, so detection degrades to
   "less complete", never to "off".

---

## 5. Layer 4 — device signals, honestly bounded

**Table:** `public.device_signups` · **Cookie:** `orindle_did` (`HttpOnly`, `Secure`, `SameSite=Lax`, 1 year)

A random 128-bit value the browser generates once. It means "this browser profile has
created an account before" — nothing about the person using it.

**What it is not:** a fingerprint. No canvas hashing, no font enumeration, no
fingerprintjs, no cross-site tracking of any kind. A device identifier in a first-party
cookie is a signal we disclose and can be cleared; a fingerprint is one that follows
someone around.

**The shared-device rule is encoded in the scoring, not just in a comment:**

```sql
-- Three accounts on one device in a week is medium, not confirmed.
if v_device_week > 1 then
  s := s + least((v_device_week - 1) * pol.weight_device_week, 3 * pol.weight_device_week);
end if;
```

A family tablet with three teenagers lands in **medium** — a challenge and a short
signup cooldown — not in **confirmed**. Four accounts on one device *in a day* is
`confirmed`, because that is not a pattern legitimate use produces at any household size.

**Retention:** 30 days (`RETENTION.deviceSignups`), swept by the maintenance job.

**Disclosure:** the privacy policy's cookies section names this cookie, what it stores,
why, and how long.

---

## 6. Layer 5 — IP rate limiting that survives spoofing and shared networks

**Module:** `src/lib/security/ip.ts` · **Counter:** `public.check_rate_limit()` (0010)

**The spoofing problem.** `X-Forwarded-For` is a list the client can prepend to. Taking
its first entry — the common implementation — hands the attacker control of their own
rate-limit bucket. Verification here reads, in order:

1. `cf-connecting-ip` — set by Cloudflare's edge
2. `x-vercel-forwarded-for` — Vercel's own copy, **last** entry
3. `x-real-ip`
4. plain `x-forwarded-for`'s **last** entry, and **only** when `VERCEL` or `CF_PAGES` is set

If none yields a valid address the result is `null`, and callers treat that as *no IP
signal* rather than as an empty string that lumps every request on earth together.

**Shared networks.** The bucket is per address, and the limits are set above what a
real shared network produces:

| Flow | Limit |
| --- | --- |
| Signup | 5 / hour |
| Login | 10 / 5 min |
| Password reset | 3 / hour |
| Verification resend | 3 / hour |
| CAPTCHA attempt | 10 / 5 min |

An office of 30 people signing in within five minutes will trip the login limit at 10.
That is a real trade: the alternative is a flood of credential-stuffing attempts from
one host going unthrottled. It matters that **the bucket is per address, not per
account** — the cooldown expires in five minutes, no account is locked, and the person
can complete their sign-in afterwards. It is a delay, not a denial.

**Not in memory.** The counter is a row in Postgres with `INSERT … ON CONFLICT DO
UPDATE`, which is atomic per row. An in-memory counter would give every warm serverless
instance its own full allowance.

---

## 7. Layer 6 — quota enforcement (the one that costs money)

This layer already existed and is the most important one. Full detail in
`docs/backend/storage-architecture.md`; the anti-abuse additions are two checks inside
`reserve_storage()`:

```sql
-- 0014 additions to reserve_storage, at the top, before the row lock
select (u.email_confirmed_at is not null) into v_verified
  from auth.users u where u.id = p_owner;
if v_verified is null or v_verified = false then
  raise exception 'email_unverified';
end if;

if exists (select 1 from public.account_restrictions r
            where r.user_id = p_owner and r.kind = 'upload_block'
              and r.released_at is null and r.expires_at > now()) then
  raise exception 'abuse_restricted';
end if;
```

**The row lock, the arithmetic and the concurrency guarantee were copied verbatim.**
Rewriting the one function that prevents overselling, inside a security migration,
would be reckless. `tests/db/storage.test.ts` still proves parallel reservations cannot
exceed a plan.

---

## 8. Risk bands and what each one does

**Policy lives in `public.abuse_policy`** — one row, thresholds and weights, editable
only by migration or by the service role. Not constants in TypeScript, because a
threshold change should carry a review and a history.

| Band | Score | Consequence | Duration |
| --- | --- | --- | --- |
| `low` | 0–24 | Nothing. Approved, 10 GB, normal experience | — |
| `medium` | 25–54 | `signup_block`: the next registration from this device is challenged | 30 min |
| `high` | 55–79 | `upload_block`: uploads paused, files still readable and downloadable | 180 min |
| `confirmed` | 80–100 | Refused, plus `upload_block` | 1440 min |

**Deterministic overrides** set the band outright, because they are patterns rather than
weights:

- a disposable domain → `confirmed`
- 4+ distinct accounts on one device in 24h → `confirmed`

### What enforcement never does

- **It never deletes a file.** There is no delete branch in the enforcement path, and the
  decision type has no `delete` variant (asserted in `tests/unit/security.test.ts`).
- **It never touches existing data.** `upload_block` stops *new* consumption. Every
  existing file stays listed, downloadable and shareable.
- **It is never permanent.** `account_restrictions` has `expires_at` and no
  `permanent`/`banned` column (asserted in `tests/db/anti-abuse.test.ts`).

---

## 9. Automatic recovery

Nothing here needs a human, which is the point — there is no dashboard to watch.

| Mechanism | How it works |
| --- | --- |
| Expiring restrictions | `release_expired_restrictions()`, called every 10 minutes by `/api/cron/abuse-maintenance` |
| Release is auditable | Each release writes a `restriction_released` row, so recovery is as traceable as enforcement |
| Risk decay | Signals are *counted over a window*, not accumulated in a stored score. A device that behaves for 30 days has no signals, which is decay by construction and cannot be miscalculated |
| Idempotency | Release is guarded by `released_at is null`; running it twice is a no-op |
| Appeal route | `/contact` → subject **Product support**. A person can always reach a human, and that is the exception path, not the default one. No separate appeal form: a second inbox would be a second thing to forget to read |

---

## 10. Why there is no anti-abuse monitoring surface

**Orindle does have a platform administration console now** (see `docs/admin/`), and that
changes the wording of this section. It does not change the rule.

What exists at `/admin`: users, billing, storage, teams, support, analytics, logs and
settings. What does **not** exist, and is asserted by `tests/unit/admin-security.test.ts`:

- no `/admin/abuse`, `/admin/risk`, `/admin/review-queue`, `/admin/devices`
- no page or API that reads `risk_events`, `device_signups`, `account_restrictions`,
  `abuse_policy`, `email_domain_risk` or `turnstile_tokens`
- no reference to a device hash or an IP hash anywhere in the admin surface
- no approval or review table in any migration

The reasons the surface stays absent, even now that there is a console to put it in:

- **A queue makes enforcement someone's job.** Anything that requires review to *stop*
  exploitation will stop being reviewed, and the protection lapses silently.
- **A dashboard invites the wrong decision.** The person reading it has a customer on
  one side and a policy on the other. The policy is the one that should decide.
- **These decisions are reproducible without one.** The evidence is in `risk_events`,
  the thresholds are in `abuse_policy`, and the scoring is a database function. An
  engineer with database access can reconstruct any decision exactly — see
  `docs/security/anti-abuse-operations.md` §4 for the queries.

What exists instead: structured rows, readable with SQL, retained 90 days, never exposed
through any API, and never shown to the person they describe.

---

## 11. What is not protected

Honest gaps, in the order they would matter:

| Gap | Consequence |
| --- | --- |
| **No identity verification** | One determined person with several real email addresses gets several accounts. This is unfixable without collecting identity, which the product does not do |
| **No payment-method check** | A card used on one account does not block another. Payment data is not stored in this product |
| **A determined attacker can rotate IPs** | Residential proxy pools defeat IP rate limiting entirely. Device signals and email verification are what remain |
| **No malware scanning** | `MALWARE_SCAN_ENABLED` is off; the hook exists and quarantines when enabled. This is a file-safety gap, not an anti-abuse one, but it is the same abuse surface |
| **Device identifier is clearable** | Clearing cookies resets the device signal. It does not reset the IP bucket or the email verification requirement |
| **Turnstile is unverified in production** | No Cloudflare keys are configured in this repository, so the challenge path has never run against the live Siteverify endpoint. Its logic is unit-tested; its integration is not |

---

## 12. Verification

```bash
npx vitest run tests/db/anti-abuse.test.ts       # 28 database tests
npx vitest run tests/unit/security.test.ts       # 23 primitive tests
npx vitest run tests/unit/auth-security-flow.test.ts  # 28 flow invariants
```

The database suite is the one that matters: it runs the real migrations against a real
Postgres engine (PGlite) and proves the guarantees rather than describing them.

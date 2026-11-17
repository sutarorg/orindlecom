# Deployment Guide

**Target:** Vercel (application) + Supabase (Postgres + auth) + Cloudflare R2
(storage) + Razorpay (payments) + Resend (email).

---

## 1. Prerequisites

- Node 22 (the version this repo has been verified against)
- A Supabase project (dev and production, separate)
- An R2 bucket per environment
- A Razorpay account, with **capability confirmed** — see `payment-lifecycle.md` §9
- A Resend account with a **verified sending domain** (otherwise email only reaches the
  account owner)

---

## 2. Local setup

```bash
npm install                       # ~9 runtime deps; lockfile is committed
cp .env.example .env.local        # fill in what you need; nothing is required to render
npm run dev                       # http://localhost:3000
```

Without credentials the site renders fully and every feature explains that it is not
connected. That is intended: the frontend is reviewable with an empty environment.

Verification before pushing:

```bash
npx tsc --noEmit
npx next build
```

`npm run lint` is **broken** — `next lint` was removed in Next 16. Use `npx eslint .`
once a flat config exists; until then lint is a recorded gap, not a passing gate.

---

## 3. Build and deploy

```bash
npx next build       # must be clean before any deploy
```

Vercel builds from the branch; preview deployments point at the **dev** Supabase
project and test payment keys. Environment values are set per environment in the
Vercel dashboard, never in the repository.

### 3.1 First production deploy checklist

1. Production Supabase project created; all twenty-four migrations applied in filename
   order (`supabase db push`, or the reviewed SQL — `database-schema.md` §11). The
   order is load-bearing: 0001 defines the helper functions every later policy uses.
2. RLS verified: enable and policies applied table by table in the same migration.
3. Production R2 bucket created; **versioning on**; CORS configured for presigned
   PUT/GET from the site origin only.
4. Razorpay live keys set; webhook endpoint registered with the live secret.
5. Resend domain verified; `RESEND_FROM_ADDRESS` points at it.
6. `NEXT_PUBLIC_SITE_URL` is the production origin (metadata, sitemap, canonical URLs).
7. `CRON_SECRET` set. There are seven jobs: six scheduled endpoints in `vercel.json`
   plus `/api/cron/dispatch`, which invokes the three frequency-sensitive jobs from
   one daily entry. They register themselves on deploy, but confirm on the Vercel
   dashboard that all seven appear, because a job that fails to register looks
   identical to one that runs.

   **Hobby and Pro both work; the cadence differs.** Vercel's free plan allows any
   number of cron jobs but only once per day, so three jobs that want a ten- or
   fifteen-minute cadence run once daily behind the dispatcher instead. Nothing is
   lost in correctness — quota no longer depends on a sweep being timely (migration
   `0020` reclaims lapsed reservations inline) — but a lapsed abuse cooldown is
   released within a day rather than within minutes. On Pro, restore the real
   cadences in `vercel.json` and drop the dispatcher entry; §13 of
   `docs/backend/api-reference.md` lists both schedules.

   A schedule that runs more than once per day **fails the deploy**, not the job.
   `tests/unit/deployment-config.test.ts` refuses one in CI for that reason.
8. Health endpoint reports no `mismatch`. It reads configuration presence only and
   never returns a value.
9. Restore rehearsal completed (`backup-and-recovery.md` §6).

---

## 4. CORS and R2

Presigned uploads are cross-origin by nature, so the bucket's CORS policy must allow:

- `PUT` and `GET` from the site origin
- `Content-Type` and `If-None-Match` headers
- `ETag` exposed, because multipart completion needs the part ETags

A CORS misconfiguration produces an upload that fails with no useful console message.
It is the single most common cause of a "broken" upload and the first thing to check.

---

## 5. Cron

Vercel Cron hits the routes in `api-reference.md` §13. Each requires
`Authorization: Bearer ${CRON_SECRET}`; anything else receives **404**, so the routes
are not discoverable.

| Job | Schedule (UTC) | Why that cadence |
| --- | --- | --- |
| `trash-cleanup` | `0 * * * *` | Retention is measured in days; hourly is ample and bounded |
| `expire-reservations` | `*/15 * * * *` | A stuck reservation blocks a customer's quota |
| `subscription-sweep` | `0 6 * * *` | Downgrades and warnings; off-peak for email |
| `reconcile-storage` | `0 3 * * *` | Nightly, before anyone is looking |
| `orphan-sweep` | `30 3 * * *` | After reconcile, so its output is available |
| `email-retry` | `*/15 * * * *` | Bounded backoff |

All jobs are idempotent and safe to overlap, because Vercel may invoke them
concurrently. **No job uses an in-memory timer**; a timer dies with the function.

---

## 6. Post-deploy verification

Run the visual gate against the deployment, not against localhost:

```bash
python3 scripts/visual-gate/prep-chromium.py
LD_LIBRARY_PATH=$PWD/.verify/lib node scripts/visual-gate/capture.mjs \
  --base https://<deployment-host> --out /tmp/shots
```

It must report `0 with problems` across all 49 routes × 5 widths. This catches
environment-specific breakage — a missing env var that changes rendering, a canonical
URL pointing at localhost, a cookie that does not survive the real domain.

Then confirm by hand:

- [ ] Sign up, receive verification, sign in, sign out
- [ ] Upload a small file and a large multipart file; both appear and download
- [ ] Quota figure increases by the real byte count
- [ ] Move a file to trash, restore it; purge it and confirm the object is gone
- [ ] Share with a second account; the grantee sees it, a third account does not
- [ ] Attempt a cross-tenant read directly against the API; it must 404
- [ ] Billing page states the true connection state; checkout does not appear to succeed
- [ ] Contact form returns `delivered: true` only when the mail actually arrives
- [ ] Health reports no `mismatch`

---

## 7. Rollback

- **Application:** revert to the previous Vercel deployment. This is instant and always
  safe.
- **Database:** migrations are forward-only. A rollback is a **new forward migration**
  that undoes the previous one, reviewed like any other. Dropping a column to "roll
  back" is how data disappears.
- **Objects:** R2 versioning makes an object-level rollback possible without a bucket
  restore.

Deploy order when both change: **migration first, then application**, and every
migration must be compatible with the previous release (additive columns, no renames
in the same step) so a rollback of the application still runs.

---

## 8. Operational gaps, stated

| Item | State |
| --- | --- |
| Lint | broken in Next 16; no flat ESLint config yet |
| Automated tests in CI | no runner installed yet |
| Security headers | **not set anywhere today** |
| Alerting | not configured |
| Incident runbook | not written |
| Preview→dev-project wiring | must be verified per project; previews that touch production data are a defect |

These are listed so a completion report cannot describe the deployment as fully
hardened while they remain open.

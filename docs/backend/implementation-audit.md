# Implementation Audit

**Status:** Living document. Written before any backend implementation code, per the
PROMPT 6 mandate. Every claim below was verified against the repository at commit
`e4f6855`, not recalled from an earlier phase.

**Purpose.** Establish exactly what exists today, what is simulated, what is
missing, and in what order it gets built — so the implementation that follows has
a contract to satisfy rather than a blank page.

---

## 1. What this document is not

It is not a plan for a new frontend. The five previous phases produced a complete,
verified interface. The job now is to **connect** it. Any change to visual design,
spacing, typography or component structure is out of scope and would need a stated
reason.

---

## 2. Inventory: what actually exists

### 2.1 Runtime and dependencies

| Item | Value |
| --- | --- |
| Next.js | 16.4.6 (App Router, Turbopack build) |
| React | 19.3.1 |
| TypeScript | 5.9.3, `strict` |
| Tailwind | 4.3.5 |
| Supabase client | `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7 |
| Headless browser | `@sparticuz/chromium` 153 + `puppeteer-core` 25 (dev-only) |
| Test runner | **none installed** |
| Lint | `next lint` script is **invalid in Next 16** and has never been run |

Runtime dependencies currently number nine. There is no ORM, no validation library,
no job runner, no email SDK, no R2 SDK, no payment SDK. Each of those is a decision
made in `backend-architecture.md`, not an assumption here.

### 2.2 Codebase shape

192 TypeScript files under `src/`. Relevant seams:

| Path | Role | State |
| --- | --- | --- |
| `src/lib/drive/repository.ts` | `DriveRepository` — 30 methods, the personal-dashboard contract | Complete interface, **no live implementation** |
| `src/lib/drive/empty-repository.ts` | No-op adapter returning `not_configured` on every write | Active |
| `src/lib/drive/service.ts` | Factory + `setDriveRepository` test hook | Returns the empty repository |
| `src/lib/drive/viewer.ts` | Dashboard viewer identity | Returns the placeholder unless a session exists |
| `src/lib/business/repository.ts` | `BusinessRepository` — 22 methods, org/member/folder/activity contract | Complete interface, **no live implementation** |
| `src/lib/business/empty-repository.ts` | No-op adapter | Active |
| `src/lib/auth/types.ts` | `AuthService` — 9 methods | Complete interface |
| `src/lib/auth/supabase/service.ts` | Supabase adapter | **Real** — the only live backend integration |
| `src/lib/auth/supabase/server.ts` | Request-scoped SSR client | Real |
| `src/app/api/auth/oauth/[provider]/start/route.ts` | OAuth kick-off | Real — **the only route handler in the app** |
| `src/app/contact/actions.ts` | Contact form server action | Real, but Resend call is unconfigured |
| `src/middleware.ts` | Region cookie for display currency | Real, unrelated to auth |

### 2.3 What is genuinely live

Only three things genuinely hit a network today:

1. Supabase Auth, when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   are set. Sign-up, sign-in, sign-out, password reset, email verification, session
   read, and Google OAuth (when `NEXT_PUBLIC_AUTH_PROVIDERS=google`).
2. Resend, when `RESEND_API_KEY` is set — from the contact server action only.
3. Nothing else.

Everything else in the product is the empty repository. That is the honest
foundation: no screen currently claims a write succeeded.

---

## 3. Every simulated interaction

These are the exact places where the UI *pauses and then reports*, rather than
calling a service. Each is a defined seam with a comment saying so. **None of them
reports success**, which is why the frontend has been able to pass review without a
backend.

### 3.1 Personal dashboard

| Component | Line | Simulated behaviour | Real replacement |
| --- | --- | --- | --- |
| `dashboard/new-folder-dialog.tsx` | 59 | 450 ms wait, then error toast `NOT_CONNECTED_MESSAGE` | `POST /api/folders` |
| `dashboard/share-dialog.tsx` | 73 | 500 ms wait, error toast | `GET/POST /api/files/:id/grants` |
| `dashboard/share-dialog.tsx` | 87 | 350 ms wait, error toast | `PATCH/DELETE /api/grants/:id` |
| `dashboard/settings-view.tsx` | 78 | 450 ms wait, error toast | `PATCH /api/users/me` |
| `dashboard/settings-view.tsx` | 187 | 500 ms wait, error toast | `POST /api/users/me/email`, `/password` |
| `dashboard/billing-view.tsx` | 41 | 450 ms wait, "Payments aren't connected yet" | `POST /api/billing/checkout` → Razorpay |
| `dashboard/upload-manager.tsx` | 49– | `setInterval` fake progress that **stops short of 100 and then fails** | Real XHR progress → presigned R2 PUT |

The upload manager comment is explicit that the fake number is deliberate, that it
never reaches 100, and that it fails at the end rather than claiming completion.
That is the correct behaviour for a missing backend and it must be preserved as the
fallback until real transfers work.

### 3.2 Business dashboard

| Component | Line | Simulated behaviour | Real replacement |
| --- | --- | --- | --- |
| `business/invite-dialog.tsx` | 81 | 600 ms wait, error toast | `POST /api/organizations/:id/members` + Resend invite |
| `business/members-view.tsx` | 117 | 500 ms wait, error toast | `PATCH/DELETE /api/organizations/:id/members/:memberId` |
| `business/folders-view.tsx` | 62 | 450 ms wait, error toast | `POST /api/organizations/:id/folders` |
| `business/folder-access-dialog.tsx` | 106 | 550 ms wait, error toast | `PUT /api/organizations/:id/folders/:folderId/access` |
| `business/settings-view.tsx` | 108 | 500 ms wait, error toast | `PATCH /api/organizations/:id` |
| `business/settings-view.tsx` | 192 | 450 ms wait, error toast | `DELETE /api/organizations/:id` |

`NOT_CONNECTED_MESSAGE` appears in 14 places across six files. Every one is a real
`not_configured` result being surfaced, not a hard-coded string in a component —
the constant lives in `src/lib/drive/repository.ts` and the components import it.

### 3.3 Routes that 404 by design

`/dashboard/folders/[id]` resolves the folder through the repository and calls
`notFound()` when the repository says `not_found`. With no backend connected that is
every folder id. **This is the one route in the screenshot matrix that is expected
to 404**, and the harness records it as such rather than hiding it. Wiring the
repository and adding one fixture folder will turn it into a 200.

---

## 4. Contract gaps the backend must close

### 4.1 `DriveRepository` (30 methods)

Grouped by the domain service that will own it:

| Domain | Methods |
| --- | --- |
| `files`, `folders` | `list`, `get`, `createFolder`, `rename`, `move`, `toggleStar` |
| `trash` | `trash`, `restore`, `purge`, `emptyTrash` |
| `sharing` | `listGrants`, `addGrant`, `updateGrant`, `removeGrant`, `shareLink`, `setShareLink` |
| `storage` | `usage`, `prepareUpload`, `completeUpload`, `cancelUpload`, `uploadTasks` |
| `activity` | `activity` |
| `subscriptions`, `billing` | `subscription`, `invoices`, `startCheckout`, `cancelSubscription` |
| `users` | `updateProfile`, `changeEmail`, `changePassword`, `deleteAccount` |

The result envelope is already fixed:
`DriveResult<T> = { ok: true; data: T } | { ok: false; code: DriveErrorCode; message: string }`,
with codes `not_configured | not_found | forbidden | conflict | quota_exceeded |
invalid_name | rate_limited | network | unsupported | unknown`. The live
implementation must return these codes rather than throwing, because every
component already branches on them.

### 4.2 `BusinessRepository` (22 methods)

`organizations`, `organization`, `summary`, `storage`, `members`, `member`,
`invite`, `resendInvitation`, `revokeInvitation`, `changeRole`, `removeMember`,
`transferOwnership`, `folders`, `folder`, `createFolder`, `renameFolder`,
`deleteFolder`, `setFolderAccess`, `activity`, `updateOrganization`,
`deleteOrganization`.

Role rules already exist in `src/lib/business/roles.ts` (`canAssignRole`,
`removalBlocker`). **Those are UI affordances, not enforcement.** The same rules must
be re-implemented in RLS policies and in the service layer, because a client can
call the API directly.

### 4.3 `AuthService` (9 methods)

Already implemented against Supabase. Two things are missing:

- No route protection. `middleware.ts` does not refresh sessions or gate
  `/dashboard/**`. The dashboard renders for an anonymous visitor with the
  placeholder viewer. Once real data exists, an anonymous request must not reach it.
- No server-side "resolve the acting user" helper that services can call. Every
  handler will need one, and it must be the *only* way identity enters a service.

### 4.4 Route handlers

Exactly one exists. The API surface in `api-reference.md` adds roughly 40.

> **Correction to a widespread assumption.** `startCheckout` returns
> `DriveResult<{ url: string }>` — a redirect URL. Razorpay's web checkout flow
> returns a payment id and signature to the browser, which the server then
> verifies. Either the contract gains a verification step, or the implementation
> uses Razorpay's hosted/redirect flow. This must be resolved in
> `payment-lifecycle.md` before any billing code is written; silently ignoring the
> mismatch would produce an unverified-payment path.

---

## 5. Facts the interface asserts that the backend must honour

The frontend makes claims in user-facing copy. Each is a binding requirement, not
marketing.

| Claim, and where it appears | Backend obligation |
| --- | --- |
| "Every row is enforced by the backend. Nothing here is advisory." — business permissions matrix | Capability rows must map to real RLS predicates + service checks |
| "These figures are the plan allowance only — usage is confirmed once storage is connected." — dashboard storage | `usage` must return real committed/reserved/trash figures, not plan allowance |
| Trash retention copy derived from `TRASH_RETENTION.days` | Cleanup job must actually purge at that many days |
| "Annual pricing is not announced yet…" — pricing | Razorpay must not accept a yearly plan id that has no approved price |
| "Nothing was charged." — billing | Checkout must never render a success state without a verified signature |
| "Files you upload appear here immediately, newest first." | `list` ordering contract |
| Article feedback is deliberately not a rating widget | No feedback table |

`TRASH_RETENTION.approved` is `false` and the UI labels retention as provisional.
That flag stays `false` until the policy is approved; the number stays configurable.

---

## 6. The visual gate — now running

Every previous phase reported browser-automation screenshots as outstanding. That
gap is closed at commit `e4f6855`.

The binary ships brotli-compressed inside `@sparticuz/chromium`. `scripts/visual-gate/prep-chromium.py`
decompresses it; `scripts/visual-gate/capture.mjs` renders **49 routes × 5 widths =
220 full-page captures**, asserting HTTP status, console errors, page errors,
horizontal document overflow, and WCAG 2.5.8 pointer-target size. It exits non-zero
on any defect, so it is a gate, not a report.

**Result on the current tree: 220 shots, 0 problems.** Screenshots land in
`docs/design/screenshots/`.

Running it found seven real defects that no amount of code reading had caught:

1. The mobile nav drawer was translated off-screen but still laid out, adding
   148 px of horizontal scroll to every page at 390 px.
2. Legal policy tables escaped their `overflow-x-auto` container in Chromium's
   collapsed-border layout, widening the document by 148 px.
3. The same table escape in the business permissions matrix (102 px).
4. Sub-24 px pointer targets in the footer (20 px), dashboard breadcrumbs (25 px),
   billing-period segments (22 px), help breadcrumbs (15 px), the about-page CTA
   (21 px), the contact email card (15 px), and the marketing search field (20 px).

All are fixed with the design system untouched. Two classes of finding were
correctly *not* fixed, and the harness was taught to recognise them: links inside a
sentence (WCAG 2.5.8 inline exception) and inputs wrapped in a larger `<label>`.

**Limitation, stated plainly:** this verifies rendering, layout and target size at
five widths. It does not verify pixel-diff regression against a stored baseline,
interaction flows, keyboard traversal, or screen-reader output. Those need
additional gates, listed in §7.

---

## 7. Missing quality gates

| Gate | State | What it needs |
| --- | --- | --- |
| Screenshot matrix | **Running**, 220/220 clean | — |
| Pixel-diff baseline | Missing | Store baselines, compare per commit |
| Interaction tests | Missing | No test runner installed |
| Unit/integration tests | Missing | Vitest + a disposable Postgres |
| RLS negative tests | **Blocking** | Two identities, prove isolation |
| a11y automation | Partial | Target sizes covered; add axe-core |
| TypeScript | Running, clean | — |
| Lint | **Broken** | `next lint` removed in Next 16 |
| Build | Running, clean | — |

The RLS negative tests are the highest-value missing gate and are a hard
requirement. They cannot be written before the schema exists.

---

## 8. Open decisions that block implementation

These are recorded rather than guessed. Each changes code.

1. **Decimal GB vs binary GiB.** The product says "10 GB". `formatBytes` in
   `src/lib/drive/format.ts` divides by 1023-based units. A plan sold as 10 GB must
   not display as 9.31 GiB-used-of-10. Pick one basis, state it in
   `storage-architecture.md`, and make the database store bytes so the choice stays
   a presentation concern.
2. **Razorpay flow.** Redirect vs web-checkout-verify — see §4.4.
3. **`R2_PUBLIC_BASE_URL` vs the no-public-URLs rule.** `.env.example` documents a
   public base URL. The requirement forbids permanent public URLs to private files.
   Resolution: the variable is used only for explicitly-public assets, and private
   files get short-lived presigned GETs. That must be stated in code and in
   `storage-architecture.md`, and the variable's comment must be corrected.
4. **Service-role key.** `.env.example` says, correctly, "NEVER add the service-role
   key", and nothing reads it. But RLS-bypassing work (trash cleanup, quota
   reconciliation, webhook processing) genuinely needs a privileged path. The
   resolution must be a server-only client whose key is read from the environment
   and can never enter a client bundle, with the invariant enforced by a test —
   not by removing the capability.
5. **Orgs and billing.** Whether an organization has its own subscription or
   inherits the owner's is undecided, and it changes the schema.
6. **Malware scanning.** There is no scanning service. The integration point is a
   hook; nothing may claim scanning is active.

---

## 9. Build order

Sequenced by dependency, not by document order.

1. **Schema + RLS + migrations.** Nothing else can be tested without it.
2. **Identity resolution + auth gating.** The single server-side entry point for
   "who is calling", plus middleware route protection.
3. **Storage core.** Decimal decision, byte-based accounting, `usage`, reservation
   table, reconciliation.
4. **Upload pipeline.** The 13 ordered steps, presign, verify, commit.
5. **Files, folders, trash, sharing services** on top of the schema.
6. **Business/org services** + role enforcement duplicated into RLS.
7. **Billing.** Last, because it is the only thing that can take money, and it
   depends on plans, quota and lifecycle being correct first.
8. **Email + jobs.**
9. **Tests throughout**, not at the end — RLS negative tests land with the schema.
10. **Docs**, each written against working code.

---

## 10. Honest summary

The frontend is complete and verified, and it is honest about its own limits: it
says storage isn't connected, payments aren't connected, and the folder doesn't
exist. The backend does not exist yet beyond authentication.

Nothing in this audit was inferred from a prior phase's report. Where this document
and older docs disagree, this one is correct, because every statement in it was
checked against the tree at `e4f6855`.

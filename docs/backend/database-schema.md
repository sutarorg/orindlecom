# Database Schema

**Status:** Design locked. Migrations implement this document; where they diverge,
the migration is authoritative and this file is corrected in the same commit.

**Conventions**

- All primary keys are `uuid` with `gen_random_uuid()`.
- All timestamps are `timestamptz`, stored UTC. Nothing stores local time.
- **All sizes are `bigint` bytes, decimal basis** (1 GB = 10⁹). No `numeric` GB
  columns anywhere, because a size in GB rounded to a float is a number that loses
  bytes and then fails a quota check by one.
- Every table has `created_at`; mutable tables have `updated_at` maintained by
  trigger.
- Soft delete uses `deleted_at`, never a boolean — the timestamp is needed for
  retention.
- Table naming is plural snake_case. Enums are Postgres enums only where the set is
  genuinely closed and stable; a status that will grow uses a text column with a
  check constraint, because `ALTER TYPE … ADD VALUE` cannot run inside a
  transaction and will bite during migrations.
- RLS is **enabled on every table** and the default is deny.

---

## 1. Identity and profile

Supabase owns `auth.users`. This project owns everything else about a person.

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  avatar_url    text,
  locale        text not null default 'en',
  -- Region is for display currency only; billing currency is fixed at
  -- subscription time and never follows this field.
  country_code  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

Notes:

- `profiles.id` is the user id. There is no separate surrogate key, so a bug cannot
  produce a profile belonging to nobody.
- A profile row is created by a trigger on `auth.users` insert, so the app never has
  to remember to do it.
- Deletion cascades from `auth.users`, which means account deletion is a delete on
  the auth table and the rest follows — and `on delete cascade` must be present on
  every child table or the delete silently fails with an FK error.

---

## 2. Plans and prices

Plans are **data**, not constants in a component. The frontend's `PLANS` array
remains the source for marketing copy, and a test asserts the two agree.

```sql
create table public.plans (
  id             text primary key,               -- 'free','basic',…
  name           text not null,
  storage_bytes  bigint not null,
  sort_order     int not null,
  is_active      boolean not null default true,
  -- Annual pricing is unapproved. A plan with no approved yearly price has no
  -- yearly row at all, so checkout physically cannot find one.
  created_at     timestamptz not null default now()
);

create table public.plan_prices (
  id             uuid primary key default gen_random_uuid(),
  plan_id        text not null references public.plans(id) on delete cascade,
  currency       text not null check (currency in ('INR','USD')),
  period         text not null check (period in ('monthly','yearly')),
  -- Minor units: paise / cents. Never a float. ₹79 = 7900.
  amount_minor   bigint not null check (amount_minor >= 0),
  -- Approval state. Only an approved row may be used to create an order.
  approved       boolean not null default false,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (plan_id, currency, period)
);
```

**Why `approved` exists as a column and not as a convention:** the requirement is
that unapproved prices are never activated. A boolean the checkout query filters on
is enforceable in one place and provable in a test. Six rows per currency are
inserted as `approved = true` for monthly at the approved amounts; there are no
yearly rows until annual pricing is approved.

```sql
create table public.currencies (
  code            text primary key,
  symbol          text not null,
  minor_unit      int not null,       -- 2 for INR and USD
  published       boolean not null default false
);
-- GBP, EUR, AED, SGD, AUD, CAD are seeded with published = false and no prices.
-- They exist as reference data so the code can reason about them; nothing can
-- sell them.
```

---

## 3. Files, folders and the tree

### 3.1 Folders

```sql
create table public.folders (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  -- Null for a personal root; set for an organization-owned folder.
  organization_id uuid references public.organizations(id) on delete cascade,
  parent_id    uuid references public.folders(id) on delete cascade,
  name         text not null,
  path         text not null,            -- materialised, e.g. /a/b/c — for ancestry reads
  depth        int not null default 0,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- A folder belongs to exactly one owner: a person or an organization.
  constraint folder_owner_exclusive check (
    (organization_id is null) or (owner_id is not null)
  ),
  -- Two live folders with the same name in the same place is a conflict.
  unique (owner_id, parent_id, name)
    deferrable initially immediate
);
```

The uniqueness constraint on a nullable `parent_id` needs a `coalesce`-based partial
unique index in practice, because `NULL` values do not conflict in Postgres:

```sql
create unique index folders_unique_live_name
  on public.folders (owner_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;
```

**Cost of the materialised `path`:** renames and moves must rewrite descendants.
That is a write amplification on a deep tree, accepted because reads dominate and
ancestry breadcrumbs are on every folder page. A trigger keeps it consistent; a
test proves that a move of a 1,000-folder tree leaves no stale path.

### 3.2 Files

```sql
create type file_status as enum ('pending','available','quarantined','failed');

create table public.files (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  folder_id       uuid references public.folders(id) on delete set null,
  name            text not null,
  -- Decimal bytes. The size the customer was shown when uploading.
  size_bytes      bigint not null check (size_bytes >= 0),
  mime_type       text not null default 'application/octet-stream',
  category        text not null default 'other',
  -- R2 object key. Opaque, server-generated, never derived from the file name.
  storage_key     text not null unique,
  checksum_sha256 text,
  -- NOTHING is downloadable until status = 'available', and availability is only
  -- set after the object is verified to exist with the expected size.
  status          file_status not null default 'pending',
  scanned_at      timestamptz,
  scan_result     text,
  starred         boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index files_owner_live on public.files (owner_id, created_at desc) where deleted_at is null;
create index files_folder_live on public.files (folder_id) where deleted_at is null;
create index files_status_pending on public.files (status) where status = 'pending';
```

`scan_result` is nullable and not set by any code path yet. **There is no scanner
integration configured.** The field and the `quarantined` status exist so the hook
has somewhere to write; a comment in the migration says exactly that, so nobody
mistakes an empty column for an active protection.

---

## 4. Storage accounting

This is the most important section in the document. Quota is where a storage product
either works or quietly loses money.

### 4.1 The two-number model

A user's storage is **committed + reserved**. Committed is what exists. Reserved is
what is in flight. Browsers do not finish uploads; a reservation that is never
released would lock a quota forever, so reservations have an expiry and a sweeper.

```sql
create table public.storage_usage (
  owner_id        uuid primary key references auth.users(id) on delete cascade,
  -- Materialised sums. Recomputable from files/reservations at any time; held
  -- here so a quota check is a single row read rather than an aggregate over
  -- every file the account owns.
  committed_bytes bigint not null default 0 check (committed_bytes >= 0),
  reserved_bytes  bigint not null default 0 check (reserved_bytes >= 0),
  trash_bytes     bigint not null default 0 check (trash_bytes >= 0),
  updated_at      timestamptz not null default now()
);

create table public.storage_reservations (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  -- The bytes this upload intends to claim. Enforced at insert against quota.
  requested_bytes bigint not null check (requested_bytes > 0),
  bytes_used    bigint not null default 0,
  upload_id     uuid not null,             -- correlates to upload_sessions
  status        text not null default 'reserved'
                check (status in ('reserved','committed','released','expired')),
  expires_at    timestamptz not null default now() + interval '24 hours',
  created_at    timestamptz not null default now()
);

create index reservations_live on public.storage_reservations (owner_id)
  where status = 'reserved';
```

**The quota check must be atomic.** Read-then-write in application code is the bug
that lets parallel uploads exceed the plan:

```sql
-- Serialise per owner with a row lock, then decide.
create or replace function public.reserve_storage(
  p_owner uuid, p_bytes bigint, p_upload uuid
) returns public.storage_reservations
language plpgsql security definer as $$
declare
  v_plan_bytes bigint;
  v_row public.storage_usage;
  v_res public.storage_reservations;
begin
  -- Lock the usage row: the second concurrent call blocks here until the first
  -- commits, so both cannot observe the same free space.
  select * into v_row from public.storage_usage
    where owner_id = p_owner for update;
  if not found then
    insert into public.storage_usage (owner_id) values (p_owner)
      on conflict do nothing;
    select * into v_row from public.storage_usage
      where owner_id = p_owner for update;
  end if;

  v_plan_bytes := public.effective_plan_bytes(p_owner);

  if v_row.committed_bytes + v_row.reserved_bytes + p_bytes > v_plan_bytes then
    raise exception 'quota_exceeded'
      using errcode = 'P0001',
            hint = 'insufficient storage for this upload';
  end if;

  update public.storage_usage
    set reserved_bytes = reserved_bytes + p_bytes, updated_at = now()
    where owner_id = p_owner;

  insert into public.storage_reservations
    (owner_id, requested_bytes, upload_id)
    values (p_owner, p_bytes, p_upload)
    returning * into v_res;

  return v_res;
end; $$;
```

`trash_bytes` is tracked but is **not** subtracted from committed: a file in the bin
still occupies the bucket and still costs money. The UI explains this rather than
hiding it, because showing "space freed" while the bucket is full would be a lie.

### 4.2 Classification, stated once

| Figure | Definition |
| --- | --- |
| `total` | The plan's allowance in bytes. On an expired plan, the Free allowance. |
| `committed` | Bytes of `available` files that are not in the bin. |
| `reserved` | Bytes claimed by in-flight uploads. |
| `trash` | Bytes of files with `deleted_at` set, still within retention. |
| `available` | `total − committed − reserved`. Trash counts inside `committed` for this subtraction, because the space is genuinely occupied. |

The frontend's `StorageUsage` type gains `reserved`, `trash` and `available`; the
existing `used` remains and equals `committed + reserved` so no component breaks.

---

## 5. Upload sessions

```sql
create table public.upload_sessions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  file_id       uuid references public.files(id) on delete cascade,
  -- Server-generated key. The client never supplies a key, so it cannot choose
  -- a path or overwrite another object.
  storage_key   text not null,
  multipart     boolean not null default false,
  r2_upload_id  text,                 -- R2's multipart id, when multipart
  parts_etags   jsonb not null default '[]'::jsonb,
  declared_size bigint not null,
  status        text not null default 'initiated'
                check (status in ('initiated','uploaded','confirmed','cancelled','expired')),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
```

---

## 6. Sharing

```sql
create table public.share_grants (
  id          uuid primary key default gen_random_uuid(),
  -- Exactly one of file/folder is set.
  file_id     uuid references public.files(id) on delete cascade,
  folder_id   uuid references public.folders(id) on delete cascade,
  grantee_id  uuid not null references auth.users(id) on delete cascade,
  granted_by  uuid not null references auth.users(id) on delete cascade,
  permission  text not null check (permission in ('viewer','commenter','editor')),
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint grant_target_exclusive check (
    (file_id is not null) <> (folder_id is not null)
  ),
  unique (file_id, grantee_id),
  unique (folder_id, grantee_id)
);

create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid references public.files(id) on delete cascade,
  folder_id   uuid references public.folders(id) on delete cascade,
  -- Unguessable. Not a sequential id, not derived from the file name.
  token       text not null unique,
  permission  text not null default 'viewer'
              check (permission in ('viewer','commenter','editor')),
  -- Links expire. A permanent public link is exactly what the requirements forbid.
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
```

Only `viewer` links may be redeemed by an anonymous visitor, and only while
`expires_at` is in the future and `revoked_at` is null. `commenter`/`editor` links
require an authenticated user with a matching grant.

---

## 7. Organizations and membership

```sql
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  -- Seat and storage accounting rolls up to the owner's plan until org billing
  -- is a separate decision. See open question in implementation-audit.md §8.
  owner_id    uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  -- A pending invite has an email and no user_id yet.
  email       text not null,
  role        text not null check (role in ('owner','admin','member')),
  status      text not null default 'invited'
              check (status in ('invited','active','suspended','removed')),
  invited_by  uuid references auth.users(id) on delete set null,
  invite_token text unique,
  invite_expires_at timestamptz,
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (organization_id, email)
);
```

**Membership lookup must bypass RLS recursion.** A policy on `members` that queries
`members` recurses. The standard fix is a `security definer` function:

```sql
create or replace function public.is_org_member(p_org uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.members
    where organization_id = p_org and user_id = p_user and status = 'active'
  );
$$;
```

The same pattern provides `org_role(p_org, p_user)` for role checks. Every
organization policy calls one of those two functions, never a subquery on `members`.

---

## 8. Subscriptions and billing

```sql
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  plan_id         text not null references public.plans(id),
  -- Currency is fixed for the life of the subscription. Moving country does not
  -- silently re-price someone mid-term.
  currency        text not null check (currency in ('INR','USD')),
  status          text not null default 'none'
                  check (status in ('none','active','past_due','cancelled','expired')),
  -- Razorpay identifiers. Unique so a duplicate webhook cannot create a second row.
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Expiry never deletes anything. This is the start of the recovery window.
  expired_at      timestamptz,
  recovery_ends_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider_payment_id text unique,
  amount_minor   bigint not null,
  currency       text not null,
  status         text not null check (status in ('paid','failed','refunded')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

create table public.webhook_events (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'razorpay',
  -- Provider's event id. Unique: a duplicate delivery is a no-op, not a second
  -- state transition.
  event_id      text not null,
  event_type    text not null,
  payload       jsonb not null,
  -- Stored raw BEFORE processing so a failing handler can be replayed.
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  unique (provider, event_id)
);
```

---

## 9. Activity, support and email

```sql
create table public.activity_events (
  id          uuid primary key default gen_random_uuid(),
  -- Actor may be null for system jobs; the job name goes in metadata.
  actor_id    uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  subject_type text not null,
  subject_id  uuid,
  kind        text not null,        -- 'file.uploaded','member.role_changed',…
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_org_time on public.activity_events (organization_id, created_at desc);

create table public.support_requests (
  id           uuid primary key default gen_random_uuid(),
  -- Not public. RLS: only the submitter and service role may read.
  submitter_email text not null,
  submitter_id uuid references auth.users(id) on delete set null,
  category     text not null,
  subject      text not null,
  message      text not null,
  source       text not null default 'contact-form',
  delivery_status text not null default 'pending'
                check (delivery_status in ('pending','delivered','failed')),
  provider_message_id text,
  delivery_error text,
  created_at   timestamptz not null default now()
);

create table public.email_log (
  id          uuid primary key default gen_random_uuid(),
  to_address  text not null,
  template    text not null,
  status      text not null check (status in ('queued','sent','failed')),
  provider_message_id text,
  error       text,
  attempts    int not null default 0,
  next_attempt_at timestamptz,
  created_at  timestamptz not null default now()
);
```

`support_requests` is deliberately not world-readable and not world-insertable via the
API: the contact form writes through a server action using the service client, which
means an anonymous visitor can submit but cannot read anything back. A test asserts
that an anonymous select returns zero rows.

---

## 10. RLS policy summary

| Table | Read | Write | Notes |
| --- | --- | --- | --- |
| `profiles` | own row | own row | Never another person's |
| `plans`, `plan_prices`, `currencies` | public | service only | Reference data |
| `folders` | owner, or org member with role, or active grant | owner/editor | Path traversal never grants |
| `files` | owner, or granted, or org member | owner/editor | `status='available'` required |
| `storage_usage`, `storage_reservations` | own | service / own reservation | Never another user's |
| `upload_sessions` | own | own | |
| `share_grants` | grantee and grantor | grantor | |
| `share_links` | grantor | grantor | Redemption is a definer function |
| `organizations` | members | owner/admin | |
| `members` | org members | owner/admin | via `is_org_member` |
| `subscriptions`, `invoices` | own | service only | **Billing is private; no member or admin sees another person's billing** |
| `webhook_events` | service only | service only | |
| `activity_events` | org members / own | service | Append-only |
| `support_requests` | submitter only | service | Not publicly readable |
| `email_log` | service only | service only | |
| `account_security` | own row | service only | Read-only for the user: `password_setup_required` is server-owned |
| `abuse_policy`, `email_domain_risk` | none | service only | Deny-all by design; configuration and intelligence |
| `device_signups`, `risk_events`, `account_restrictions` | none | service only | A client that could read its own risk score could learn to stay under it |
| `turnstile_tokens` | none | service only | Single-use claims; a client that could write here could pre-claim tokens |

Every row above is proven by a negative test that attempts the forbidden read as a
different identity and asserts zero rows, not merely a non-error.

---

## 11. Anti-abuse tables (migrations 0014–0016)

Added by the anti-abuse system. The design note that matters: **none of these is
readable by the user they describe.** A risk score a person can see is a risk score they
can learn to stay under.

```sql
-- Configuration, one row. Thresholds and weights are data so a change carries a
-- migration history instead of being a constant edited in place.
create table public.abuse_policy (
  id                          boolean primary key default true check (id),
  medium_threshold            int not null default 25,
  high_threshold              int not null default 55,
  confirmed_threshold         int not null default 80,
  weight_disposable           int not null default 70,
  -- … weights and windows
  decay_points_per_day        int not null default 10
);

-- Domain intelligence. `classification` is a closed set, and the *absence* of a
-- row is a distinct state — an unclassified domain is "no signal", never
-- "suspicious", because blocking an unfamiliar custom domain costs a real customer.
create table public.email_domain_risk (
  domain         text primary key,
  classification text not null check (classification in ('safe', 'disposable', 'risky')),
  source         text not null default 'seed',
  confirmed_at   timestamptz not null default now()
);

-- Protected onboarding state. Lives here, not in auth.users.user_metadata,
-- because user metadata is user-writable and a flag the client can clear is not a gate.
create table public.account_security (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  signup_provider         text not null default 'email' check (signup_provider in ('email','google')),
  password_setup_required boolean not null default false,
  password_setup_at       timestamptz,
  provider_email_verified boolean not null default false
);

-- One row per signup attempt, keyed on salted hashes. The identifier is a first-party
-- cookie, not a fingerprint: it says "this browser profile", never "this person".
create table public.device_signups (
  id          uuid primary key default gen_random_uuid(),
  device_hash text not null,
  user_id     uuid references auth.users(id) on delete set null,
  ip_hash     text,
  outcome     text not null check (outcome in ('accepted','throttled','rejected')),
  risk_score  int not null default 0,
  risk_level  text not null default 'low',
  created_at  timestamptz not null default now()
);

-- The audit trail that replaces an administrator dashboard.
create table public.risk_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  device_hash text,
  ip_hash     text,
  kind        text not null,
  score       int,
  level       text check (level in ('low','medium','high','confirmed')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Every restriction expires. There is no permanent state, deliberately: automated
-- enforcement that cannot expire is a ban nobody reviews.
create table public.account_restrictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  device_hash text,
  kind        text not null check (kind in ('signup_block','upload_block','read_only')),
  reason      text not null,
  risk_score  int not null default 0,
  evidence    jsonb not null default '{}'::jsonb,
  expires_at  timestamptz not null,
  released_at timestamptz,
  check (user_id is not null or device_hash is not null)
);

-- Single-use CAPTCHA claims, defended in depth against a lost Siteverify response.
create table public.turnstile_tokens (
  token_hash text primary key,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);
```

### Functions

| Function | Purpose |
| --- | --- |
| `classify_email_domain(email)` | `safe` / `disposable` / `risky` / null for unclassified |
| `signup_signals(device, ip)` | The raw counts a score is built from |
| `score_signup(domain_class, signals)` | Score, band, and a reasons array naming every factor |
| `apply_signup_outcome(…)` | Records the decision and applies the band's restriction |
| `release_expired_restrictions()` | Automated recovery; idempotent; logs each release |
| `record_quota_violation(user, device, ip)` | Escalates on the third refusal in an hour |
| `active_restriction(user, kind)` | Whether a cooldown is live |

`effective_plan_bytes()` and `reserve_storage()` were **replaced** in 0014 to require a
verified address and to honour an `upload_block`. The row lock and quota arithmetic are
copied verbatim from 0006 — rewriting the concurrency behaviour of the one function that
prevents overselling, inside a security migration, would be reckless.

---

## 12. Migration order

Migrations are forward-only and reviewed. Order matters because of foreign keys:

1. Extensions, enums, `updated_at` trigger helper.
2. `profiles` + auth trigger.
3. `plans`, `plan_prices`, `currencies` + seed of approved prices.
4. `organizations`, `members`, `is_org_member`/`org_role` definers.
5. `folders`, `files`, path triggers.
6. `storage_usage`, `storage_reservations`, `effective_plan_bytes`, `reserve_storage`.
7. `upload_sessions`, `share_grants`, `share_links`.
8. `subscriptions`, `invoices`, `webhook_events`.
9. `activity_events`, `support_requests`, `email_log`.
10. RLS enable + policies, table by table.
11. Seed reference data.
12. 0014 anti-abuse tables, scoring and enforcement functions, and the replaced
    `effective_plan_bytes`/`reserve_storage`.
13. 0015 RLS for the anti-abuse tables and the curated domain baseline.
14. 0016 single-use Turnstile claims.

Each migration that introduces a table also introduces its policies in the same file.
A table without policies is a table that is wide open the moment it exists, and
splitting the two across files is how that window gets forgotten.

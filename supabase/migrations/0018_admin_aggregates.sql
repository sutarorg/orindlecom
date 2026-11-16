-- 0018 — aggregation for the admin console.
--
-- Why functions instead of queries in application code:
--
--   1. `auth.users` is not reachable through the Supabase JS client at all. The
--      user directory has to join it with profiles/subscriptions/storage, so it
--      has to be SQL.
--   2. Every figure on these pages is a total over a table that grows without
--      bound. Sending rows to the browser and adding them in JavaScript is the
--      thing the requirement forbids, and it also breaks the moment pagination
--      starts — the total would describe the page, not the platform.
--
-- Every function here is:
--   - `security definer` with `set search_path = public` (never `public, auth`:
--     an unqualified reference resolving inside `auth` is how a search_path
--     attack works),
--   - `stable` — these are reads and must not be called in a write transaction,
--   - revoked from PUBLIC/anon/authenticated and granted only to service_role.
--     Authorization happens in TypeScript before the client is built; the database
--     refuses anyone who is not the privileged role regardless.

-- ---------------------------------------------------------------------------
-- MRR, per currency.
--
-- Rules, and each is a decision rather than an accident:
--
--   active, no cancel scheduled        → counts, full period value
--   active, cancel_at_period_end=true  → counts until current_period_end; the
--                                        customer has paid for the term
--   active, past current_period_end    → does NOT count. A renewal that never
--                                        arrived is not revenue
--   past_due / cancelled / expired     → does NOT count
--   billing_period is NULL             → excluded, and counted separately so the
--                                        admin UI can say how many are unknown
--
-- Money is bigint minor units throughout. No float arithmetic anywhere: 0.1 + 0.2
-- is not 0.3 and an MRR card that is off by a paisa destroys trust in every other
-- number on the page.
-- ---------------------------------------------------------------------------
create or replace function public.admin_mrr()
returns table (
  currency        text,
  monthly_minor   bigint,
  subscribers     bigint,
  unknown_period  bigint
)
language sql stable security definer set search_path = public as $$
  select
    s.currency,
    coalesce(sum(
      case
        when s.billing_period = 'yearly' then pp.amount_minor / 12
        else pp.amount_minor
      end
    ), 0)::bigint as monthly_minor,
    count(*) filter (where s.billing_period is not null) as subscribers,
    count(*) filter (where s.billing_period is null) as unknown_period
  from public.subscriptions s
  join public.plan_prices pp
    on pp.plan_id = s.plan_id
   and pp.currency = s.currency
   and pp.period = coalesce(s.billing_period, pp.period)
   and pp.approved
  where s.status = 'active'
    and (s.current_period_end is null or s.current_period_end > now())
    and s.billing_period is not null
  group by s.currency
  union all
  -- The unknown-period count has to come from a separate scan, because the join
  -- above deliberately skips those rows. An admin who cannot see "3 subscriptions
  -- with no recorded period" cannot know the number is incomplete.
  select
    s.currency, 0::bigint, 0::bigint, count(*)
  from public.subscriptions s
  where s.status = 'active'
    and (s.current_period_end is null or s.current_period_end > now())
    and s.billing_period is null
  group by s.currency;
$$;

-- ---------------------------------------------------------------------------
-- Platform counters for the overview.
--
-- One row, one round trip. Signed-up users come from auth.users because that is
-- the only place a registration exists; counting profiles would miss a user whose
-- trigger failed, and counting organizations would be a different question.
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview_stats()
returns table (
  total_users      bigint,
  verified_users   bigint,
  paid_users       bigint,
  committed_bytes  bigint,
  reserved_bytes   bigint,
  trash_bytes      bigint,
  open_tickets     bigint,
  organizations    bigint
)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where email_confirmed_at is not null),
    (
      select count(distinct s.owner_id)
      from public.subscriptions s
      where s.status = 'active'
        and (s.current_period_end is null or s.current_period_end > now())
        and s.plan_id <> 'free'
    ),
    (select coalesce(sum(committed_bytes), 0) from public.storage_usage),
    (select coalesce(sum(reserved_bytes), 0) from public.storage_usage),
    (select coalesce(sum(trash_bytes), 0) from public.storage_usage),
    (select count(*) from public.support_requests where ticket_status <> 'resolved'),
    (select count(*) from public.organizations);
$$;

-- ---------------------------------------------------------------------------
-- Signups and collected revenue per day, for the growth chart.
--
-- Two separate series returned together, never one combined line: a signup is not
-- a rupee. The revenue half excludes failed and refunded invoices by construction
-- (only status = 'paid' is summed) and groups by currency so two currencies are
-- never added.
--
-- generate_series produces the days with no data as zero, so the chart does not
-- draw a straight line between two distant points and imply a trend that was
-- never measured.
-- ---------------------------------------------------------------------------
create or replace function public.admin_growth_series(p_days int default 30)
returns table (
  day        date,
  signups    bigint,
  currency   text,
  revenue_minor bigint
)
language sql stable security definer set search_path = public as $$
  with span as (
    select generate_series(
      (current_date - (least(greatest(p_days, 1), 365) - 1)),
      current_date,
      interval '1 day'
    )::date as day
  ),
  signup_days as (
    select date_trunc('day', created_at)::date as day, count(*)::bigint as n
    from auth.users
    where created_at >= current_date - (least(greatest(p_days, 1), 365) - 1)
    group by 1
  ),
  revenue_days as (
    select date_trunc('day', paid_at)::date as day, currency, sum(amount_minor)::bigint as n
    from public.invoices
    where status = 'paid'
      and paid_at is not null
      and paid_at >= current_date - (least(greatest(p_days, 1), 365) - 1)
    group by 1, 2
  )
  select sp.day, coalesce(sd.n, 0), rd.currency, coalesce(rd.n, 0)
  from span sp
  left join signup_days sd on sd.day = sp.day
  left join revenue_days rd on rd.day = sp.day
  order by sp.day;
$$;

-- ---------------------------------------------------------------------------
-- The user directory.
--
-- Search, filter, sort and paginate all happen here. Doing search in the browser
-- over a fetched page is the classic bug this avoids: it silently means "search
-- the 25 rows you can see".
--
-- Parameters are validated in TypeScript *and* here. The SQL is parameterised —
-- no string is ever concatenated into it — and the sort column is chosen from a
-- closed set with CASE rather than interpolated, so there is no injection path
-- even if the caller were careless.
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_directory(
  p_search        text default null,
  p_plan          text default null,
  p_verified      boolean default null,
  p_status        text default null,
  p_created_after timestamptz default null,
  p_created_before timestamptz default null,
  p_sort          text default 'newest',
  p_limit         int default 25,
  p_offset        int default 0
)
returns table (
  user_id        uuid,
  email          text,
  full_name      text,
  created_at     timestamptz,
  email_verified boolean,
  plan_id        text,
  subscription_status text,
  storage_committed bigint,
  total_count    bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      u.id as user_id,
      u.email::text as email,
      p.full_name,
      u.created_at,
      (u.email_confirmed_at is not null) as email_verified,
      coalesce(s.plan_id, 'free') as plan_id,
      s.status::text as subscription_status,
      coalesce(su.committed_bytes, 0) as storage_committed
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join lateral (
      select sub.plan_id, sub.status
      from public.subscriptions sub
      where sub.owner_id = u.id
      order by (sub.status in ('active', 'past_due')) desc, sub.created_at desc
      limit 1
    ) s on true
    left join public.storage_usage su on su.owner_id = u.id
    where
      -- Search across the three things an operator actually types: an email, a
      -- name, or a user id pasted from an error report.
      (
        p_search is null
        or btrim(p_search) = ''
        or u.email ilike '%' || btrim(p_search) || '%'
        or coalesce(p.full_name, '') ilike '%' || btrim(p_search) || '%'
        or u.id::text ilike btrim(p_search) || '%'
      )
      and (p_plan is null or coalesce(s.plan_id, 'free') = p_plan)
      and (p_verified is null or (u.email_confirmed_at is not null) = p_verified)
      and (p_status is null or coalesce(s.status::text, 'none') = p_status)
      and (p_created_after is null or u.created_at >= p_created_after)
      and (p_created_before is null or u.created_at <= p_created_before)
  )
  select b.*, count(*) over () as total_count
  from base b
  order by
    -- A closed set, applied with CASE. `order by case ... then col end` keeps the
    -- sort column out of the SQL text entirely.
    case when p_sort = 'newest' then b.created_at end desc nulls last,
    case when p_sort = 'oldest' then b.created_at end asc nulls last,
    case when p_sort = 'storage' then b.storage_committed end desc nulls last,
    b.user_id
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Storage distribution by plan and the largest accounts.
--
-- Read from storage_usage, which is the materialised authority. Deliberately not
-- an aggregate over `files`: that would be a second, slower source of truth that
-- can disagree with the one quota enforcement uses.
-- ---------------------------------------------------------------------------
create or replace function public.admin_storage_by_plan()
returns table (
  plan_id        text,
  accounts       bigint,
  committed_bytes bigint,
  reserved_bytes bigint
)
language sql stable security definer set search_path = public as $$
  select
    coalesce(s.plan_id, 'free'),
    count(distinct su.owner_id),
    coalesce(sum(su.committed_bytes), 0),
    coalesce(sum(su.reserved_bytes), 0)
  from public.storage_usage su
  left join lateral (
    select sub.plan_id from public.subscriptions sub
    where sub.owner_id = su.owner_id and sub.status in ('active', 'past_due')
    order by sub.created_at desc limit 1
  ) s on true
  group by 1
  order by 3 desc;
$$;

create or replace function public.admin_largest_accounts(p_limit int default 10)
returns table (
  owner_id       uuid,
  email          text,
  plan_id        text,
  committed_bytes bigint,
  reserved_bytes bigint,
  trash_bytes    bigint
)
language sql stable security definer set search_path = public as $$
  select
    su.owner_id,
    u.email::text,
    coalesce((
      select sub.plan_id from public.subscriptions sub
      where sub.owner_id = su.owner_id and sub.status in ('active', 'past_due')
      order by sub.created_at desc limit 1
    ), 'free'),
    su.committed_bytes,
    su.reserved_bytes,
    su.trash_bytes
  from public.storage_usage su
  join auth.users u on u.id = su.owner_id
  order by su.committed_bytes desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Billing summary.
-- ---------------------------------------------------------------------------
create or replace function public.admin_billing_summary()
returns table (
  status          text,
  plan_id         text,
  currency        text,
  subscriptions   bigint
)
language sql stable security definer set search_path = public as $$
  select s.status, s.plan_id, s.currency, count(*)
  from public.subscriptions s
  group by 1, 2, 3
  order by 4 desc;
$$;

-- ---------------------------------------------------------------------------
-- Team directory.
-- ---------------------------------------------------------------------------
create or replace function public.admin_team_directory(
  p_search text default null,
  p_limit  int default 25,
  p_offset int default 0
)
returns table (
  organization_id uuid,
  name            text,
  slug            text,
  owner_email     text,
  created_at      timestamptz,
  total_members   bigint,
  active_members  bigint,
  pending_invites bigint,
  total_count     bigint
)
language sql stable security definer set search_path = public as $$
  with base as (
    select
      o.id as organization_id,
      o.name,
      o.slug,
      u.email::text as owner_email,
      o.created_at,
      count(m.id) as total_members,
      count(m.id) filter (where m.status = 'active') as active_members,
      count(m.id) filter (where m.status = 'invited') as pending_invites
    from public.organizations o
    left join auth.users u on u.id = o.owner_id
    left join public.members m on m.organization_id = o.id and m.status <> 'removed'
    where p_search is null
       or btrim(p_search) = ''
       or o.name ilike '%' || btrim(p_search) || '%'
       or o.slug ilike '%' || btrim(p_search) || '%'
       or coalesce(u.email, '') ilike '%' || btrim(p_search) || '%'
    group by o.id, o.name, o.slug, u.email, o.created_at
  )
  select b.*, count(*) over () as total_count
  from base b
  order by b.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Nothing above is callable by a customer.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_mrr() from public;
revoke all on function public.admin_overview_stats() from public;
revoke all on function public.admin_growth_series(int) from public;
revoke all on function public.admin_user_directory(text, text, boolean, text, timestamptz, timestamptz, text, int, int) from public;
revoke all on function public.admin_storage_by_plan() from public;
revoke all on function public.admin_largest_accounts(int) from public;
revoke all on function public.admin_billing_summary() from public;
revoke all on function public.admin_team_directory(text, int, int) from public;

grant execute on function public.admin_mrr() to service_role;
grant execute on function public.admin_overview_stats() to service_role;
grant execute on function public.admin_growth_series(int) to service_role;
grant execute on function public.admin_user_directory(text, text, boolean, text, timestamptz, timestamptz, text, int, int) to service_role;
grant execute on function public.admin_storage_by_plan() to service_role;
grant execute on function public.admin_largest_accounts(int) to service_role;
grant execute on function public.admin_billing_summary() to service_role;
grant execute on function public.admin_team_directory(text, int, int) to service_role;

-- Indexes for the queries above. Without these the directory is a sequential
-- scan of every account on the platform, which is fine at a hundred rows and an
-- outage at a hundred thousand.
create index if not exists users_created_at on auth.users (created_at desc);
create index if not exists profiles_full_name_trgm on public.profiles (lower(full_name));
create index if not exists organizations_created on public.organizations (created_at desc);
create index if not exists subscriptions_status_plan on public.subscriptions (status, plan_id);
create index if not exists invoices_paid_at on public.invoices (paid_at desc) where status = 'paid';

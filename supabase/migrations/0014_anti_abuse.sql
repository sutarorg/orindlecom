-- 0014 — anti-abuse foundation.
--
-- Six tables and the functions that score a signup against them. The design
-- principle throughout: every decision is a *stored, inspectable record* and a
-- *pure function of that record*, so enforcement is reproducible and a support
-- conversation can point at the evidence.
--
-- Two deliberate omissions, both from the requirements:
--   * There is no table an administrator edits to approve a registration. The
--     policy row below is configuration, not a review queue.
--   * Nothing here deletes a user's files. Restrictions bound *new* consumption
--     and *signup*; existing data stays reachable. That asymmetry is the whole
--     reason automatic enforcement is safe to run unattended.
--
-- Depends on 0002 (profiles), 0006 (storage accounting), 0010 (rate limiting).

-- ---------------------------------------------------------------------------
-- Policy: the tunable numbers, in one row.
--
-- Kept in the database rather than in TypeScript so that changing a threshold is
-- a reviewed migration with a history, and so that the scoring function cannot
-- disagree with itself between two deployments running different builds.
-- ---------------------------------------------------------------------------
create table public.abuse_policy (
  id                     boolean primary key default true check (id),
  -- Risk band boundaries. 0–24 low, 25–54 medium, 55–79 high, 80+ confirmed.
  medium_threshold       int not null default 25 check (medium_threshold > 0),
  high_threshold         int not null default 55 check (high_threshold > medium_threshold),
  confirmed_threshold    int not null default 80 check (confirmed_threshold > high_threshold),
  -- Signal weights.
  weight_disposable      int not null default 70,
  weight_risky_domain    int not null default 25,
  weight_device_week     int not null default 12,
  weight_device_hour     int not null default 25,
  weight_ip_hour         int not null default 18,
  weight_ip_hour_many    int not null default 32,
  weight_captcha_fail    int not null default 20,
  weight_prior_block     int not null default 15,
  -- Windows, in hours.
  device_window_hours    int not null default 168,
  burst_window_hours     int not null default 1,
  -- A device with this many distinct accounts in 24h is treated as confirmed
  -- abuse, independently of the score. This is the "objective evidence" rule.
  confirmed_device_accounts int not null default 4,
  -- Restriction lifetimes, in minutes. Short enough that a false positive is an
  -- inconvenience rather than a lockout, long enough to stop a script.
  medium_throttle_minutes   int not null default 30,
  high_restriction_minutes  int not null default 180,
  confirmed_restriction_minutes int not null default 1440,
  -- How fast a score decays. Points removed per day since the last event.
  decay_points_per_day   int not null default 10,
  updated_at             timestamptz not null default now()
);

create trigger abuse_policy_touch before update on public.abuse_policy
  for each row execute function public.touch_updated_at();

insert into public.abuse_policy (id) values (true);

-- ---------------------------------------------------------------------------
-- Email domain intelligence.
--
-- Seeded in 0015 and refreshed by a scheduled job. `classification` is a closed
-- set on purpose: a domain is either known-good, known-disposable, worth
-- watching, or unclassified. "Unknown" must stay a distinct state — treating an
-- unfamiliar domain as disposable would block legitimate custom-domain mail,
-- which the requirements call out explicitly.
-- ---------------------------------------------------------------------------
create table public.email_domain_risk (
  domain          text primary key,
  classification  text not null check (classification in ('safe', 'disposable', 'risky')),
  source          text not null default 'seed',
  -- When an external feed last confirmed this row. A row that has not been
  -- confirmed for a long time is still usable — see the last-known-good note in
  -- docs/security/anti-abuse-system.md.
  confirmed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index domain_risk_class on public.email_domain_risk (classification);

-- ---------------------------------------------------------------------------
-- Account security: the protected onboarding state.
--
-- `password_setup_required` lives here and not in `auth.users.user_metadata`,
-- because user metadata is writable by the user. A flag a client can set to
-- false would make the Set Password step optional, which is precisely what it
-- must not be.
-- ---------------------------------------------------------------------------
create table public.account_security (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  -- Which identity created the account. 'google' accounts are the only ones
  -- that can require the Set Password step.
  signup_provider          text not null default 'email'
                           check (signup_provider in ('email', 'google')),
  password_setup_required  boolean not null default false,
  password_setup_at        timestamptz,
  -- Google's own verification claim, read from the provider token server-side
  -- and recorded. Never taken from a request body.
  provider_email_verified  boolean not null default false,
  first_seen_at            timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger account_security_touch before update on public.account_security
  for each row execute function public.touch_updated_at();

-- Every new auth user gets a row, mirroring how 0002 guarantees a profile. Doing
-- it in the database means the OAuth path cannot forget it.
create or replace function public.handle_new_user_security()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_provider text;
  v_verified boolean;
begin
  -- Supabase stores the provider on the identity, not the user. On a brand-new
  -- user the identity row is inserted by the auth service; when it is not
  -- visible yet, fall back to the app metadata, which the server sets.
  select i.provider into v_provider
    from auth.identities i
    where i.user_id = new.id
    limit 1;

  v_provider := coalesce(
    v_provider,
    nullif(new.raw_app_meta_data ->> 'provider', ''),
    'email'
  );

  v_verified := new.email_confirmed_at is not null;

  insert into public.account_security (
    user_id, signup_provider, password_setup_required, provider_email_verified
  )
  values (
    new.id,
    case when v_provider = 'google' then 'google' else 'email' end,
    -- A Google account has no password until it sets one. An email/password
    -- account always has one, so this is true exactly for the OAuth path.
    v_provider = 'google',
    v_verified
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_security on auth.users;
create trigger on_auth_user_security
  after insert on auth.users
  for each row execute function public.handle_new_user_security();

-- ---------------------------------------------------------------------------
-- Devices.
--
-- A first-party random identifier the browser generates once and keeps. It is a
-- cookie, not a fingerprint: it says "this browser profile has signed up
-- before", not "this is a particular human". The requirements are explicit that
-- one device is not one person, so a device signal is *one input* and never the
-- basis for permanent enforcement on its own.
--
-- Hashed before storage so the table is useless to anyone who steals it, and
-- given a retention window so it is not a permanent browsing history.
-- ---------------------------------------------------------------------------
create table public.device_signups (
  id            uuid primary key default gen_random_uuid(),
  device_hash   text not null,
  user_id       uuid references auth.users(id) on delete set null,
  ip_hash       text,
  outcome       text not null check (outcome in ('accepted', 'throttled', 'rejected')),
  risk_score    int not null default 0 check (risk_score >= 0),
  risk_level    text not null default 'low' check (risk_level in ('low','medium','high','confirmed')),
  created_at    timestamptz not null default now()
);

create index device_signups_device on public.device_signups (device_hash, created_at desc);
create index device_signups_ip on public.device_signups (ip_hash, created_at desc) where ip_hash is not null;
create index device_signups_time on public.device_signups (created_at);

-- ---------------------------------------------------------------------------
-- Risk events: the audit trail.
--
-- Structured, server-written, never exposed to a user. This is the record that
-- replaces the administrator dashboard the requirements forbid: an engineer with
-- database access can reconstruct exactly why an account was throttled, and
-- nobody has to watch a screen for quotas to be protected.
-- ---------------------------------------------------------------------------
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

create index risk_events_time on public.risk_events (created_at desc);
create index risk_events_user on public.risk_events (user_id, created_at desc);
create index risk_events_device on public.risk_events (device_hash, created_at desc)
  where device_hash is not null;

-- ---------------------------------------------------------------------------
-- Restrictions: the enforcement record.
--
-- Every restriction expires. There is no column for "permanent", and that is
-- deliberate: automated enforcement must be recoverable without a human, so the
-- worst automatic outcome is a bounded cooldown. A genuinely abusive account is
-- handled by repeating the cooldown, not by an unappealable ban.
-- ---------------------------------------------------------------------------
create table public.account_restrictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  device_hash text,
  kind        text not null check (kind in ('signup_block', 'upload_block', 'read_only')),
  reason      text not null,
  risk_score  int not null default 0,
  evidence    jsonb not null default '{}'::jsonb,
  expires_at  timestamptz not null,
  released_at timestamptz,
  created_at  timestamptz not null default now(),
  -- A restriction must name a subject: either an account or a device.
  check (user_id is not null or device_hash is not null)
);

create index restrictions_active_user on public.account_restrictions (user_id, expires_at)
  where released_at is null;
create index restrictions_active_device on public.account_restrictions (device_hash, expires_at)
  where released_at is null;
create index restrictions_expiry on public.account_restrictions (expires_at)
  where released_at is null;

-- ---------------------------------------------------------------------------
-- Signal collection.
--
-- Returns the raw counts the score is built from. Separated from scoring so the
-- numbers can be inspected in a support conversation without re-deriving them,
-- and so the scoring function stays a pure function of its inputs.
-- ---------------------------------------------------------------------------
create or replace function public.signup_signals(
  p_device_hash text,
  p_ip_hash     text
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pol public.abuse_policy;
  v jsonb;
begin
  select * into pol from public.abuse_policy where id;

  v := jsonb_build_object(
    'device_accounts_week', 0,
    'device_accounts_hour', 0,
    'device_accounts_day', 0,
    'ip_accounts_hour', 0,
    'ip_accounts_day', 0,
    'captcha_failures_hour', 0,
    'prior_rejections_day', 0,
    'device_has_rejection', false
  );

  if p_device_hash is not null and p_device_hash <> '' then
    v := v || jsonb_build_object(
      'device_accounts_week',
        (select count(distinct user_id) from public.device_signups
          where device_hash = p_device_hash
            and outcome = 'accepted'
            and created_at > now() - make_interval(hours => pol.device_window_hours)),
      'device_accounts_hour',
        (select count(distinct user_id) from public.device_signups
          where device_hash = p_device_hash
            and outcome = 'accepted'
            and created_at > now() - make_interval(hours => pol.burst_window_hours)),
      'device_accounts_day',
        (select count(distinct user_id) from public.device_signups
          where device_hash = p_device_hash
            and outcome = 'accepted'
            and created_at > now() - interval '24 hours'),
      'device_has_rejection',
        exists (select 1 from public.device_signups
                 where device_hash = p_device_hash
                   and outcome in ('rejected', 'throttled')
                   and created_at > now() - interval '24 hours')
    );
  end if;

  if p_ip_hash is not null and p_ip_hash <> '' then
    v := v || jsonb_build_object(
      'ip_accounts_hour',
        (select count(distinct user_id) from public.device_signups
          where ip_hash = p_ip_hash
            and outcome = 'accepted'
            and created_at > now() - make_interval(hours => pol.burst_window_hours)),
      'ip_accounts_day',
        (select count(distinct user_id) from public.device_signups
          where ip_hash = p_ip_hash
            and outcome = 'accepted'
            and created_at > now() - interval '24 hours'),
      'prior_rejections_day',
        (select count(*) from public.device_signups
          where ip_hash = p_ip_hash
            and outcome = 'rejected'
            and created_at > now() - interval '24 hours')
    );
  end if;

  v := v || jsonb_build_object(
    'captcha_failures_hour',
      (select count(*) from public.risk_events
        where kind = 'captcha_failed'
          and (p_device_hash is null or device_hash = p_device_hash
               or (p_ip_hash is not null and ip_hash = p_ip_hash))
          and created_at > now() - make_interval(hours => pol.burst_window_hours))
  );

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scoring.
--
-- Returns (score, level, reasons, signals). A pure function of the signal counts
-- and the policy row, which is what makes it testable: the same inputs always
-- produce the same band, and the reasons array names every contributing factor
-- so a decision is explainable without guesswork.
-- ---------------------------------------------------------------------------
create or replace function public.score_signup(
  p_domain_class text,
  p_signals      jsonb
) returns table (score int, level text, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  pol public.abuse_policy;
  s int := 0;
  why text[] := '{}';
  v_device_week int;
  v_device_hour int;
  v_device_day int;
  v_ip_hour int;
  v_captcha int;
  v_rejections int;
begin
  select * into pol from public.abuse_policy where id;

  v_device_week := coalesce((p_signals ->> 'device_accounts_week')::int, 0);
  v_device_hour := coalesce((p_signals ->> 'device_accounts_hour')::int, 0);
  v_device_day  := coalesce((p_signals ->> 'device_accounts_day')::int, 0);
  v_ip_hour     := coalesce((p_signals ->> 'ip_accounts_hour')::int, 0);
  v_captcha     := coalesce((p_signals ->> 'captcha_failures_hour')::int, 0);
  v_rejections  := coalesce((p_signals ->> 'prior_rejections_day')::int, 0);

  if p_domain_class = 'disposable' then
    s := s + pol.weight_disposable;
    why := why || 'disposable_email_domain'::text;
  elsif p_domain_class = 'risky' then
    s := s + pol.weight_risky_domain;
    why := why || 'risky_email_domain'::text;
  end if;

  -- More than one account on a device inside the window adds weight per extra
  -- account, capped so a large family sharing a tablet lands in "medium" rather
  -- than "confirmed".
  if v_device_week > 1 then
    s := s + least((v_device_week - 1) * pol.weight_device_week, 3 * pol.weight_device_week);
    why := why || (format('device_accounts_week:%s', v_device_week))::text;
  end if;

  if v_device_hour > 0 then
    s := s + pol.weight_device_hour;
    why := why || (format('device_burst:%s', v_device_hour))::text;
  end if;

  if v_ip_hour >= 3 then
    s := s + pol.weight_ip_hour;
    why := why || (format('ip_burst:%s', v_ip_hour))::text;
  end if;
  if v_ip_hour >= 6 then
    s := s + (pol.weight_ip_hour_many - pol.weight_ip_hour);
    why := why || 'ip_burst_severe'::text;
  end if;

  if v_captcha >= 3 then
    s := s + pol.weight_captcha_fail;
    why := why || (format('captcha_failures:%s', v_captcha))::text;
  end if;

  if v_rejections > 0 then
    s := s + pol.weight_prior_block;
    why := why || (format('prior_rejections:%s', v_rejections))::text;
  end if;

  s := greatest(0, least(100, s));

  -- Objective-evidence overrides. Each of these is a deterministic rule rather
  -- than a weight, so it sets the band outright and the additive score cannot
  -- dilute it.
  --
  -- A disposable address claiming an entitlement is the exact behaviour this
  -- system exists to stop: the domain provides no inbox anyone will ever use
  -- again, so the account cannot be verified in any meaningful sense. The
  -- signup is refused before scoring; the band is set here so the recorded
  -- evidence is consistent with the refusal.
  if p_domain_class = 'disposable' then
    s := greatest(s, pol.confirmed_threshold);
  end if;

  -- This many distinct accounts on one device in a day is not a heuristic, it is
  -- a pattern no legitimate use produces.
  if v_device_day >= pol.confirmed_device_accounts then
    s := greatest(s, pol.confirmed_threshold);
    why := why || (format('device_accounts_day:%s', v_device_day))::text;
  end if;

  score := s;
  level := case
    when s >= pol.confirmed_threshold then 'confirmed'
    when s >= pol.high_threshold      then 'high'
    when s >= pol.medium_threshold    then 'medium'
    else 'low'
  end;
  reasons := to_jsonb(why);
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Domain classification, in one place.
--
-- Unclassified domains return null, and null is handled as "no signal" rather
-- than "suspicious". That asymmetry is the safe default: a false positive costs
-- a real customer their signup, a false negative costs one extra 10 GB account
-- that the other five layers still have to carry.
-- ---------------------------------------------------------------------------
create or replace function public.classify_email_domain(p_email text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else (
      select e.classification
      from public.email_domain_risk e
      where e.domain = lower(split_part(p_email, '@', 2))
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Active restriction lookup.
-- ---------------------------------------------------------------------------
create or replace function public.active_restriction(
  p_user_id uuid,
  p_kind    text
) returns public.account_restrictions
language sql stable security definer set search_path = public as $$
  select r.* from public.account_restrictions r
  where r.kind = p_kind
    and r.released_at is null
    and r.expires_at > now()
    and (r.user_id = p_user_id or r.user_id is null)
  order by r.created_at desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- apply_signup_outcome — record the decision and enforce the band.
--
-- Idempotent in the sense that matters: calling it twice for the same signup
-- writes two events (which is accurate — there were two signups) but cannot
-- create two live restrictions of the same kind for the same subject.
-- ---------------------------------------------------------------------------
create or replace function public.apply_signup_outcome(
  p_user_id     uuid,
  p_device_hash text,
  p_ip_hash     text,
  p_score       int,
  p_level       text,
  p_reasons     jsonb,
  p_outcome     text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pol public.abuse_policy;
  v_expires timestamptz;
  v_kind text;
  v_restriction uuid;
begin
  select * into pol from public.abuse_policy where id;

  insert into public.device_signups (device_hash, user_id, ip_hash, outcome, risk_score, risk_level)
  values (p_device_hash, p_user_id, p_ip_hash, p_outcome, p_score, p_level);

  insert into public.risk_events (user_id, device_hash, ip_hash, kind, score, level, metadata)
  values (p_user_id, p_device_hash, p_ip_hash,
          case when p_outcome = 'accepted' then 'signup_accepted' else 'signup_throttled' end,
          p_score, p_level, jsonb_build_object('reasons', p_reasons, 'outcome', p_outcome));

  -- Low risk: nothing to do. Explicit rather than an empty else, so the absence
  -- of enforcement is a decision recorded in the code.
  if p_level = 'low' then
    return jsonb_build_object('restricted', false, 'level', p_level);
  end if;

  v_expires := now() + make_interval(mins => case
    when p_level = 'confirmed' then pol.confirmed_restriction_minutes
    when p_level = 'high'      then pol.high_restriction_minutes
    else pol.medium_throttle_minutes
  end);

  -- Medium risk restricts signup only. A medium band is "several signals, no
  -- proof", and the proportionate response is to slow the next registration,
  -- not to touch an account that may be perfectly ordinary.
  v_kind := case when p_level = 'medium' then 'signup_block' else 'upload_block' end;

  if p_user_id is not null then
    insert into public.account_restrictions (user_id, device_hash, kind, reason, risk_score, evidence, expires_at)
    values (p_user_id, p_device_hash, v_kind,
            array_to_string(array(select jsonb_array_elements_text(p_reasons)), ','),
            p_score, jsonb_build_object('reasons', p_reasons), v_expires)
    returning id into v_restriction;
  else
    insert into public.account_restrictions (device_hash, kind, reason, risk_score, evidence, expires_at)
    values (p_device_hash, v_kind,
            array_to_string(array(select jsonb_array_elements_text(p_reasons)), ','),
            p_score, jsonb_build_object('reasons', p_reasons), v_expires)
    returning id into v_restriction;
  end if;

  insert into public.risk_events (user_id, device_hash, ip_hash, kind, score, level, metadata)
  values (p_user_id, p_device_hash, p_ip_hash, 'restriction_applied', p_score, p_level,
          jsonb_build_object('restriction', v_restriction, 'kind', v_kind, 'expires_at', v_expires));

  return jsonb_build_object(
    'restricted', true,
    'level', p_level,
    'kind', v_kind,
    'expires_at', v_expires,
    'restriction_id', v_restriction
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Risk decay and cooldown release.
--
-- Both are callable from a scheduled job and safe to run concurrently or twice.
-- Decay is what makes the system self-healing: an account that behaved badly
-- once and then behaved normally returns to low on its own, with no review.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_restrictions()
returns int language plpgsql security definer set search_path = public as $$
declare
  pol public.abuse_policy;
  v_count int;
begin
  select * into pol from public.abuse_policy where id;

  with released as (
    update public.account_restrictions
      set released_at = now()
      where released_at is null
        and expires_at <= now()
      returning id, user_id, device_hash, kind, risk_score
  ), logged as (
    insert into public.risk_events (user_id, device_hash, kind, level, metadata)
    select user_id, device_hash, 'restriction_released', 'low',
           jsonb_build_object('restriction', id, 'kind', kind, 'score_at_release', risk_score)
    from released
    returning 1
  )
  select count(*) into v_count from released;

  return v_count;
end;
$$;

comment on function public.release_expired_restrictions() is
  'Releases every restriction whose cooldown has elapsed and logs the release. Idempotent: a released restriction is skipped by the released_at is null filter.';

-- ---------------------------------------------------------------------------
-- Quota bypass detection.
--
-- A refusal that repeats is a different thing from a refusal that happens once.
-- Three quota refusals in an hour from one account is a client retrying against a
-- limit it was told about; that is what escalates.
-- ---------------------------------------------------------------------------
create or replace function public.record_quota_violation(
  p_user_id uuid,
  p_device_hash text,
  p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pol public.abuse_policy;
  v_count int;
begin
  select * into pol from public.abuse_policy where id;

  insert into public.risk_events (user_id, device_hash, ip_hash, kind, level)
  values (p_user_id, p_device_hash, p_ip_hash, 'quota_violation', 'low');

  select count(*) into v_count
    from public.risk_events
    where user_id = p_user_id
      and kind = 'quota_violation'
      and created_at > now() - interval '1 hour';

  if v_count >= 3 and p_user_id is not null then
    insert into public.account_restrictions (user_id, device_hash, kind, reason, risk_score, expires_at)
    values (p_user_id, p_device_hash, 'upload_block', 'repeated_quota_violation',
            pol.high_threshold, now() + make_interval(mins => pol.high_restriction_minutes));

    insert into public.risk_events (user_id, device_hash, ip_hash, kind, score, level, metadata)
    values (p_user_id, p_device_hash, p_ip_hash, 'restriction_applied', pol.high_threshold, 'high',
            jsonb_build_object('kind', 'upload_block', 'reason', 'repeated_quota_violation'));

    return jsonb_build_object('restricted', true, 'violations', v_count);
  end if;

  return jsonb_build_object('restricted', false, 'violations', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Enforcement inside the reservation.
--
-- reserve_storage (0006) is replaced rather than amended, because migrations are
-- forward-only. Two checks are added and nothing else changes:
--
--   1. An unverified email has no entitlement. The 10 GB is conditional on
--      verification, and this is the single place that has to be true for every
--      upload path — none of which can skip a reservation.
--   2. An active upload restriction refuses the reservation.
--
-- The row lock and the quota arithmetic are copied verbatim. Changing the
-- concurrency behaviour of the one function that prevents overselling, inside a
-- security migration, would be reckless.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_storage(
  p_owner uuid,
  p_bytes bigint,
  p_upload uuid
) returns public.storage_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_plan_bytes bigint;
  v_row public.storage_usage;
  v_res public.storage_reservations;
  v_verified boolean;
begin
  if p_bytes is null or p_bytes <= 0 then
    raise exception 'invalid_size' using errcode = 'P0002';
  end if;

  -- Entitlement is conditional on a verified address.
  select (u.email_confirmed_at is not null) into v_verified
    from auth.users u where u.id = p_owner;
  if v_verified is null or v_verified = false then
    raise exception 'email_unverified' using errcode = 'P0004';
  end if;

  -- Cooldown from the anti-abuse layer.
  if exists (
    select 1 from public.account_restrictions r
    where r.user_id = p_owner
      and r.kind = 'upload_block'
      and r.released_at is null
      and r.expires_at > now()
  ) then
    raise exception 'abuse_restricted' using errcode = 'P0005';
  end if;

  insert into public.storage_usage (owner_id) values (p_owner)
    on conflict (owner_id) do nothing;

  select * into v_row from public.storage_usage
    where owner_id = p_owner for update;

  v_plan_bytes := public.effective_plan_bytes(p_owner);

  if v_row.committed_bytes + v_row.reserved_bytes + p_bytes > v_plan_bytes then
    raise exception 'quota_exceeded'
      using errcode = 'P0001',
            hint = format('plan allows %s bytes, %s committed, %s reserved',
                          v_plan_bytes, v_row.committed_bytes, v_row.reserved_bytes);
  end if;

  update public.storage_usage
    set reserved_bytes = reserved_bytes + p_bytes,
        updated_at = now()
    where owner_id = p_owner;

  insert into public.storage_reservations (owner_id, requested_bytes, upload_id)
    values (p_owner, p_bytes, p_upload)
    returning * into v_res;

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entitlement follows verification.
--
-- effective_plan_bytes (0006) is the single source of an account's allowance, and
-- every quota path reads it. Returning zero for an unverified address is how "do
-- not activate the full Free entitlement before verification" is enforced once,
-- rather than in each caller.
-- ---------------------------------------------------------------------------
create or replace function public.effective_plan_bytes(p_owner uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select case
    -- Unverified: no allowance at all. Not a downgrade to a smaller plan — an
    -- account that has not confirmed its address has no entitlement yet.
    when not coalesce((select u.email_confirmed_at is not null
                        from auth.users u where u.id = p_owner), false)
      then 0
    else coalesce(
      (
        select p.storage_bytes
        from public.plans p
        where p.id = coalesce(
          (
            select s.plan_id
            from public.subscriptions s
            where s.owner_id = p_owner
              and s.status in ('active', 'past_due')
            order by s.created_at desc
            limit 1
          ),
          'free'
        )
      ),
      (select storage_bytes from public.plans where id = 'free'),
      10000000000
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Every function above runs as definer and is reachable only from the
-- server, except the classifier, which the auth hook path calls.
-- ---------------------------------------------------------------------------
revoke all on function public.signup_signals(text, text) from public, anon, authenticated;
revoke all on function public.score_signup(text, jsonb) from public, anon, authenticated;
revoke all on function public.apply_signup_outcome(uuid, text, text, int, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.release_expired_restrictions() from public, anon, authenticated;
revoke all on function public.record_quota_violation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.active_restriction(uuid, text) from public, anon, authenticated;

grant execute on function public.signup_signals(text, text) to service_role;
grant execute on function public.score_signup(text, jsonb) to service_role;
grant execute on function public.apply_signup_outcome(uuid, text, text, int, text, jsonb, text) to service_role;
grant execute on function public.release_expired_restrictions() to service_role;
grant execute on function public.record_quota_violation(uuid, text, text) to service_role;
grant execute on function public.active_restriction(uuid, text) to service_role;
grant execute on function public.classify_email_domain(text) to service_role;

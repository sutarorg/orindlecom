-- 0023 — account deletion that actually works, and never leaves a read-only account.
--
-- The previous flow promised three things in the UI and the API response, and did
-- none of them:
--
--   1. "Every session is signed out." Nothing signed any session out. The person
--      stayed signed in, on every device, with a live refresh token.
--   2. "Your account becomes read-only now." Nothing enforced read-only anywhere —
--      not in middleware, not in a policy. The account was fully writable. (This
--      change removes the claim rather than building the machinery: an account on
--      its way out is better off deletable than half-usable, and a read-only state
--      that only some code paths honour is worse than none.)
--   3. "Signing in before then cancels it." Nothing checked the flag at sign-in, so
--      a person signing back in could not cancel, and their return had no effect.
--
-- The grace period and the purge job were real (0012). What was missing was every
-- observable part of the contract.

-- ---------------------------------------------------------------------------
-- 1. One definition of "due".
--
-- 0012's version returns only rows whose purge has not started. That is right for
-- the purge job, but it is the wrong question for "is this account being deleted",
-- because a claim in flight (`deletion_started_at` set) would read as "live". The
-- purge job keeps using the 0012 function unchanged; this one answers the status
-- question for both the customer and the sign-in path.
-- ---------------------------------------------------------------------------
create or replace function public.deletion_status(p_user uuid)
returns table (
  requested_at timestamptz,
  purge_on     timestamptz,
  grace_days   int
)
language sql
security definer
stable
set search_path = public, pg_temp
as $fn$
  select
    p.deletion_requested_at,
    p.deletion_requested_at + make_interval(days => 7),
    7
  from public.profiles p
  where p.id = p_user
    and p.deletion_requested_at is not null;
$fn$;

revoke all on function public.deletion_status(uuid) from public, anon;
grant execute on function public.deletion_status(uuid) to authenticated, service_role;

comment on function public.deletion_status(uuid) is
  'Pending deletion for one account, with the purge date. Null rows mean the account is live.';

/*
 * The caller's own pending deletion.
 *
 * Wrapped rather than exposing `deletion_status` alone so the argument cannot be
 * another person's id: this takes no argument at all and resolves `auth.uid()`
 * itself. A deletion request is private — whether an account is being deleted is
 * not something one customer should be able to ask about another.
 */
create or replace function public.my_deletion_status()
returns table (
  requested_at timestamptz,
  purge_on     timestamptz,
  grace_days   int
)
language sql
security definer
stable
set search_path = public, pg_temp
as $fn$
  select * from public.deletion_status(auth.uid());
$fn$;

revoke all on function public.my_deletion_status() from public, anon;
grant execute on function public.my_deletion_status() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Requesting deletion tells the truth about what happens next.
--
-- Setting the timestamp is still all this does — nothing is deleted, and the purge
-- job reads the same column it always did. What changed is that the caller now gets
-- the purge instant from the database rather than from a date computed in the
-- application, so the promise and the job cannot drift apart.
--
-- Requesting twice is idempotent and does NOT restart the clock: a second click
-- must not buy another seven days, or the queue could be postponed indefinitely.
-- ---------------------------------------------------------------------------
create or replace function public.request_account_deletion()
returns table (
  requested_at timestamptz,
  purge_on     timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.profiles
    set deletion_requested_at = coalesce(deletion_requested_at, now())
    where id = v_uid;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  return query
    select p.deletion_requested_at, p.deletion_requested_at + make_interval(days => 7)
    from public.profiles p
    where p.id = v_uid;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Cancelling is a real, recorded act.
--
-- Clears the request and the purge claim, so an account that was mid-purge at the
-- moment of cancellation returns to the queue rather than being deleted while the
-- customer is looking at a confirmation. (The purge is bounded per run and the
-- window is small, but "I cancelled it and it deleted anyway" is the one outcome
-- this feature must never produce.)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.profiles
    set deletion_requested_at = null,
        deletion_started_at = null
    where id = v_uid;
end;
$$;

revoke all on function public.cancel_account_deletion() from public, anon;
grant execute on function public.cancel_account_deletion() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Who to email about a purge.
--
-- The purge job deletes the auth user, which removes the profile and every other
-- row, before the "account deleted" notice is sent. So the address has to be read
-- before deletion, and it has to come from `auth.users`, not from the profile.
-- Service role only: this is an operator-shaped read, not a customer one.
-- ---------------------------------------------------------------------------
create or replace function public.pending_deletion_emails(p_limit int default 50)
returns table (owner_id uuid, email text, purge_on timestamptz)
language sql
security definer
stable
set search_path = public, pg_temp
as $fn$
  select p.id, u.email::text, p.deletion_requested_at + make_interval(days => 7)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.deletion_requested_at is not null
    and p.deletion_started_at is null
    and u.email is not null
  order by p.deletion_requested_at
  limit p_limit;
$fn$;

revoke all on function public.pending_deletion_emails(int) from public, anon, authenticated;
grant execute on function public.pending_deletion_emails(int) to service_role;

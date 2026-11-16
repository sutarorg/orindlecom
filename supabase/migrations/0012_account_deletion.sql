-- Account deletion, with a grace period.
--
-- Deleting an account is the one irreversible action in the product, and the honest
-- engineering problem is not "how do we delete" but "how do we avoid deleting the
-- wrong thing because someone's session was borrowed".
--
-- So the flow is two-stage:
--   1. A deletion REQUEST marks the profile. Nothing is removed. Every session is
--      signed out, the account is read-only, and a confirmation email explains how
--      to cancel. This is what the API returns immediately.
--   2. After the grace period, the purge job deletes storage objects and then the
--      rows. A row deleted before its object leaves unreferenced bytes; an object
--      deleted before its row leaves a broken download. Order matters even here.
--
-- The grace period is the same idea as the trash: a mistake should be recoverable.

alter table public.profiles
  add column if not exists deletion_requested_at timestamptz,
  -- Set when the purge job has removed everything it can. Present so a retry can tell
  -- "not started" from "partly done".
  add column if not exists deletion_started_at timestamptz;

comment on column public.profiles.deletion_requested_at is
  'When the owner asked for deletion. Null means the account is live. Set by POST /api/users/me/delete.';

create index if not exists profiles_pending_deletion
  on public.profiles (deletion_requested_at)
  where deletion_requested_at is not null;

-- Everyone with a deletion request pending, for the purge job.
create or replace function public.pending_account_deletions(p_grace_days int default 7)
returns table (owner_id uuid, requested_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $fn$
  select p.id, p.deletion_requested_at
  from public.profiles p
  where p.deletion_requested_at is not null
    and p.deletion_started_at is null
    and p.deletion_requested_at < now() - make_interval(days => p_grace_days)
  order by p.deletion_requested_at
  limit 100;
$fn$;

revoke all on function public.pending_account_deletions(int) from public, anon, authenticated;
grant execute on function public.pending_account_deletions(int) to service_role;

-- Recoverable cancellation. Clearing the timestamp is all it takes, which is the
-- point: an irreversible action should need one more deliberate step than this.
comment on function public.pending_account_deletions(int) is
  'Accounts whose deletion grace period has elapsed and whose purge has not started.';

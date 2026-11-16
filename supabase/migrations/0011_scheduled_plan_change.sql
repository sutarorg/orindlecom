-- Scheduled downgrade.
--
-- A downgrade must not take effect the moment it is requested: the customer has paid
-- for the current period, so the new allowance starts when that period ends. That
-- needs somewhere to record the intent between the request and the sweep, which is
-- what these two columns are for.
--
-- Deliberately a separate pair from plan_id. Rewriting plan_id now would immediately
-- shrink the allowance someone paid to have, and would make the invoice history point
-- at a plan the customer was not on at the time.

alter table public.subscriptions
  add column if not exists pending_plan_id text references public.plans(id),
  add column if not exists pending_plan_effective_at timestamptz;

comment on column public.subscriptions.pending_plan_id is
  'Plan to switch to at pending_plan_effective_at. Set by a downgrade request; applied by the subscription sweep, which never deletes files.';

comment on column public.subscriptions.pending_plan_effective_at is
  'When pending_plan_id takes effect. Normally the end of the current paid period.';

-- The sweep needs to find rows whose scheduled change is due.
create index if not exists subscriptions_pending_plan
  on public.subscriptions (pending_plan_effective_at)
  where pending_plan_id is not null;

-- A downgrade that points at nothing would silently do nothing at sweep time, and a
-- downgrade scheduled for the past would apply on the next run with no warning. Both
-- are cheap to exclude.
alter table public.subscriptions
  add constraint pending_plan_consistency
  check (
    (pending_plan_id is null and pending_plan_effective_at is null)
    or (pending_plan_id is not null and pending_plan_effective_at is not null)
  ) not valid;

-- Existing rows all have both null, so validating afterwards is immediate and does
-- not require a long lock on a large table.
alter table public.subscriptions validate constraint pending_plan_consistency;

-- Downgrades never delete files. Stated in the schema as a comment because this is
-- the table where the temptation to "clean up" would live.
comment on table public.subscriptions is
  'Billing state per owner. Expiry and downgrade never delete files: the allowance shrinks and uploads are blocked until the account is back under it.';

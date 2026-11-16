-- 0017 — platform administration.
--
-- There are now TWO permission systems in this database and confusing them is the
-- single most dangerous mistake available in this feature:
--
--   public.members.role     owner/admin/member  — membership of a CUSTOMER's org
--   public.platform_admins.role  owner/admin    — control of the ORINDLE platform
--
-- A business Owner is a customer with extra rights inside their own organization.
-- They get nothing here. The two are joined by nothing and share no helper, on
-- purpose: the moment one function answers both questions, a business owner is one
-- refactor away from being a platform administrator.

-- ---------------------------------------------------------------------------
-- Platform administrators
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- Deliberately NOT the org role names. 'owner' here means control of Orindle
  -- itself: granting access, platform settings, price configuration.
  role       text not null check (role in ('owner', 'admin')),
  is_active  boolean not null default true,
  -- Nullable for the bootstrap row, which by definition has no prior
  -- administrator to attribute it to. Every later grant names its grantor.
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create trigger platform_admins_touch before update on public.platform_admins
  for each row execute function public.touch_updated_at();

create index platform_admins_active on public.platform_admins (user_id)
  where is_active;

-- A disabled row must record when. Checked rather than assumed so a UI that sets
-- is_active = false without a timestamp fails loudly instead of leaving an
-- administrator with no audit trail.
alter table public.platform_admins add constraint platform_admins_disabled_at
  check ((is_active and disabled_at is null) or (not is_active and disabled_at is not null));

-- ---------------------------------------------------------------------------
-- "At least one active owner" — enforced in the database, not in a form handler.
--
-- The requirement is "protect against removing or disabling the last active
-- platform owner". A server-side check in the route is not enough: two
-- simultaneous revocations each see one remaining owner and both succeed. A
-- deferred constraint trigger re-checks at COMMIT, after every statement in the
-- transaction, which is the only place the invariant can actually hold.
-- ---------------------------------------------------------------------------
create or replace function public.assert_platform_owner_exists()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.platform_admins where role = 'owner' and is_active) then
    return null;
  end if;
  raise exception 'last_platform_owner' using
    detail = 'The platform must always have at least one active owner.',
    hint = 'Grant ownership to another account before revoking this one.';
end;
$$;

-- A constraint trigger must be FOR EACH ROW. The function ignores NEW/OLD
-- entirely and asks the same global question every time ("is there any active
-- owner left"), so firing it per row is merely more calls, never a different
-- answer. Statement-level would be the natural fit but is not permitted on a
-- deferred constraint trigger.
create constraint trigger platform_admins_keep_owner
  after insert or update or delete on public.platform_admins
  deferrable initially deferred
  for each row execute function public.assert_platform_owner_exists();

-- ---------------------------------------------------------------------------
-- Read the caller's own administrator record.
--
-- SECURITY DEFINER with a fixed search_path, because the alternative is a policy
-- on platform_admins that queries platform_admins for every row of every table
-- that wants to know "is this person an administrator", which recurses.
--
-- It answers one question, about one person: the caller. It cannot enumerate.
-- ---------------------------------------------------------------------------
create or replace function public.current_platform_role()
returns text language sql stable security definer set search_path = public as $$
  select pa.role
  from public.platform_admins pa
  where pa.user_id = auth.uid()
    and pa.is_active
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Operator audit log
--
-- Append-only by construction: no UPDATE or DELETE grant exists for any client
-- role, and the service role has no policy permitting either. Historic records
-- must stay readable for as long as they are retained, which is the whole point
-- of an audit trail.
-- ---------------------------------------------------------------------------
create table public.platform_admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null check (action in (
    'admin.granted', 'admin.role_changed', 'admin.revoked', 'admin.exported',
    'support.status_changed', 'support.assigned', 'support.replied',
    'support.note_added'
  )),
  target_type text not null check (target_type in ('platform_admin', 'support_ticket')),
  target_id   uuid,
  -- Safe, structured detail. Never a message body, never a token, never a
  -- customer's private content: this table is read by operators, not by a
  -- privacy-preserving pipeline, so what goes in has to be safe standing alone.
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index admin_audit_time on public.platform_admin_audit_logs (created_at desc);
create index admin_audit_actor on public.platform_admin_audit_logs (actor_id, created_at desc);
create index admin_audit_target on public.platform_admin_audit_logs (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Support ticket workflow
--
-- `delivery_status` on support_requests describes whether the NOTIFICATION EMAIL
-- was accepted by Resend. It says nothing about whether a human has answered.
-- These are different facts and they get different columns, because a single
-- status column would have to mean both and would therefore lie about one.
-- ---------------------------------------------------------------------------
alter table public.support_requests
  add column ticket_status text not null default 'open'
    check (ticket_status in ('open', 'in_progress', 'resolved')),
  add column submitter_name text,
  add column assigned_to uuid references auth.users(id) on delete set null,
  add column resolved_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add column reference text;

-- A short human-quotable reference, e.g. ORD-7K2M4Q. Generated in the database so
-- no code path can forget it. `substr(md5(...))` is hex, so the alphabet is
-- unambiguous already; the length keeps collisions negligible at any realistic
-- volume, and the unique index turns a collision into a retry rather than a bug.
update public.support_requests
   set reference = 'ORD-' || upper(substr(md5(id::text), 1, 8))
 where reference is null;

alter table public.support_requests
  alter column reference set not null,
  -- A DEFAULT, not a trigger: a code path that forgets to supply a reference is
  -- the failure mode, and a default cannot be forgotten.
  alter column reference set default ('ORD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  add constraint support_requests_reference_key unique (reference);

create index support_status on public.support_requests (ticket_status, created_at desc);
create index support_open on public.support_requests (created_at desc)
  where ticket_status <> 'resolved';

create trigger support_requests_touch before update on public.support_requests
  for each row execute function public.touch_updated_at();

-- Replies and internal notes.
--
-- One table, discriminated by `visibility`, rather than two tables that must be
-- kept in sync. The internal-note case is the one that must never leak, so it is
-- a CHECK constraint and a single visible predicate rather than a join order
-- somebody has to get right.
create table public.support_messages (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.support_requests(id) on delete cascade,
  author_id    uuid references auth.users(id) on delete set null,
  visibility   text not null check (visibility in ('public', 'internal')),
  body         text not null check (length(btrim(body)) between 1 and 4000),
  -- Delivery state of *this reply* to the customer. An internal note is never
  -- emailed, so it is 'not_applicable' rather than a misleading 'pending'.
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'delivered', 'failed', 'not_applicable')),
  provider_message_id text,
  delivery_error text,
  created_at   timestamptz not null default now(),
  constraint support_messages_note_not_emailed
    check (visibility = 'public' or delivery_status = 'not_applicable')
);

create index support_messages_request on public.support_messages (request_id, created_at);

-- ---------------------------------------------------------------------------
-- Billing period
--
-- activateSubscription() took a `period`, used it to compute period_end, and
-- stored it nowhere. After activation the information was gone, so MRR could only
-- have been computed by assuming a period — which is invented revenue.
--
-- Nullable on purpose. A backfill is only defensible where evidence proves the
-- period (an invoice amount matching an approved price exactly); where it does
-- not, null means "unknown" and MRR excludes the row instead of guessing.
-- ---------------------------------------------------------------------------
alter table public.subscriptions
  add column billing_period text
    check (billing_period in ('monthly', 'yearly'));

comment on column public.subscriptions.billing_period is
  'Server-verified billing period of the current term. NULL = unknown; MRR excludes rather than infers.';

-- Backfill only on exact evidence: one approved price row for the plan and
-- currency, and an invoice for this subscription whose amount equals it.
update public.subscriptions s
   set billing_period = pp.period
  from public.plan_prices pp
 where s.billing_period is null
   and pp.plan_id = s.plan_id
   and pp.currency = s.currency
   and pp.approved
   and exists (
     select 1 from public.invoices i
      where i.subscription_id = s.id
        and i.status = 'paid'
        and i.amount_minor = pp.amount_minor
   )
   -- More than one approved period at the same amount would be ambiguous, and an
   -- ambiguous backfill is a guess. Require a unique match.
   and (
     select count(*) from public.plan_prices q
      where q.plan_id = s.plan_id and q.currency = s.currency and q.approved
        and q.amount_minor = pp.amount_minor
   ) = 1;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.platform_admin_audit_logs enable row level security;
alter table public.support_messages enable row level security;

-- A client may read its OWN administrator row and nothing else. Self-promotion
-- is impossible: there is no INSERT, UPDATE or DELETE policy at all, so the
-- table is writable only by the service role or through the definer functions
-- below.
--
-- This policy existing is what makes the admin guard honest: the guard asks the
-- user-scoped client "is there an active row for me", and RLS guarantees that
-- question can only ever return the caller's own record.
create policy platform_admins_select_self on public.platform_admins
  for select to authenticated using (user_id = auth.uid());

-- Grants, following the convention 0009 established: a client gets zero rows
-- rather than a permission error, so a client cannot tell the table is there.
grant select on public.platform_admins to authenticated, anon;
grant select on public.platform_admin_audit_logs, public.support_messages to authenticated;
grant select on public.support_requests to authenticated;

grant select, insert, update, delete on public.platform_admins,
  public.support_messages to service_role;
-- Audit log: read and append. No UPDATE or DELETE grant, because the record of
-- what an operator did must not be editable by an operator.
grant select, insert on public.platform_admin_audit_logs to service_role;

revoke all on function public.current_platform_role() from public;
grant execute on function public.current_platform_role() to authenticated, service_role;

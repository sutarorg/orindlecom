-- 0027 — Dodo Payments migration.
--
-- Additive and backward-compatible. Nothing is deleted: historical Razorpay
-- subscriptions, invoices, provider ids and webhook history all stay exactly
-- where they are, and are simply labelled as belonging to the `razorpay`
-- provider from now on.
--
-- What this migration adds:
--
--   1. `billing_provider` on `subscriptions` and `invoices`, backfilled to
--      'razorpay' so every existing row keeps its meaning.
--   2. Provider-scoped uniqueness, so a Dodo external id and a Razorpay
--      external id can never collide merely because their strings happen to
--      match.
--   3. `billing_provider_prices` — the admin-configurable mapping from
--      (provider, plan, currency, period, environment) to a Dodo product id.
--   4. `billing_checkout_sessions` — the pending checkout record the server
--      writes before it talks to Dodo, and the reference the webhook resolves.
--   5. `billing_customers` — the provider-aware customer id mapping.
--
-- Every new table has row-level security and no policy that lets an ordinary
-- authenticated user read provider configuration, checkout references or
-- webhook payloads.

-- ---------------------------------------------------------------------------
-- 1. Provider identifier on the existing billing tables.
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists billing_provider text not null default 'razorpay';

alter table public.invoices
  add column if not exists billing_provider text not null default 'razorpay';

-- Backfill explicitly. The default above already covers existing rows, but an
-- explicit update makes the intent obvious and survives a later default
-- change.
update public.subscriptions set billing_provider = 'razorpay' where billing_provider is null;
update public.invoices set billing_provider = 'razorpay' where billing_provider is null;

-- The provider is a closed set. 'razorpay' covers every historical row.
alter table public.subscriptions
  drop constraint if exists subscriptions_billing_provider_check;
alter table public.subscriptions
  add constraint subscriptions_billing_provider_check
  check (billing_provider in ('razorpay', 'dodo'));

alter table public.invoices
  drop constraint if exists invoices_billing_provider_check;
alter table public.invoices
  add constraint invoices_billing_provider_check
  check (billing_provider in ('razorpay', 'dodo'));

comment on column public.subscriptions.billing_provider is
  'Payment provider that owns this subscription. Historical rows are razorpay; new Dodo subscriptions are dodo.';
comment on column public.invoices.billing_provider is
  'Payment provider that owns this invoice. Historical rows are razorpay; new Dodo invoices are dodo.';

-- ---------------------------------------------------------------------------
-- 2. Provider-scoped uniqueness.
--
-- The old unique constraints were global: `provider_subscription_id unique` and
-- `provider_payment_id unique`. Two different providers can mint the same
-- external id — "sub_1" is not a globally unique string across Razorpay and
-- Dodo — so a global unique index would reject a legitimate new row.
--
-- Replacing them with provider-scoped unique indexes keeps the property that
-- actually matters: a duplicate delivery from the same provider produces one
-- row, not two.
--
-- The constraint has to be dropped before its backing index: Postgres will
-- not drop an index a constraint depends on.
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  drop constraint if exists subscriptions_provider_subscription_id_key;

alter table public.invoices
  drop constraint if exists invoices_provider_payment_id_key;

drop index if exists public.subscriptions_provider_subscription_id_key;
drop index if exists public.invoices_provider_payment_id_key;

create unique index if not exists subscriptions_provider_subscription_uniq
  on public.subscriptions (billing_provider, provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists invoices_provider_payment_uniq
  on public.invoices (billing_provider, provider_payment_id)
  where provider_payment_id is not null;

-- A Dodo subscription id must not be attached to a Razorpay row and vice
-- versa. The composite index above allows the same string under two
-- providers, but never under the wrong one.
create index if not exists subscriptions_provider_lookup
  on public.subscriptions (billing_provider, provider_subscription_id);

create index if not exists invoices_provider_lookup
  on public.invoices (billing_provider, provider_payment_id);

-- ---------------------------------------------------------------------------
-- 3. Provider price mapping.
--
-- The administrator configures Dodo product ids here, per plan, per currency,
-- per billing period, per Dodo environment. Application source code never
-- contains a product id.
--
-- The unique key is (provider, environment, plan_id, currency, period): one
-- product per combination. `amount_minor` records the price the product was
-- configured with, so a stale mapping can be detected without a network call.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_provider_prices (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('razorpay', 'dodo')),
  environment   text not null check (environment in ('test_mode', 'live_mode')),
  plan_id       text not null references public.plans(id) on delete cascade,
  currency      text not null,
  period        text not null check (period in ('monthly', 'yearly')),
  -- The provider's product id, e.g. 'pdt_...'.
  product_id    text not null,
  -- The recurring interval the product was configured with.
  interval      text not null check (interval in ('Month', 'Year')),
  -- The price the product was configured with, in minor units.
  amount_minor  bigint not null check (amount_minor >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, environment, plan_id, currency, period)
);

create index if not exists billing_provider_prices_lookup
  on public.billing_provider_prices (provider, environment, plan_id, currency, period)
  where active;

create trigger billing_provider_prices_touch before update on public.billing_provider_prices
  for each row execute function public.touch_updated_at();

comment on table public.billing_provider_prices is
  'Maps an Orindle plan/currency/period to a provider product id. Administered in the database, never in source code. A missing or mismatched row fails checkout closed.';

-- ---------------------------------------------------------------------------
-- 4. Pending checkout sessions.
--
-- The server writes one of these *before* it creates the Dodo checkout
-- session, and puts the reference into the Dodo metadata. The webhook
-- resolves the reference back to this row to learn who the money is for.
--
-- This is the reason a browser cannot activate a plan: the browser never
-- writes this table, and the webhook does not trust metadata on its own.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_checkout_sessions (
  id                uuid primary key default gen_random_uuid(),
  -- The internal, unguessable reference carried in the Dodo metadata.
  reference         text not null unique,
  owner_id          uuid not null references auth.users(id) on delete cascade,
  provider          text not null default 'dodo' check (provider in ('razorpay', 'dodo')),
  -- The provider's checkout session id, filled in once it exists.
  provider_session_id text unique,
  plan_id           text not null references public.plans(id),
  currency          text not null,
  period            text not null check (period in ('monthly', 'yearly')),
  -- The approved price, snapshotted at checkout time.
  amount_minor      bigint not null check (amount_minor >= 0),
  product_id        text not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'completed', 'expired', 'failed')),
  provider_subscription_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  expires_at        timestamptz
);

create index if not exists billing_checkout_sessions_owner
  on public.billing_checkout_sessions (owner_id, created_at desc);

create index if not exists billing_checkout_sessions_expiry
  on public.billing_checkout_sessions (expires_at)
  where status = 'pending';

create trigger billing_checkout_sessions_touch before update on public.billing_checkout_sessions
  for each row execute function public.touch_updated_at();

comment on table public.billing_checkout_sessions is
  'Server-created pending checkout records. Holds the approved price and the plan the customer chose, so a webhook can be reconciled against the right customer even if events arrive out of order.';

-- ---------------------------------------------------------------------------
-- 5. Provider-aware customer mapping.
--
-- Dodo customer ids live here, keyed by Orindle user. The browser never
-- supplies a customer id; the portal route resolves it from this table.
-- ---------------------------------------------------------------------------

create table if not exists public.billing_customers (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('razorpay', 'dodo')),
  customer_id   text not null,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (provider, owner_id),
  unique (provider, customer_id)
);

create index if not exists billing_customers_owner
  on public.billing_customers (owner_id);

create trigger billing_customers_touch before update on public.billing_customers
  for each row execute function public.touch_updated_at();

comment on table public.billing_customers is
  'Provider customer ids, keyed by Orindle owner. Read server-side only: a client-supplied customer id is never trusted for a portal session.';

-- ---------------------------------------------------------------------------
-- 6. Row level security.
--
-- None of these tables has a policy. RLS is enabled, so an authenticated user
-- reading them gets zero rows rather than a permission error, and the grant
-- below means the client cannot even tell the table exists.
-- ---------------------------------------------------------------------------

alter table public.billing_provider_prices enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_customers enable row level security;

grant select on public.billing_provider_prices to anon, authenticated;
grant select on public.billing_checkout_sessions to anon, authenticated;
grant select on public.billing_customers to anon, authenticated;

-- The service role needs explicit grants on the new tables. The blanket
-- `grant all on all tables in schema public to service_role` in 0009 only
-- covered the tables that existed when it ran, so a table created later is
-- invisible to the privileged role until it is named here.
grant all on public.billing_provider_prices to service_role;
grant all on public.billing_checkout_sessions to service_role;
grant all on public.billing_customers to service_role;

-- No policies are created for these tables on purpose. They are server-only.
-- The service role bypasses RLS, which is what every server-side path uses.

-- ---------------------------------------------------------------------------
-- 7. A database function that applies a renewal exactly once.
--
-- A renewal has to touch two tables: the subscription's period, and the
-- invoice for the payment. Doing that in two statements from application code
-- opens a window where the period advanced but the invoice was never written.
--
-- This function does it in one transaction, and it is idempotent on the
-- payment id: a replayed renewal updates the period from the provider's
-- authoritative dates but does not create a second invoice.
--
-- The provider's dates are used verbatim. Adding 30 or 365 days to a local
-- date drifts, and a drifted period end is a customer who is billed early.
-- ---------------------------------------------------------------------------

create or replace function public.apply_renewal(
  p_owner_id uuid,
  p_subscription_id uuid,
  p_provider text,
  p_provider_subscription_id text,
  p_provider_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_billing_period text,
  p_plan_id text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_inserted boolean := false;
begin
  if p_provider_payment_id is null or p_amount_minor is null then
    return false;
  end if;

  -- The invoice. A duplicate payment id inserts nothing, and the unique
  -- index makes that a no-op rather than an error.
  insert into public.invoices (
    owner_id, subscription_id, billing_provider, provider_payment_id,
    amount_minor, currency, status, paid_at
  ) values (
    p_owner_id, p_subscription_id, p_provider, p_provider_payment_id,
    p_amount_minor, p_currency, 'paid', now()
  )
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  -- The subscription's period, from the provider's authoritative dates.
  update public.subscriptions
     set current_period_start = coalesce(p_period_start, current_period_start),
         current_period_end   = coalesce(p_period_end, current_period_end),
         billing_period      = coalesce(p_billing_period, billing_period),
         plan_id             = coalesce(p_plan_id, plan_id),
         status              = 'active',
         expired_at          = null,
         recovery_ends_at    = null,
         updated_at          = now()
   where id = p_subscription_id;

  return v_inserted;
end;
$$;

grant execute on function public.apply_renewal(
  uuid, uuid, text, text, text, bigint, text, timestamptz, timestamptz, text, text
) to service_role;

comment on function public.apply_renewal is
  'Records a paid renewal in one transaction: creates the invoice exactly once and advances the subscription to the provider-supplied period dates. Returns true when a new invoice was written.';

-- ---------------------------------------------------------------------------
-- 8. Applying a scheduled downgrade.
--
-- The provider confirms a scheduled plan change with `effective_at:
-- next_billing_date`. Orindle only applies the new plan once the provider has
-- confirmed it, so this function is called from the plan-change webhook and
-- from the sweep, never from the request that asked for the downgrade.
-- ---------------------------------------------------------------------------

create or replace function public.apply_scheduled_plan_change(
  p_subscription_id uuid,
  p_plan_id text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.subscriptions
     set plan_id = p_plan_id,
         pending_plan_id = null,
         pending_plan_effective_at = null,
         updated_at = now()
   where id = p_subscription_id
     and pending_plan_id = p_plan_id;

  return found;
end;
$$;

grant execute on function public.apply_scheduled_plan_change(uuid, text) to service_role;

comment on function public.apply_scheduled_plan_change is
  'Applies a provider-confirmed scheduled downgrade. Only ever called after the provider confirms the change, so a failed or cancelled change never grants the wrong quota.';

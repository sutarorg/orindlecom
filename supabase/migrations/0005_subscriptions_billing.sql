-- 0007 — subscriptions, invoices, webhook events.

create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  plan_id        text not null references public.plans(id),
  -- Fixed for the life of the subscription: moving country does not silently
  -- re-price someone mid-term.
  currency       text not null,
  status         text not null default 'none'
                 check (status in ('none','active','past_due','cancelled','expired')),
  -- Unique so a duplicate webhook cannot create a second row.
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Expiry never deletes anything. This is the start of the recovery window.
  expired_at       timestamptz,
  recovery_ends_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index subscriptions_owner on public.subscriptions (owner_id);
create index subscriptions_sweep on public.subscriptions (current_period_end)
  where status in ('active','past_due');

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Only one live subscription per owner. Enforced in the database so a race
-- between two checkouts cannot produce two active plans.
create unique index subscriptions_one_live on public.subscriptions (owner_id)
  where status in ('active','past_due');

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  -- Unique: a duplicate webhook delivery produces one invoice, not two.
  provider_payment_id text unique,
  amount_minor        bigint not null check (amount_minor >= 0),
  currency            text not null,
  status              text not null check (status in ('paid','failed','refunded')),
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index invoices_owner on public.invoices (owner_id, created_at desc);

create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null default 'razorpay',
  -- The provider's event id. Unique: a replay is a no-op.
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  -- Stored raw BEFORE processing, so a failing handler can be replayed.
  processed_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (provider, event_id)
);

create index webhook_unprocessed on public.webhook_events (created_at)
  where processed_at is null;

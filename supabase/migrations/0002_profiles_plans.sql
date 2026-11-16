-- 0002 — profiles, plans and prices.
--
-- Plans and prices are data, not constants, so the checkout path resolves an
-- amount by query rather than by trusting anything the client sent.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  locale       text not null default 'en',
  country_code text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile always exists for a user. Doing this in the database means no sign-up
-- path can forget it, including OAuth and any future provider.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id            text primary key,
  name          text not null,
  -- Decimal bytes. 10 GB = 10,000,000,000.
  storage_bytes bigint not null check (storage_bytes >= 0),
  sort_order    int not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.plan_prices (
  id           uuid primary key default gen_random_uuid(),
  plan_id      text not null references public.plans(id) on delete cascade,
  currency     text not null,
  period       text not null check (period in ('monthly', 'yearly')),
  -- Minor units (paise/cents) as an integer. Money is never a float.
  amount_minor bigint not null check (amount_minor >= 0),
  -- Only an approved row may be used to create an order. This column is what
  -- makes "do not activate unapproved prices" enforceable in one query.
  approved     boolean not null default false,
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (plan_id, currency, period)
);

create table public.currencies (
  code      text primary key,
  symbol    text not null,
  minor_unit int not null default 2,
  -- False means the currency is known but not sold. It exists so the code can
  -- reason about it without being able to price anything in it.
  published boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Seed: the approved prices, and nothing else.
--
-- INR/USD monthly only. There are deliberately NO yearly rows: annual pricing
-- has not been approved, so checkout cannot find a yearly amount to charge.
-- GBP/EUR/AED/SGD/AUD/CAD are seeded unpublished with no prices.
-- ---------------------------------------------------------------------------
insert into public.plans (id, name, storage_bytes, sort_order) values
  ('free',    'Free',    10000000000,  1),
  ('basic',   'Basic',   100000000000, 2),
  ('plus',    'Plus',    500000000000, 3),
  ('premium', 'Premium', 1000000000000, 4),
  ('ultra',   'Ultra',   5000000000000, 5),
  ('max',     'Max',     10000000000000, 6);

insert into public.currencies (code, symbol, minor_unit, published) values
  ('INR', '₹', 2, true),
  ('USD', '$', 2, true),
  ('GBP', '£', 2, false),
  ('EUR', '€', 2, false),
  ('AED', 'د.إ', 2, false),
  ('SGD', 'S$', 2, false),
  ('AUD', 'A$', 2, false),
  ('CAD', 'C$', 2, false);

insert into public.plan_prices (plan_id, currency, period, amount_minor, approved, approved_at) values
  ('free',    'INR', 'monthly',     0, true, now()),
  ('free',    'USD', 'monthly',     0, true, now()),
  ('basic',   'INR', 'monthly',  7900, true, now()),
  ('basic',   'USD', 'monthly',   149, true, now()),
  ('plus',    'INR', 'monthly', 19900, true, now()),
  ('plus',    'USD', 'monthly',   399, true, now()),
  ('premium', 'INR', 'monthly', 34900, true, now()),
  ('premium', 'USD', 'monthly',   699, true, now()),
  ('ultra',   'INR', 'monthly', 99900, true, now()),
  ('ultra',   'USD', 'monthly',  1999, true, now()),
  ('max',     'INR', 'monthly',199900, true, now()),
  ('max',     'USD', 'monthly',  3999, true, now());

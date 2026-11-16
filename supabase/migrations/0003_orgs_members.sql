-- 0003 — organizations and membership, plus the definer functions that make
-- organization policies possible without RLS recursion.
--
-- A policy on `members` that queries `members` recurses. Every org-scoped
-- policy therefore calls is_org_member() or org_role(), which are SECURITY
-- DEFINER and read the table directly.

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  slug       text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$'),
  -- ON DELETE RESTRICT: deleting a user must not silently orphan an org that
  -- other people are members of. Ownership has to be transferred first.
  owner_id   uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

create table public.members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete cascade,
  email           text not null,
  role            text not null check (role in ('owner', 'admin', 'member')),
  status          text not null default 'invited'
                  check (status in ('invited', 'active', 'suspended', 'removed')),
  invited_by      uuid references auth.users(id) on delete set null,
  invite_token    text unique,
  invite_expires_at timestamptz,
  joined_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, email)
);

create index members_user on public.members (user_id) where status = 'active';
create index members_org on public.members (organization_id);

create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers. SECURITY DEFINER so the lookup itself is not filtered by
-- the members policies (which would recurse).
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.members
    where organization_id = p_org
      and user_id = p_user
      and status = 'active'
  );
$$;

create or replace function public.org_role(p_org uuid, p_user uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from public.members
  where organization_id = p_org
    and user_id = p_user
    and status = 'active'
  limit 1;
$$;

-- Admin or owner.
create or replace function public.can_administer_org(p_org uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.org_role(p_org, p_user) in ('owner', 'admin'), false);
$$;

create or replace function public.is_org_owner(p_org uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(public.org_role(p_org, p_user) = 'owner', false);
$$;

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.org_role(uuid, uuid) to authenticated;
grant execute on function public.can_administer_org(uuid, uuid) to authenticated;
grant execute on function public.is_org_owner(uuid, uuid) to authenticated;

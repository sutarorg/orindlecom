-- 0019 — Approved 8-currency monthly & annual pricing, updated 2 TB / 5 TB
-- tiers, and Business Workspace organization & folder columns + atomic
-- ownership transfer.
--
-- Applies cleanly on top of 0001..0018 without adding any new unprotected
-- tables (all columns extend existing RLS-protected tables).

-- ---------------------------------------------------------------------------
-- 1. Updated storage tiers: Ultra 5 TB -> 2 TB, Max 10 TB -> 5 TB.
-- ---------------------------------------------------------------------------
update public.plans set storage_bytes = 2000000000000 where id = 'ultra';
update public.plans set storage_bytes = 5000000000000 where id = 'max';

-- ---------------------------------------------------------------------------
-- 2. Publish all 8 approved currencies.
-- ---------------------------------------------------------------------------
update public.currencies
set published = true
where code in ('INR', 'USD', 'GBP', 'EUR', 'AED', 'SGD', 'AUD', 'CAD');

update public.currencies set symbol = 'AED ' where code = 'AED';

-- ---------------------------------------------------------------------------
-- 3. Upsert all 6 plans x 8 currencies x 2 periods (monthly + 20% off yearly).
--    Yearly amount_minor is the exact annual charge (= monthly_equiv * 12) so
--    Razorpay checkout charges the full annual total and admin_mrr() divides
--    by 12 cleanly with zero remainder.
-- ---------------------------------------------------------------------------
insert into public.plan_prices (plan_id, currency, period, amount_minor, approved, approved_at) values
  -- Free (10 GB)
  ('free', 'INR', 'monthly', 0, true, now()),
  ('free', 'USD', 'monthly', 0, true, now()),
  ('free', 'GBP', 'monthly', 0, true, now()),
  ('free', 'EUR', 'monthly', 0, true, now()),
  ('free', 'AED', 'monthly', 0, true, now()),
  ('free', 'SGD', 'monthly', 0, true, now()),
  ('free', 'AUD', 'monthly', 0, true, now()),
  ('free', 'CAD', 'monthly', 0, true, now()),
  ('free', 'INR', 'yearly',  0, true, now()),
  ('free', 'USD', 'yearly',  0, true, now()),
  ('free', 'GBP', 'yearly',  0, true, now()),
  ('free', 'EUR', 'yearly',  0, true, now()),
  ('free', 'AED', 'yearly',  0, true, now()),
  ('free', 'SGD', 'yearly',  0, true, now()),
  ('free', 'AUD', 'yearly',  0, true, now()),
  ('free', 'CAD', 'yearly',  0, true, now()),

  -- Basic (100 GB)
  ('basic', 'INR', 'monthly',  9900, true, now()),
  ('basic', 'USD', 'monthly',   109, true, now()),
  ('basic', 'GBP', 'monthly',    99, true, now()),
  ('basic', 'EUR', 'monthly',    99, true, now()),
  ('basic', 'AED', 'monthly',   399, true, now()),
  ('basic', 'SGD', 'monthly',   149, true, now()),
  ('basic', 'AUD', 'monthly',   159, true, now()),
  ('basic', 'CAD', 'monthly',   159, true, now()),
  ('basic', 'INR', 'yearly',  94800, true, now()),
  ('basic', 'USD', 'yearly',   1044, true, now()),
  ('basic', 'GBP', 'yearly',    948, true, now()),
  ('basic', 'EUR', 'yearly',    948, true, now()),
  ('basic', 'AED', 'yearly',   3828, true, now()),
  ('basic', 'SGD', 'yearly',   1428, true, now()),
  ('basic', 'AUD', 'yearly',   1524, true, now()),
  ('basic', 'CAD', 'yearly',   1524, true, now()),

  -- Plus (500 GB)
  ('plus', 'INR', 'monthly',  54900, true, now()),
  ('plus', 'USD', 'monthly',    599, true, now()),
  ('plus', 'GBP', 'monthly',    449, true, now()),
  ('plus', 'EUR', 'monthly',    549, true, now()),
  ('plus', 'AED', 'monthly',   2199, true, now()),
  ('plus', 'SGD', 'monthly',    749, true, now()),
  ('plus', 'AUD', 'monthly',    899, true, now()),
  ('plus', 'CAD', 'monthly',    849, true, now()),
  ('plus', 'INR', 'yearly',  526800, true, now()),
  ('plus', 'USD', 'yearly',    5748, true, now()),
  ('plus', 'GBP', 'yearly',    4308, true, now()),
  ('plus', 'EUR', 'yearly',    5268, true, now()),
  ('plus', 'AED', 'yearly',   21108, true, now()),
  ('plus', 'SGD', 'yearly',    7188, true, now()),
  ('plus', 'AUD', 'yearly',    8628, true, now()),
  ('plus', 'CAD', 'yearly',    8148, true, now()),

  -- Premium (1 TB — Most Popular)
  ('premium', 'INR', 'monthly',  109900, true, now()),
  ('premium', 'USD', 'monthly',    1199, true, now()),
  ('premium', 'GBP', 'monthly',     899, true, now()),
  ('premium', 'EUR', 'monthly',    1099, true, now()),
  ('premium', 'AED', 'monthly',    4299, true, now()),
  ('premium', 'SGD', 'monthly',    1499, true, now()),
  ('premium', 'AUD', 'monthly',    1749, true, now()),
  ('premium', 'CAD', 'monthly',    1699, true, now()),
  ('premium', 'INR', 'yearly',  1054800, true, now()),
  ('premium', 'USD', 'yearly',    11508, true, now()),
  ('premium', 'GBP', 'yearly',     8628, true, now()),
  ('premium', 'EUR', 'yearly',    10548, true, now()),
  ('premium', 'AED', 'yearly',    41268, true, now()),
  ('premium', 'SGD', 'yearly',    14388, true, now()),
  ('premium', 'AUD', 'yearly',    16788, true, now()),
  ('premium', 'CAD', 'yearly',    16308, true, now()),

  -- Ultra (2 TB)
  ('ultra', 'INR', 'monthly',  219900, true, now()),
  ('ultra', 'USD', 'monthly',    2399, true, now()),
  ('ultra', 'GBP', 'monthly',    1799, true, now()),
  ('ultra', 'EUR', 'monthly',    2149, true, now()),
  ('ultra', 'AED', 'monthly',    8599, true, now()),
  ('ultra', 'SGD', 'monthly',    3099, true, now()),
  ('ultra', 'AUD', 'monthly',    3499, true, now()),
  ('ultra', 'CAD', 'monthly',    3399, true, now()),
  ('ultra', 'INR', 'yearly',  2110800, true, now()),
  ('ultra', 'USD', 'yearly',    23028, true, now()),
  ('ultra', 'GBP', 'yearly',    17268, true, now()),
  ('ultra', 'EUR', 'yearly',    20628, true, now()),
  ('ultra', 'AED', 'yearly',    82548, true, now()),
  ('ultra', 'SGD', 'yearly',    29748, true, now()),
  ('ultra', 'AUD', 'yearly',    33588, true, now()),
  ('ultra', 'CAD', 'yearly',    32628, true, now()),

  -- Max (5 TB)
  ('max', 'INR', 'monthly',  559900, true, now()),
  ('max', 'USD', 'monthly',    5999, true, now()),
  ('max', 'GBP', 'monthly',    4499, true, now()),
  ('max', 'EUR', 'monthly',    5499, true, now()),
  ('max', 'AED', 'monthly',   21999, true, now()),
  ('max', 'SGD', 'monthly',    7699, true, now()),
  ('max', 'AUD', 'monthly',    8999, true, now()),
  ('max', 'CAD', 'monthly',    8499, true, now()),
  ('max', 'INR', 'yearly',  5374800, true, now()),
  ('max', 'USD', 'yearly',    57588, true, now()),
  ('max', 'GBP', 'yearly',    43188, true, now()),
  ('max', 'EUR', 'yearly',    52788, true, now()),
  ('max', 'AED', 'yearly',   211188, true, now()),
  ('max', 'SGD', 'yearly',    73908, true, now()),
  ('max', 'AUD', 'yearly',    86388, true, now()),
  ('max', 'CAD', 'yearly',    81588, true, now())
on conflict (plan_id, currency, period) do update
set
  amount_minor = excluded.amount_minor,
  approved = excluded.approved,
  approved_at = excluded.approved_at;

-- ---------------------------------------------------------------------------
-- 4. Business Workspace columns on existing RLS-protected tables.
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists initials text,
  add column if not exists default_folder_access text not null default 'viewer'
    check (default_folder_access in ('viewer', 'commenter', 'editor'));

alter table public.folders
  add column if not exists open_to_organization boolean not null default true,
  add column if not exists default_access text not null default 'viewer'
    check (default_access in ('viewer', 'commenter', 'editor'));

alter table public.members
  add column if not exists invited_folder_id uuid references public.folders(id) on delete set null,
  add column if not exists invited_folder_access text
    check (invited_folder_access is null or invited_folder_access in ('viewer', 'commenter', 'editor'));

-- Allow org admins/owners to also delete shared org folders under RLS.
drop policy if exists folders_delete on public.folders;
create policy folders_delete on public.folders
  for delete to authenticated
  using (
    owner_id = auth.uid()
    or (organization_id is not null and public.can_administer_org(organization_id, auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 5. Atomic ownership transfer RPC.
--    Swaps the existing owner to 'admin', promotes the target active member to
--    'owner', and updates organizations.owner_id in a single transaction so an
--    organization can never become ownerless or hold two owners.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_org_ownership(
  p_org uuid,
  p_actor uuid,
  p_target_member uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_owner uuid;
  v_target_user uuid;
  v_target_status text;
  v_target_role text;
begin
  select owner_id into v_org_owner
    from public.organizations
   where id = p_org
   for update;

  if v_org_owner is null then
    raise exception 'org_not_found';
  end if;

  if v_org_owner <> p_actor or not public.is_org_owner(p_org, p_actor) then
    raise exception 'forbidden';
  end if;

  select user_id, status, role into v_target_user, v_target_status, v_target_role
    from public.members
   where id = p_target_member
     and organization_id = p_org
   for update;

  if v_target_user is null or v_target_status <> 'active' then
    raise exception 'target_not_active';
  end if;

  if v_target_user = p_actor then
    raise exception 'already_owner';
  end if;

  -- Demote current owner to admin, promote target to owner, update org.owner_id.
  update public.members
     set role = 'admin', updated_at = now()
   where organization_id = p_org
     and user_id = p_actor
     and role = 'owner';

  update public.members
     set role = 'owner', updated_at = now()
   where id = p_target_member
     and organization_id = p_org;

  update public.organizations
     set owner_id = v_target_user, updated_at = now()
   where id = p_org;

  return p_target_member;
end;
$$;

grant execute on function public.transfer_org_ownership(uuid, uuid, uuid) to service_role;

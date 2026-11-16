-- 0009 — Row Level Security.
--
-- Every table: RLS enabled, default deny, then explicit policies. A table with
-- RLS enabled and no policy is readable by nobody, which is the correct default;
-- a table with RLS disabled is readable by everybody, which is how leaks ship.
--
-- Policies are the BACKSTOP. The application checks first; these policies are
-- what still holds when an application query is written against the wrong client
-- six months from now.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere, including tables that only the service role touches.
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.plans                 enable row level security;
alter table public.plan_prices           enable row level security;
alter table public.currencies            enable row level security;
alter table public.organizations         enable row level security;
alter table public.members               enable row level security;
alter table public.folders               enable row level security;
alter table public.files                 enable row level security;
alter table public.storage_usage         enable row level security;
alter table public.storage_reservations  enable row level security;
alter table public.upload_sessions       enable row level security;
alter table public.share_grants          enable row level security;
alter table public.share_links           enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.invoices              enable row level security;
alter table public.webhook_events        enable row level security;
alter table public.activity_events       enable row level security;
alter table public.support_requests      enable row level security;
alter table public.email_log             enable row level security;
alter table public.rate_limits           enable row level security;

-- Table-level privileges. RLS narrows rows; grants decide whether the role can
-- address the table at all. Both are needed.
grant select on public.plans, public.plan_prices, public.currencies to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations, public.members,
  public.folders, public.files, public.share_grants, public.share_links,
  public.upload_sessions to authenticated;
grant select on public.storage_usage, public.storage_reservations to authenticated;
grant select on public.subscriptions, public.invoices to authenticated;
-- Tables that are "visible to nobody" still get a grant, deliberately.
--
-- With RLS enabled and no permissive policy these return zero rows. If the grant
-- were withheld instead, a client would receive a permission error — a different
-- code path, a different message, and a hint that the table exists. Zero rows is
-- the honest answer to "may I see this?", and it keeps every read path uniform:
-- you always get the rows you are allowed to see.
grant select on public.webhook_events, public.support_requests,
  public.email_log, public.rate_limits to authenticated;
grant select on public.files to anon;
grant select on public.support_requests, public.webhook_events to anon;
grant select on public.activity_events to authenticated;

-- The service role bypasses RLS but is still a role: it needs privileges.
-- Privileged background work (cleanup jobs, webhooks, invite lookups) runs as
-- this role, and none of it may be blocked by a missing grant.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- ---------------------------------------------------------------------------
-- profiles: own row only.
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Reference data: readable by anyone, writable by nobody but the service role.
-- `using (true)` is acceptable here precisely because the content is a public
-- price list.
-- ---------------------------------------------------------------------------
create policy plans_read on public.plans
  for select to anon, authenticated using (true);
create policy plan_prices_read on public.plan_prices
  for select to anon, authenticated using (true);
create policy currencies_read on public.currencies
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy orgs_select_member on public.organizations
  for select to authenticated
  using (public.is_org_member(id, auth.uid()) or owner_id = auth.uid());

create policy orgs_insert_owner on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());

create policy orgs_update_admin on public.organizations
  for update to authenticated
  using (public.can_administer_org(id, auth.uid()))
  with check (public.can_administer_org(id, auth.uid()));

create policy orgs_delete_owner on public.organizations
  for delete to authenticated
  using (public.is_org_owner(id, auth.uid()));

-- ---------------------------------------------------------------------------
-- members
--
-- A member may see the members of orgs they belong to. Only admins and owners
-- may change anything. Nobody may promote themselves: the role a caller may
-- assign is checked in the application, and the RLS policy additionally forbids
-- a non-admin from writing at all.
-- ---------------------------------------------------------------------------
create policy members_select_member on public.members
  for select to authenticated
  using (public.is_org_member(organization_id, auth.uid()));

-- An invitee can find their own pending row by email without being a member yet.
create policy members_select_self_invite on public.members
  for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy members_insert_admin on public.members
  for insert to authenticated
  with check (public.can_administer_org(organization_id, auth.uid()));

create policy members_update_admin on public.members
  for update to authenticated
  using (public.can_administer_org(organization_id, auth.uid()))
  with check (public.can_administer_org(organization_id, auth.uid()));

create policy members_delete_admin on public.members
  for delete to authenticated
  using (public.can_administer_org(organization_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- folders
--
-- Visible when owned, or when a live grant exists, or to org members. Only the
-- owner (or an org admin) may write.
-- ---------------------------------------------------------------------------
create policy folders_select on public.folders
  for select to authenticated
  using (public.has_folder_access(id, auth.uid()));

create policy folders_insert on public.folders
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      organization_id is null
      or public.is_org_member(organization_id, auth.uid())
    )
  );

create policy folders_update on public.folders
  for update to authenticated
  using (
    owner_id = auth.uid()
    or (organization_id is not null and public.can_administer_org(organization_id, auth.uid()))
  )
  with check (
    owner_id = auth.uid()
    or (organization_id is not null and public.can_administer_org(organization_id, auth.uid()))
  );

create policy folders_delete on public.folders
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- files
--
-- The important one: a file is only visible when it is available. A pending row
-- is invisible to every read path, so an unverified upload can never be listed
-- or downloaded, even by its owner.
-- ---------------------------------------------------------------------------
create policy files_select on public.files
  for select to authenticated
  using (status = 'available' and public.has_file_access(id, auth.uid()));

create policy files_insert on public.files
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and status = 'pending'
    and (
      organization_id is null
      or public.is_org_member(organization_id, auth.uid())
    )
  );

-- The owner may update their own rows. An editor with a grant may not: renaming
-- someone else's file is not an editor capability.
create policy files_update on public.files
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy files_delete on public.files
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- storage accounting: read your own, write nothing. Writes go through the
-- security-definer functions and the service role only.
-- ---------------------------------------------------------------------------
create policy usage_select_own on public.storage_usage
  for select to authenticated using (owner_id = auth.uid());

create policy reservations_select_own on public.storage_reservations
  for select to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- upload sessions: your own only.
-- ---------------------------------------------------------------------------
create policy uploads_select_own on public.upload_sessions
  for select to authenticated using (owner_id = auth.uid());
create policy uploads_insert_own on public.upload_sessions
  for insert to authenticated with check (owner_id = auth.uid());
create policy uploads_update_own on public.upload_sessions
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sharing
-- ---------------------------------------------------------------------------
create policy grants_select on public.share_grants
  for select to authenticated
  using (
    grantee_id = auth.uid()
    or granted_by = auth.uid()
    or exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
    or exists (select 1 from public.folders d where d.id = folder_id and d.owner_id = auth.uid())
  );

-- Only the owner of the item may grant access to it.
create policy grants_insert on public.share_grants
  for insert to authenticated
  with check (
    granted_by = auth.uid()
    and (
      exists (select 1 from public.files f where f.id = file_id and f.owner_id = auth.uid())
      or exists (select 1 from public.folders d where d.id = folder_id and d.owner_id = auth.uid())
    )
  );

create policy grants_update on public.share_grants
  for update to authenticated
  using (granted_by = auth.uid()) with check (granted_by = auth.uid());

create policy grants_delete on public.share_grants
  for delete to authenticated using (granted_by = auth.uid());

create policy links_select_creator on public.share_links
  for select to authenticated using (created_by = auth.uid());
create policy links_insert_creator on public.share_links
  for insert to authenticated with check (created_by = auth.uid());
create policy links_update_creator on public.share_links
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy links_delete_creator on public.share_links
  for delete to authenticated using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- BILLING IS PRIVATE.
--
-- subscriptions and invoices are readable by their owner and nobody else.
-- Organization administration grants NO access to another person's payment
-- history, and there is deliberately no policy that would allow it.
-- ---------------------------------------------------------------------------
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (owner_id = auth.uid());

create policy invoices_select_own on public.invoices
  for select to authenticated using (owner_id = auth.uid());

-- webhook_events: no policy at all. Service role only. RLS is enabled, so an
-- authenticated select returns zero rows rather than a permission error.

-- ---------------------------------------------------------------------------
-- activity: your own, plus anything in an org you belong to.
-- ---------------------------------------------------------------------------
create policy activity_select on public.activity_events
  for select to authenticated
  using (
    actor_id = auth.uid()
    or (organization_id is not null and public.is_org_member(organization_id, auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- support_requests: NOT publicly readable.
--
-- There is no select policy for anon or authenticated. Submitters are anonymous
-- or may be signed in, but either way the row is not readable back through the
-- API: there is nothing here a person could usefully read that does not also
-- expose another person's message. Reads happen in the support inbox, through
-- the service role.
-- ---------------------------------------------------------------------------
-- (no policies)

-- email_log: service role only. No policies.
-- rate_limits: service role only. No policies.

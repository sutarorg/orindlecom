-- ---------------------------------------------------------------------------
-- 0024 — the drive's read paths, the trash, and shares that reach people.
--
-- Five customer-visible failures, four of them in the read path. They are in one
-- migration because they are one story: things that must be visible were being
-- filtered out, and things that must be writable were going through a route that
-- could not carry them.
--
--   1. Trash was always empty. `has_file_access` / `has_folder_access` required
--      `deleted_at is null`, so the moment a row was trashed it stopped being
--      visible to the very policy that governs reading it. `list(scope: trash)`
--      then asked for exactly the rows the policy hides, and got nothing.
--   2. A folder could not be starred at all. `folders` has no `starred` column,
--      so the UI's star action was a no-op for every folder.
--   3. Moving a file into a folder silently unhid it. `files_update`'s USING
--      clause is evaluated against the CURRENT row, and `files_select` hides
--      pending rows; a write that asks for the row back therefore matched zero
--      rows whenever the source row was not readable. Same class of bug as 0022.
--   4. A confirmation link only worked in the browser that signed up. The email
--      carries a PKCE code that needs a verifier cookie; the durable fix is a
--      token the server can verify on its own, which has to be stored per user.
--   5. Sharing with someone who has no account produced nothing. A grant needs a
--      `grantee_id`, and an invitation to an address with no account had nowhere
--      to live, so the recipient was simply never reached.
--
-- ── What is NOT widened ─────────────────────────────────────────────────────
-- Trashing must not become a way to read someone else's hidden file, and undoing
-- a trash must not become a way to touch a row you do not own. So access to a
-- trashed row is granted only to the person who may restore it — its owner, or an
-- org administrator — not to a grantee who happened to have view access while it
-- was live. The `status = 'available'` rule on files is untouched.

-- ---------------------------------------------------------------------------
-- 1. Nothing is widened.
--
-- The obvious fix for the empty bin is to relax `has_file_access` so it stops
-- requiring `deleted_at is null`. That is wrong, and it is wrong in a way that
-- would be hard to see: `has_file_access` is the single gate behind listing,
-- previewing and *downloading*. Loosening it would make every trashed file
-- downloadable by everyone who holds a stale grant, turning "delete" into "hide
-- from the owner only". It would also leak pending rows, since the same function
-- enforces `status = 'available'`.
--
-- So the access functions from 0007 are left exactly as they are, and the bin is
-- read through a function that answers a different question — "what did *I*
-- delete" — scoped to the caller. See section 3.

-- ---------------------------------------------------------------------------
-- 2. Folders can be starred.
-- ---------------------------------------------------------------------------
alter table public.folders
  add column if not exists starred boolean not null default false;

create index if not exists folders_starred on public.folders (owner_id)
  where starred and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. List the bin.
--
-- A SECURITY INVOKER function would hit the same wall the policy does, so this is
-- definer — but it establishes the caller from auth.uid() and filters on it, so it
-- can only ever return the caller's own trashed rows. Items come back in one
-- result set with a `kind` discriminator, so the caller needs no second query.
-- ---------------------------------------------------------------------------
create or replace function public.list_trash()
returns table (
  id uuid,
  kind text,
  name text,
  size_bytes bigint,
  mime_type text,
  category text,
  folder_id uuid,
  parent_id uuid,
  starred boolean,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select f.id, 'file'::text, f.name, f.size_bytes, f.mime_type, f.category,
         f.folder_id, null::uuid, f.starred, f.deleted_at, f.created_at, f.updated_at
  from public.files f
  where f.owner_id = auth.uid()
    and f.deleted_at is not null
    and f.status = 'available'
  union all
  select d.id, 'folder'::text, d.name, null::bigint, 'inode/directory'::text, 'other'::text,
         null::uuid, d.parent_id, d.starred, d.deleted_at, d.created_at, d.updated_at
  from public.folders d
  where d.owner_id = auth.uid()
    and d.deleted_at is not null
  -- Newest deletion first: "what did I just delete" is the question the bin
  -- answers, and an alphabetical bin buries it.
  order by 10 desc;
$$;

grant execute on function public.list_trash() to authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Restore, and empty the bin.
--
-- Same wall as the listing, in the other direction. `update files set
-- deleted_at = null` reads the row it is about to change, and an ordinary owner
-- cannot read a trashed row — that is the point of section 1. So restore and purge
-- have to be definer functions too, with the owner check inside. Without them the
-- Restore button in the bin is a button that does nothing, which is a worse bug
-- than an empty bin: it looks like the file came back.
--
-- Purge refuses a live row. Deleting something permanently must never be the
-- accidental result of a double-click on the wrong row.
-- ---------------------------------------------------------------------------
create or replace function public.restore_items(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.files set deleted_at = null
   where id = any(p_ids) and owner_id = v_uid and deleted_at is not null;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  update public.folders set deleted_at = null
   where id = any(p_ids) and owner_id = v_uid and deleted_at is not null;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

create or replace function public.purge_items(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  -- Names are freed by the delete itself; storage objects are reclaimed by the
  -- caller, which owns the bucket credentials and must not be reachable from SQL.
  delete from public.files
   where id = any(p_ids) and owner_id = v_uid and deleted_at is not null;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  delete from public.folders
   where id = any(p_ids) and owner_id = v_uid and deleted_at is not null;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  return v_count;
end;
$$;

grant execute on function public.restore_items(uuid[]) to authenticated;
grant execute on function public.purge_items(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Star a folder.
--
-- A plain UPDATE cannot be used for the same reason 0022 exists: the RETURNING
-- row has to satisfy `folders_select`, and an owner's own live folder does — but
-- going through one function keeps both item kinds on one code path and keeps the
-- owner check next to the write.
-- ---------------------------------------------------------------------------
create or replace function public.set_folder_star(p_folder uuid, p_starred boolean)
returns public.folders
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.folders;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  update public.folders
     set starred = coalesce(p_starred, false)
   where id = p_folder and owner_id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

comment on function public.set_folder_star(uuid, boolean) is
  'Sets a folder''s star for its owner. Definer so the returned row is not filtered by folders_select.';

grant execute on function public.set_folder_star(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Move items.
--
-- Both halves are definer functions for the reason in 0022: `update ... returning`
-- is subject to SELECT policy, and a file that is mid-flight (pending) or whose
-- folder is unreadable would otherwise match zero rows and silently not move.
--
-- Moving a folder into itself or a descendant is refused here rather than in the
-- handler, because a handler-side check races a concurrent move of the same pair.
-- ---------------------------------------------------------------------------
create or replace function public.move_folder(p_folder uuid, p_parent uuid)
returns public.folders
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.folders;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  perform 1 from public.folders
    where id = p_folder and owner_id = v_uid and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_parent is not null then
    perform 1 from public.folders
      where id = p_parent and owner_id = v_uid and deleted_at is null;
    if not found then
      raise exception 'parent_not_found' using errcode = 'P0002';
    end if;

    if p_parent = p_folder then
      raise exception 'cycle' using errcode = '23514';
    end if;

    -- Walk up from the target: if we reach the folder being moved, the move would
    -- detach the subtree.
    if exists (
      with recursive ancestors as (
        select f.id, f.parent_id from public.folders f where f.id = p_parent
        union all
        select f.id, f.parent_id
        from public.folders f
        join ancestors a on f.id = a.parent_id
      )
      select 1 from ancestors where id = p_folder
    ) then
      raise exception 'cycle' using errcode = '23514';
    end if;
  end if;

  update public.folders
     set parent_id = p_parent
   where id = p_folder and owner_id = v_uid
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.move_file(p_file uuid, p_folder uuid)
returns public.files
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.files;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if p_folder is not null then
    perform 1 from public.folders
      where id = p_folder and owner_id = v_uid and deleted_at is null;
    if not found then
      raise exception 'parent_not_found' using errcode = 'P0002';
    end if;
  end if;

  update public.files
     set folder_id = p_folder
   where id = p_file and owner_id = v_uid and deleted_at is null
  returning * into v_row;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.move_folder(uuid, uuid) to authenticated;
grant execute on function public.move_file(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. A server-verifiable confirmation token.
--
-- `auth.users` is not writable from this schema and must not be. This table holds
-- the one thing verifyOtp needs — a hashed token with a type and an expiry — for
-- the user it belongs to. Only the service role touches it; the customer never
-- reads their own token, because a readable token is not a secret.
-- ---------------------------------------------------------------------------
create table if not exists public.email_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  -- sha256 of the token. The token itself only ever exists in the sent email.
  token_hash  text not null unique,
  token_type  text not null default 'signup'
              check (token_type in ('signup','recovery','invite','email_change','magiclink')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_verifications_user on public.email_verifications (user_id);
create index if not exists email_verifications_live on public.email_verifications (user_id, token_type)
  where used_at is null;

alter table public.email_verifications enable row level security;
-- No policy at all: rows are visible to nobody through the anon/authenticated
-- roles. Verification is a server-side exchange, so there is no client read path
-- that should exist. The service role bypasses RLS and is the only writer.
revoke all on public.email_verifications from anon, authenticated;
grant all on public.email_verifications to service_role;

-- ---------------------------------------------------------------------------
-- 7. Invite someone who has no account yet.
--
-- The old path resolved an email to a user id and gave up if there was none, so a
-- share to a stranger was impossible. An invitation records the intent now; the
-- address is claimed when that person signs up (a trigger), or immediately if an
-- account already exists.
--
-- The token is what the email links to. It is unguessable, single-use per email,
-- and expires, because an invitation that never expires is a permanent key to a
-- folder someone may have long stopped sharing.
-- ---------------------------------------------------------------------------
create table if not exists public.share_invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  file_id      uuid references public.files(id) on delete cascade,
  folder_id    uuid references public.folders(id) on delete cascade,
  permission   text not null default 'viewer'
               check (permission in ('viewer','commenter','editor')),
  token        text not null unique,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  created_at   timestamptz not null default now(),
  constraint invitation_target_exclusive check (
    (file_id is not null) <> (folder_id is not null)
  )
);

create index if not exists share_invitations_email on public.share_invitations (lower(email))
  where accepted_at is null and revoked_at is null;
create index if not exists share_invitations_token on public.share_invitations (token);

alter table public.share_invitations enable row level security;

/*
 * Table privileges, then RLS narrows rows — the same two-step the rest of the
 * schema uses. Without the grant, `claim_share_invitations` (definer, but still
 * executing as the caller's role for privilege purposes) was denied before any
 * policy ran, so an invitation could never be claimed.
 *
 * No INSERT grant: invitations are created by the service role, because creating
 * one requires resolving an address the inviter must not be able to enumerate.
 */
grant select, update on public.share_invitations to authenticated;
grant all on public.share_invitations to service_role;

-- The sender may see and revoke what they sent, so a mistaken invite is fixable.
create policy invitations_select_sender on public.share_invitations
  for select to authenticated using (invited_by = auth.uid());
create policy invitations_revoke_sender on public.share_invitations
  for update to authenticated
  using (invited_by = auth.uid()) with check (invited_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. Claim invitations when the invited person finally signs up.
--
-- SECURITY DEFINER because it writes share_grants on behalf of the inviter, which
-- the new account could not do itself. It only ever claims invitations addressed
-- to that account's own verified address.
-- ---------------------------------------------------------------------------
create or replace function public.claim_share_invitations()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_claimed integer := 0;
  v_row public.share_invitations;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = v_uid;

  -- An unconfirmed address could be someone else's. Claiming on it would hand a
  -- stranger access to files meant for the real owner of that address.
  if v_email is null or v_confirmed is null then
    return 0;
  end if;

  for v_row in
    select * from public.share_invitations i
     where lower(i.email) = v_email
       and i.accepted_at is null
       and i.revoked_at is null
       and i.expires_at > now()
  loop
    insert into public.share_grants (file_id, folder_id, grantee_id, granted_by, permission)
    values (v_row.file_id, v_row.folder_id, v_uid, v_row.invited_by, v_row.permission)
    on conflict do nothing;

    update public.share_invitations
       set accepted_at = now()
     where id = v_row.id;

    v_claimed := v_claimed + 1;
  end loop;

  return v_claimed;
end;
$$;

grant execute on function public.claim_share_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. What is shared with me, and what have I shared out.
--
-- One function for the /dashboard/shared page. "Shared with me" includes items
-- someone granted me directly and items reachable through a link I opened, which
-- is a grant row in both cases. Owner is resolved so the row can say who shared it.
-- ---------------------------------------------------------------------------
create or replace function public.list_shared()
returns table (
  id uuid,
  kind text,
  name text,
  size_bytes bigint,
  mime_type text,
  category text,
  starred boolean,
  owned boolean,
  owner_name text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql security definer stable set search_path = public as $$
  -- Files I can see through a grant.
  select f.id, 'file'::text, f.name, f.size_bytes, f.mime_type, f.category,
         f.starred, false, coalesce(p.full_name, ''), f.created_at, f.updated_at
  from public.share_grants g
  join public.files f on f.id = g.file_id
  left join public.profiles p on p.id = f.owner_id
  where g.grantee_id = auth.uid()
    and (g.expires_at is null or g.expires_at > now())
    and f.deleted_at is null and f.status = 'available'
  union all
  -- Folders I can see through a grant.
  select d.id, 'folder'::text, d.name, null::bigint, 'inode/directory'::text, 'other'::text,
         d.starred, false, coalesce(p.full_name, ''), d.created_at, d.updated_at
  from public.share_grants g
  join public.folders d on d.id = g.folder_id
  left join public.profiles p on p.id = d.owner_id
  where g.grantee_id = auth.uid()
    and (g.expires_at is null or g.expires_at > now())
    and d.deleted_at is null
  union all
  -- Files I have shared out to somebody.
  select f.id, 'file'::text, f.name, f.size_bytes, f.mime_type, f.category,
         f.starred, true, null::text, f.created_at, f.updated_at
  from public.files f
  where f.owner_id = auth.uid()
    and f.deleted_at is null and f.status = 'available'
    and (
      exists (select 1 from public.share_grants g
               where g.file_id = f.id and (g.expires_at is null or g.expires_at > now()))
      or exists (select 1 from public.share_invitations i
                  where i.file_id = f.id and i.revoked_at is null and i.accepted_at is null
                    and i.expires_at > now())
      or exists (select 1 from public.share_links l
                  where l.file_id = f.id and l.revoked_at is null and l.expires_at > now())
    )
  order by 10 desc;
$$;

grant execute on function public.list_shared() to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Resolve a share link for an anonymous visitor.
--
-- The /s/[token] page is the only unauthenticated read of file metadata in the
-- product, so it is deliberately narrow: the token must exist, be unexpired, and
-- be unrevoked, and the response carries only what a preview needs. No owner id,
-- no folder structure, no list of anything else.
--
-- Returns zero rows when the token is not usable, which is the correct answer to
-- "may I see this" — a distinct error would confirm that a guessed token nearly
-- worked.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_share_link(p_token text)
returns table (
  id uuid,
  kind text,
  name text,
  size_bytes bigint,
  mime_type text,
  category text,
  permission text,
  owner_name text,
  expires_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select f.id, 'file'::text, f.name, f.size_bytes, f.mime_type, f.category,
         l.permission, coalesce(p.full_name, ''), l.expires_at
  from public.share_links l
  join public.files f on f.id = l.file_id
  left join public.profiles p on p.id = f.owner_id
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
    and f.deleted_at is null
    and f.status = 'available'
  union all
  select d.id, 'folder'::text, d.name, null::bigint, 'inode/directory'::text, 'other'::text,
         l.permission, coalesce(p.full_name, ''), l.expires_at
  from public.share_links l
  join public.folders d on d.id = l.folder_id
  left join public.profiles p on p.id = d.owner_id
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
    and d.deleted_at is null;
$$;

-- Anonymous visitors must be able to resolve a link to a file. That is what a
-- share link is. Nothing else is granted to them by this function.
grant execute on function public.resolve_share_link(text) to anon, authenticated;

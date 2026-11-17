-- ---------------------------------------------------------------------------
-- 0025 — sharing has two levels, not three: view and comment.
--
-- "Can edit" is removed from the product. It was the one share level that let a
-- recipient change the owner's bytes, and it carried a whole surface with it: a
-- public text editor on `/s/<token>`, a write route behind it, and a third option
-- in two different selectors (drive sharing and organisation folders).
--
-- ── Why the constraint has to change too ────────────────────────────────────
-- Dropping the app's "Can edit" option while leaving `'editor'` legal in the
-- database would leave a value that nothing can create and nothing can render:
-- the selectors read their options from a label map, so an existing `'editor'`
-- grant would appear in the access list as `undefined` — a blank row the owner
-- cannot reason about. So existing grants are converted (to `commenter`, which is
-- the closest capability that survives: editing's read-and-respond half) and then
-- the check constraints are narrowed, which makes the removal enforced rather than
-- merely unrendered.
--
-- Converting *up* to `commenter` rather than *down* to `viewer` is deliberate: it
-- takes nothing away from the recipient except the ability to write. Downgrading
-- someone who was collaborating on a document to view-only would silently remove
-- a capability they were still using.
--
-- ── What is NOT changed ─────────────────────────────────────────────────────
-- `has_file_access(id, user, 'editor')` is left in place. It is a general access
-- predicate, not a UI surface, and other code (and future code) may still ask
-- "does this person hold write access" — the answer is now `false` for every
-- grantee, which is exactly the new rule. Removing the argument would be a
-- signature change across every caller for no behavioural difference.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Convert every existing editor grant before the constraint narrows.
-- ---------------------------------------------------------------------------

update public.share_grants
   set permission = 'commenter'
 where permission = 'editor';

update public.share_links
   set permission = 'commenter'
 where permission = 'editor';

update public.share_invitations
   set permission = 'commenter'
 where permission = 'editor';

update public.organizations
   set default_folder_access = 'commenter'
 where default_folder_access = 'editor';

update public.folders
   set default_access = 'commenter'
 where default_access = 'editor';

update public.members
   set invited_folder_access = 'commenter'
 where invited_folder_access = 'editor';

-- ---------------------------------------------------------------------------
-- 2. Narrow the constraints.
--
-- Each of these constraints was created inline with the table, so it has a
-- generated name. They are found by what they constrain rather than by a guessed
-- name, and then recreated with the two-level list.
-- ---------------------------------------------------------------------------

do $$
declare
  c record;
begin
  for c in
    select con.conname, rel.relname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and con.contype = 'c'
       and rel.relname in ('share_grants', 'share_links', 'share_invitations',
                           'organizations', 'folders', 'members')
       and pg_get_constraintdef(con.oid) like '%editor%'
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
  end loop;
end $$;

alter table public.share_grants
  add constraint share_grants_permission_check
  check (permission in ('viewer', 'commenter'));

alter table public.share_links
  add constraint share_links_permission_check
  check (permission in ('viewer', 'commenter'));

alter table public.share_invitations
  add constraint share_invitations_permission_check
  check (permission in ('viewer', 'commenter'));

alter table public.organizations
  add constraint organizations_default_folder_access_check
  check (default_folder_access in ('viewer', 'commenter'));

alter table public.folders
  add constraint folders_default_access_check
  check (default_access in ('viewer', 'commenter'));

alter table public.members
  add constraint members_invited_folder_access_check
  check (invited_folder_access is null or invited_folder_access in ('viewer', 'commenter'));

-- ---------------------------------------------------------------------------
-- 3. Re-declare `has_file_access` with the two-level list.
--
-- The body is 0007's, unchanged, except for the grant clause: `p_min = 'editor'`
-- now matches no grant at all, which is the new rule stated once, in the one place
-- that decides access. Everything else about the function — the owner branch, the
-- org branch, the expiry window — is byte-for-byte the same.
-- ---------------------------------------------------------------------------

create or replace function public.has_file_access(p_file uuid, p_user uuid, p_min text default 'viewer')
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.files f
    where f.id = p_file
      and f.deleted_at is null
      and (
        f.owner_id = p_user
        or (
          f.organization_id is not null
          and public.is_org_member(f.organization_id, p_user)
          and (
            p_min = 'viewer'
            or public.org_role(f.organization_id, p_user) in ('owner','admin')
          )
        )
        or exists (
          select 1 from public.share_grants g
          where g.file_id = p_file
            and g.grantee_id = p_user
            and (g.expires_at is null or g.expires_at > now())
            and (
              p_min = 'viewer'
              or g.permission = 'commenter'
            )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Comments are readable through a public link.
--
-- `file_comments` was readable only by `has_file_access`, which needs a signed-in
-- user id — so every comment left on a public link was written and then invisible,
-- to the owner in the dashboard as well as to the next visitor on the page. The
-- owner could see the row through their own policy (they hold access), but the
-- shared page had no way to ask, because it has no session.
--
-- This function is the shared page's read path: it takes a link token, re-resolves
-- it (so a revoked or expired link returns nothing), and returns the comments for
-- the file the token points at. Nothing else is exposed — no author ids, no email
-- addresses, and no comment on a file the token does not cover.
--
-- The display name is resolved here rather than in the client: an anonymous
-- commenter who left the name field blank is stored as `'Guest'`, but the product
-- shows "User", and the mapping belongs on the server so every surface agrees.
-- ---------------------------------------------------------------------------
create or replace function public.link_comments(p_token text)
returns table (
  id uuid,
  author_name text,
  body text,
  external boolean,
  created_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    c.id,
    case
      when c.author_id is null and btrim(c.author_name) in ('', 'Guest') then 'User'
      else c.author_name
    end as author_name,
    c.body,
    c.external,
    c.created_at
  from public.share_links l
  join public.files f on f.id = l.file_id
  join public.file_comments c on c.file_id = f.id
  where l.token = p_token
    and l.revoked_at is null
    and l.expires_at > now()
    and f.deleted_at is null
    and f.status = 'available'
  order by c.created_at asc;
$$;

grant execute on function public.link_comments(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. A public comment keeps the name it was given, verbatim.
--
-- The client no longer sends a substitute. The blank-name case is normalised in
-- `link_comments` for display, so the stored row says what the visitor typed and
-- the display decides what to show — storing "User" would make the two
-- indistinguishable from a visitor who really is called User.
-- ---------------------------------------------------------------------------
alter table public.file_comments
  alter column author_name set default '';

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public'
       and con.contype = 'c'
       and rel.relname = 'file_comments'
       and con.conname = 'comment_author_name_length'
  loop
    execute format('alter table public.file_comments drop constraint %I', c.conname);
  end loop;
end $$;

-- Blank is allowed now (it means "no name given"), and a supplied name still has
-- an upper bound so the column cannot be used as storage.
alter table public.file_comments
  add constraint comment_author_name_length
  check (char_length(author_name) between 0 and 120);

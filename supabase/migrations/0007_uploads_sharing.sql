-- 0006 — upload sessions, share grants, share links.

create table public.upload_sessions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  file_id       uuid references public.files(id) on delete cascade,
  -- Server-generated. The client never chooses a key, so it cannot pick a path
  -- or overwrite someone else's object.
  storage_key   text not null,
  multipart     boolean not null default false,
  r2_upload_id  text,
  parts_etags   jsonb not null default '[]'::jsonb,
  declared_size bigint not null check (declared_size >= 0),
  status        text not null default 'initiated'
                check (status in ('initiated','uploaded','confirmed','cancelled','expired')),
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index upload_sessions_owner on public.upload_sessions (owner_id, status);
create index upload_sessions_expiring on public.upload_sessions (expires_at)
  where status in ('initiated','uploaded');

-- ---------------------------------------------------------------------------
-- Sharing
-- ---------------------------------------------------------------------------
create table public.share_grants (
  id         uuid primary key default gen_random_uuid(),
  file_id    uuid references public.files(id) on delete cascade,
  folder_id  uuid references public.folders(id) on delete cascade,
  grantee_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('viewer','commenter','editor')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint grant_target_exclusive check (
    (file_id is not null) <> (folder_id is not null)
  )
);

create unique index grants_file_grantee on public.share_grants (file_id, grantee_id)
  where file_id is not null;
create unique index grants_folder_grantee on public.share_grants (folder_id, grantee_id)
  where folder_id is not null;
create index grants_grantee on public.share_grants (grantee_id);

create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid references public.files(id) on delete cascade,
  folder_id   uuid references public.folders(id) on delete cascade,
  -- Unguessable, and not derived from the file name.
  token       text not null unique,
  permission  text not null default 'viewer'
              check (permission in ('viewer','commenter','editor')),
  -- A link with no expiry would be exactly the permanent public URL the
  -- requirements forbid, so the column is NOT NULL and there is no default.
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint link_target_exclusive check (
    (file_id is not null) <> (folder_id is not null)
  )
);

create index share_links_file on public.share_links (file_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Access helpers used by policies.
--
-- A grant is live when it has not expired. A link is live when it has neither
-- expired nor been revoked.
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
              or g.permission in ('commenter','editor')
              or (p_min = 'editor' and g.permission = 'editor')
            )
        )
      )
  );
$$;

create or replace function public.has_folder_access(p_folder uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.folders f
    where f.id = p_folder
      and f.deleted_at is null
      and (
        f.owner_id = p_user
        or (f.organization_id is not null and public.is_org_member(f.organization_id, p_user))
        or exists (
          select 1 from public.share_grants g
          where g.folder_id = p_folder
            and g.grantee_id = p_user
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;

grant execute on function public.has_file_access(uuid, uuid, text) to authenticated;
grant execute on function public.has_folder_access(uuid, uuid) to authenticated;

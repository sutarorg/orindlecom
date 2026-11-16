-- 0004 — folders and files.
--
-- Both carry an explicit owner (a person) and an optional organization.
-- organization_id set means org membership is what grants access.

create table public.folders (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  parent_id       uuid references public.folders(id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 255),
  -- Materialised ancestry for breadcrumbs and subtree operations.
  path            text not null default '/',
  depth           int not null default 0 check (depth >= 0),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger folders_touch before update on public.folders
  for each row execute function public.touch_updated_at();

-- Two live folders with the same name in the same place is a conflict. NULL
-- parent_id never conflicts in a plain unique constraint, so coalesce it.
create unique index folders_unique_live_name on public.folders (
  owner_id,
  coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
) where deleted_at is null;

create index folders_parent on public.folders (parent_id) where deleted_at is null;
create index folders_owner on public.folders (owner_id) where deleted_at is null;
create index folders_org on public.folders (organization_id) where deleted_at is null;

create table public.files (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  folder_id       uuid references public.folders(id) on delete set null,
  name            text not null check (length(btrim(name)) between 1 and 255),
  -- Decimal bytes. The size the customer was shown.
  size_bytes      bigint not null default 0 check (size_bytes >= 0),
  mime_type       text not null default 'application/octet-stream',
  category        text not null default 'other',
  -- Server-generated, opaque. Never derived from the file name.
  storage_key     text not null unique,
  checksum_sha256 text,
  -- Nothing is downloadable unless this is 'available', and availability is
  -- only set after the object has been verified at the expected size.
  status          file_status not null default 'pending',
  -- Null until a scanner is configured. The column exists so the hook has
  -- somewhere to write; it is NOT evidence that scanning is active.
  scanned_at      timestamptz,
  scan_result     text,
  starred         boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger files_touch before update on public.files
  for each row execute function public.touch_updated_at();

create index files_owner_live on public.files (owner_id, created_at desc)
  where deleted_at is null;
create index files_folder_live on public.files (folder_id) where deleted_at is null;
create index files_org_live on public.files (organization_id) where deleted_at is null;
create index files_pending on public.files (status) where status = 'pending';
create index files_trash on public.files (owner_id, deleted_at)
  where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Folder paths.
--
-- Write amplification on a deep tree is the accepted cost of fast ancestry
-- reads. A move of a 1,000-folder subtree rewrites 1,000 rows; that is rarer
-- than a breadcrumb, and a test proves no stale path survives a move.
-- ---------------------------------------------------------------------------
create or replace function public.set_folder_path()
returns trigger language plpgsql as $$
declare
  v_parent_path text;
  v_parent_depth int;
begin
  if new.parent_id is null then
    new.path := '/' || new.id::text || '/';
    new.depth := 0;
  else
    select path, depth into v_parent_path, v_parent_depth
      from public.folders where id = new.parent_id;
    if v_parent_path is null then
      raise exception 'parent folder not found';
    end if;
    new.path := v_parent_path || new.id::text || '/';
    new.depth := v_parent_depth + 1;
  end if;
  return new;
end;
$$;

create trigger folders_path before insert or update of parent_id on public.folders
  for each row execute function public.set_folder_path();

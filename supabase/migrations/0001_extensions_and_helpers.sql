-- 0001 — extensions, enums, shared helpers.
--
-- Forward-only. Reviewed like code. Every later migration depends on the
-- helpers defined here.
--
-- Notes on Supabase specifics:
--   * `auth.users` is owned by Supabase. Locally (and in tests) it does not
--     exist, so this migration creates a minimal stand-in only when the schema
--     is absent. In a real project the CREATE SCHEMA is a no-op.
--   * `auth.uid()` is Supabase's function; the stand-in version reads the same
--     `request.jwt.claim.sub` setting Supabase's does, so policies behave
--     identically under test.

create extension if not exists pgcrypto;

create schema if not exists auth;

-- Minimal auth.users stand-in for local/test databases.
do $do$
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'auth' and table_name = 'users') then
    -- Columns mirror the ones this project actually reads or writes. The real
    -- Supabase table has many more; keeping the stand-in minimal means a
    -- migration that depends on an unmirrored column fails loudly in tests
    -- rather than silently in production.
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  end if;
end $do$;

-- Supabase defines auth.uid(); define it only if missing.
do $do$
begin
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'auth' and p.proname = 'uid') then
    create function auth.uid() returns uuid
      language sql stable
      as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  end if;
end $do$;

-- Supabase also provides auth.jwt(). The stand-in reconstructs the claim set
-- from the same settings Supabase populates, which is enough for the policies
-- that read `email` from it.
do $do$
begin
  if not exists (select 1 from pg_proc p
                 join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'auth' and p.proname = 'jwt') then
    create function auth.jwt() returns jsonb
      language sql stable
      as $fn$
        select jsonb_build_object(
          'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
          'email', nullif(current_setting('request.jwt.claim.email', true), '')
        )
      $fn$;
  end if;
end $do$;

-- ---------------------------------------------------------------------------
-- Roles used by the test harness. Supabase provides `anon`,
-- `authenticated` and `service_role`; create them if this is a bare database
-- so grants and `set role` behave the same way.
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $do$;

grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants this too: policies call auth.uid()/auth.jwt() while running as
-- the requesting role, so that role needs to be able to resolve them.
grant usage on schema auth to anon, authenticated, service_role;

-- The FK from profiles/members/files to auth.users requires the referencing
-- role to hold REFERENCES on the target. Supabase's auth schema grants this;
-- the stand-in must too, or a legitimate insert fails with "permission denied
-- for table users" and looks like a policy bug.
grant references on auth.users to anon, authenticated, service_role;
-- Test/fixture creation only. In Supabase, auth.users is written by the auth
-- service; in a bare database the harness needs to create accounts itself.
grant select, insert on auth.users to service_role;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper. Every mutable table uses this rather than
-- remembering to set the column in application code, because the one place
-- that forgets is the place the timestamps become untrustworthy.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared enums. Only sets that are genuinely closed get a type; anything a
-- future feature might extend uses text + check, because adding a value to an
-- enum cannot run inside a transaction and will bite during a migration.
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_type where typname = 'file_status') then
    create type file_status as enum ('pending', 'available', 'quarantined', 'failed');
  end if;
end $do$;

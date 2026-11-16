-- 0005 — storage accounting.
--
-- The most important migration in the project. Quota is where a storage product
-- either works or quietly loses money, and it is where the requirement
-- "parallel upload sessions must not bypass quota" is enforced.

create table public.storage_usage (
  owner_id        uuid primary key references auth.users(id) on delete cascade,
  -- Materialised sums, recomputable from files + reservations. Held here so a
  -- quota check is one row read, not an aggregate over every file an account
  -- owns.
  committed_bytes bigint not null default 0 check (committed_bytes >= 0),
  reserved_bytes  bigint not null default 0 check (reserved_bytes >= 0),
  trash_bytes     bigint not null default 0 check (trash_bytes >= 0),
  updated_at      timestamptz not null default now()
);

create table public.storage_reservations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  requested_bytes bigint not null check (requested_bytes > 0),
  bytes_used      bigint not null default 0 check (bytes_used >= 0),
  -- Correlates to upload_sessions, created in the same transaction.
  upload_id       uuid not null,
  status          text not null default 'reserved'
                  check (status in ('reserved', 'committed', 'released', 'expired')),
  expires_at      timestamptz not null default now() + interval '24 hours',
  created_at      timestamptz not null default now()
);

create index reservations_live on public.storage_reservations (owner_id)
  where status = 'reserved';
create index reservations_expiring on public.storage_reservations (expires_at)
  where status = 'reserved';

-- ---------------------------------------------------------------------------
-- The effective plan allowance.
--
-- Multiplied out from three inputs: the subscription (or Free), and the
-- organization, if any. A lapsed subscription falls back to Free rather than to
-- zero, because expiry downgrades — it does not confiscate.
-- ---------------------------------------------------------------------------
create or replace function public.effective_plan_bytes(p_owner uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select p.storage_bytes
      from public.plans p
      where p.id = coalesce(
        (
          select s.plan_id
          from public.subscriptions s
          where s.owner_id = p_owner
            and s.status in ('active', 'past_due')
          order by s.created_at desc
          limit 1
        ),
        'free'
      )
    ),
    (select storage_bytes from public.plans where id = 'free'),
    10000000000
  );
$$;

-- ---------------------------------------------------------------------------
-- reserve_storage: the transactional quota check.
--
-- Read-then-write in application code is the bug that oversells a plan: two
-- parallel requests both see the same free space and both take it. This takes a
-- row lock on storage_usage first, so the second caller blocks until the first
-- commits and then sees the reduced headroom.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_storage(
  p_owner uuid,
  p_bytes bigint,
  p_upload uuid
) returns public.storage_reservations
language plpgsql security definer set search_path = public as $$
declare
  v_plan_bytes bigint;
  v_row public.storage_usage;
  v_res public.storage_reservations;
begin
  if p_bytes is null or p_bytes <= 0 then
    raise exception 'invalid_size' using errcode = 'P0002';
  end if;

  -- Ensure a usage row exists, then lock it. The lock is the whole point.
  insert into public.storage_usage (owner_id) values (p_owner)
    on conflict (owner_id) do nothing;

  select * into v_row from public.storage_usage
    where owner_id = p_owner for update;

  v_plan_bytes := public.effective_plan_bytes(p_owner);

  if v_row.committed_bytes + v_row.reserved_bytes + p_bytes > v_plan_bytes then
    raise exception 'quota_exceeded'
      using errcode = 'P0001',
            hint = format('plan allows %s bytes, %s committed, %s reserved',
                          v_plan_bytes, v_row.committed_bytes, v_row.reserved_bytes);
  end if;

  update public.storage_usage
    set reserved_bytes = reserved_bytes + p_bytes,
        updated_at = now()
    where owner_id = p_owner;

  insert into public.storage_reservations (owner_id, requested_bytes, upload_id)
    values (p_owner, p_bytes, p_upload)
    returning * into v_res;

  return v_res;
end;
$$;

-- Release a reservation that will never be used. Idempotent: calling twice is
-- harmless because the status check makes the second call a no-op.
create or replace function public.release_reservation(p_reservation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_res public.storage_reservations;
begin
  select * into v_res from public.storage_reservations
    where id = p_reservation for update;
  if not found or v_res.status <> 'reserved' then
    return;
  end if;

  update public.storage_usage
    set reserved_bytes = greatest(reserved_bytes - v_res.requested_bytes, 0),
        updated_at = now()
    where owner_id = v_res.owner_id;

  update public.storage_reservations
    set status = 'released' where id = p_reservation;
end;
$$;

-- ---------------------------------------------------------------------------
-- commit_reservation: turn a reservation into committed bytes.
--
-- A reservation can be committed for less than was requested (a multipart
-- upload whose final part was short); the difference is released rather than
-- left held. Committing more than reserved is refused, because that would be a
-- quota bypass with extra steps.
-- ---------------------------------------------------------------------------
create or replace function public.commit_reservation(
  p_reservation uuid,
  p_actual_bytes bigint
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_res public.storage_reservations;
begin
  select * into v_res from public.storage_reservations
    where id = p_reservation for update;
  if not found then
    raise exception 'reservation_not_found';
  end if;
  if v_res.status <> 'reserved' then
    raise exception 'reservation_not_reserved';
  end if;
  if p_actual_bytes < 0 or p_actual_bytes > v_res.requested_bytes then
    raise exception 'commit_exceeds_reservation';
  end if;

  update public.storage_usage
    set committed_bytes = committed_bytes + p_actual_bytes,
        reserved_bytes  = greatest(reserved_bytes - v_res.requested_bytes, 0),
        updated_at = now()
    where owner_id = v_res.owner_id;

  update public.storage_reservations
    set status = 'committed', bytes_used = p_actual_bytes
    where id = p_reservation;
end;
$$;

grant execute on function public.effective_plan_bytes(uuid) to authenticated;
grant execute on function public.reserve_storage(uuid, bigint, uuid) to authenticated;
grant execute on function public.release_reservation(uuid) to authenticated;
grant execute on function public.commit_reservation(uuid, bigint) to authenticated;

-- Depends on 0005 (subscriptions). A `language sql` function body is parsed at
-- CREATE time, so the referenced table must already exist — which is why
-- billing is migrated before accounting rather than after.

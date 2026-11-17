-- ---------------------------------------------------------------------------
-- Expired reservations must not hold a customer's quota.
--
-- ── The bug this fixes ──────────────────────────────────────────────────────
--
-- `reserve_storage` takes a row lock on `storage_usage`, then refuses the upload
-- when `committed_bytes + reserved_bytes + p_bytes > plan_bytes`. It never looked
-- at `expires_at`.
--
-- Until now that was survivable, because `/api/cron/expire-reservations` ran every
-- ten minutes and released the stale rows. On Vercel's Hobby plan a cron job may
-- only run **once per day**, so the same design means a customer who closes the
-- tab mid-upload waits up to 24 hours before their own quota comes back — with an
-- error message that says their plan is full, which is false and unfalsifiable
-- from their side.
--
-- The correct fix is not a faster cron. Quota arithmetic must not depend on a
-- scheduler being timely: correctness belongs next to the lock, not in a job that
-- might be late, disabled, or misconfigured.
--
-- ── What this changes ───────────────────────────────────────────────────────
--
-- `reserve_storage` now treats a reservation whose `expires_at` has passed as
-- already released. It reclaims those bytes inline, under the same lock, before
-- deciding whether the new request fits. The cron route still exists and still
-- marks rows `expired` — that is bookkeeping and metrics — but nothing depends on
-- it for correctness any more.
--
-- `storage_usage.reserved_bytes` is therefore an *upper bound* between sweeps:
-- it can include bytes from lapsed reservations that no run has reclaimed yet.
-- Every path that reports reserved bytes must treat it that way. The aggregate
-- RPCs and the admin storage page already do.
--
-- Idempotent by construction: reclaiming twice subtracts zero the second time.
-- ---------------------------------------------------------------------------

create or replace function public.release_expired_reservations_for(p_owner uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_reclaimed bigint;
begin
  /*
   * Mark first, sum second, and only for rows this call actually transitioned.
   *
   * `status = 'reserved' and expires_at <= now()` in the WHERE clause makes the
   * UPDATE itself the latch: a concurrent caller updates zero rows and reclaims
   * zero bytes, so two sweeps cannot double-subtract.
   */
  with expired as (
    update public.storage_reservations
       set status = 'expired'
     where owner_id = p_owner
       and status = 'reserved'
       and expires_at <= now()
    returning requested_bytes
  )
  select coalesce(sum(requested_bytes), 0)::bigint into v_reclaimed from expired;

  if v_reclaimed > 0 then
    update public.storage_usage
       set reserved_bytes = greatest(reserved_bytes - v_reclaimed, 0),
           updated_at = now()
     where owner_id = p_owner;
  end if;

  return v_reclaimed;
end;
$$;

-- Revoked from PUBLIC first, then granted back only to `service_role`.
--
-- The `revoke ... from public` is what matters: without it, every role inherits
-- EXECUTE through PUBLIC and the grant below would be decoration. The sweep is not
-- an API surface — a customer calling it would only free their own lapsed
-- reservations, which is harmless, but quota bookkeeping is not something a client
-- should be able to drive.
revoke all on function public.release_expired_reservations_for(uuid)
  from public, anon, authenticated;
grant execute on function public.release_expired_reservations_for(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- reserve_storage, with inline expiry reclamation.
--
-- This is the 0014 definition — with the verification gate (P0004) and the live
-- upload-block gate (P0005) intact — plus one `perform` call. Dropping either gate
-- while adding the reclaim would have re-opened a hole the anti-abuse work closed,
-- which is exactly what the anti-abuse tests caught when a first draft of this
-- migration took its body from 0006 instead.
--
-- The reclaim must happen under the same `storage_usage` row lock that guards the
-- quota comparison, otherwise a concurrent reservation could settle between the two
-- and the sum would be meaningless — the same read-then-write bug the lock exists to
-- prevent.
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
  v_verified boolean;
begin
  if p_bytes is null or p_bytes <= 0 then
    raise exception 'invalid_size' using errcode = 'P0002';
  end if;

  -- Entitlement is conditional on a verified address.
  select (u.email_confirmed_at is not null) into v_verified
    from auth.users u where u.id = p_owner;
  if v_verified is null or v_verified = false then
    raise exception 'email_unverified' using errcode = 'P0004';
  end if;

  -- Cooldown from the anti-abuse layer.
  if exists (
    select 1 from public.account_restrictions r
    where r.user_id = p_owner
      and r.kind = 'upload_block'
      and r.released_at is null
      and r.expires_at > now()
  ) then
    raise exception 'abuse_restricted' using errcode = 'P0005';
  end if;

  -- Ensure a usage row exists, then lock it. The lock is the whole point.
  insert into public.storage_usage (owner_id) values (p_owner)
    on conflict (owner_id) do nothing;

  select * into v_row from public.storage_usage
    where owner_id = p_owner for update;

  /*
   * Reclaim lapsed reservations before measuring headroom. This is what makes the
   * quota correct on a deployment whose cleanup cron runs once a day: the
   * customer's abandoned upload stops counting the moment it expires, not the
   * moment a scheduler notices.
   *
   * Safe with the lock held — it touches the same row this transaction already
   * owns, so it cannot deadlock against itself.
   */
  perform public.release_expired_reservations_for(p_owner);

  select * into v_row from public.storage_usage
    where owner_id = p_owner;

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

grant execute on function public.reserve_storage(uuid, bigint, uuid) to authenticated;

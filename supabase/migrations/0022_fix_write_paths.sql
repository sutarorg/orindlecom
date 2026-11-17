-- 0022 — fix the two customer-facing write paths.
--
-- Both failures had the same shape: an application write that asked PostgREST for the
-- written row back (`insert ... .select()`, `update ... .select()`), where the row is
-- one the caller is not allowed to READ by policy. PostgREST implements `.select()` on a
-- write by appending `RETURNING`, and `RETURNING` is subject to the table's SELECT
-- policy. Postgres also applies SELECT policies to an UPDATE's row selection. So a write
-- the caller is fully entitled to make can match zero rows — or fail outright — purely
-- because the result set is unreadable.
--
-- Two distinct triggers, both reproduced against these migrations:
--
--   folders — `folders_select` calls `has_folder_access()`, which is STABLE. A STABLE
--   function reads the snapshot from the start of the statement, so it cannot see a row
--   inserted by that same statement. Every `insert ... returning` on a folder therefore
--   failed with 42501 while the same insert without `returning` succeeded.
--
--   files — `files_select` requires `status = 'available'`, so a `pending` row is
--   invisible even to its owner (deliberately: an unverified upload must not be listed or
--   downloaded). The commit step flipped `pending` to `available` with `returning`, so the
--   UPDATE matched no row at all and left the file pending forever.
--
-- The fix is not to widen either SELECT policy. The pending-file rule is a real security
-- guarantee and it stays. Instead these two writes move into SECURITY DEFINER functions,
-- which is already how this schema handles privileged writes (`reserve_storage`,
-- `commit_reservation`, `transfer_org_ownership`). Each function establishes the caller
-- from `auth.uid()` and refuses to act on a row the caller does not own, so no authority
-- is granted that the caller did not already have — only the visibility problem goes away.

-- ---------------------------------------------------------------------------
-- 1. Create a folder.
-- ---------------------------------------------------------------------------
create or replace function public.create_folder(
  p_name text,
  p_parent_id uuid
) returns public.folders
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.folders;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name' using errcode = 'P0002';
  end if;

  /*
   * A parent the caller does not own is treated as absent rather than forbidden: the
   * difference between "no such folder" and "not yours" is itself information.
   */
  if p_parent_id is not null then
    perform 1 from public.folders
      where id = p_parent_id and owner_id = v_uid and deleted_at is null;
    if not found then
      raise exception 'parent_not_found' using errcode = 'P0002';
    end if;
  end if;

  /*
   * owner_id comes from auth.uid(), never from the caller's argument, so this function
   * cannot be used to create a folder in someone else's drive. A duplicate name in the
   * same parent still raises 23505 from folders_unique_live_name, which the application
   * maps to a readable conflict.
   */
  insert into public.folders (owner_id, name, parent_id)
    values (v_uid, btrim(p_name), p_parent_id)
    returning * into v_row;

  return v_row;
end;
$$;

comment on function public.create_folder(text, uuid) is
  'Creates a folder owned by the caller. Definer so the RETURNING row is not filtered by folders_select, whose STABLE helper cannot see the row it just inserted.';

-- ---------------------------------------------------------------------------
-- 2. Finalize an upload: verify, commit accounting, log the event.
--
-- One transaction on purpose. The previous code did four separate writes from the
-- application (flip the file, commit the reservation, confirm the session, log
-- activity), each able to fail on its own, which is how a failed metadata commit could
-- leave a reserved-but-never-committed quota that shows up hours later as space that
-- will not come back.
-- ---------------------------------------------------------------------------
create or replace function public.finalize_upload(
  p_task_id uuid,
  p_actual_bytes bigint,
  p_status text
) returns public.files
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_session public.upload_sessions;
  v_file public.files;
  v_reservation uuid;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('available', 'quarantined') then
    raise exception 'invalid_status' using errcode = 'P0002';
  end if;

  if p_actual_bytes is null or p_actual_bytes < 0 then
    raise exception 'invalid_size' using errcode = 'P0002';
  end if;

  /*
   * The upload session is the authorization: this function will only finish an upload
   * that the caller started, and only while it is still in flight. Without this, a
   * caller could mark an arbitrary pending file available and skip the object
   * verification that step 10 of the service performed.
   */
  select * into v_session from public.upload_sessions
    where id = p_task_id and owner_id = v_uid
    for update;
  if not found then
    raise exception 'upload_not_found' using errcode = 'P0002';
  end if;
  if v_session.status not in ('initiated', 'uploaded') then
    raise exception 'upload_already_finished' using errcode = 'P0001';
  end if;

  select * into v_file from public.files
    where storage_key = v_session.storage_key and owner_id = v_uid
    for update;
  if not found then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;
  if v_file.status <> 'pending' then
    raise exception 'file_not_pending' using errcode = 'P0001';
  end if;

  update public.files
    set size_bytes = p_actual_bytes,
        status = p_status::public.file_status
    where id = v_file.id
    returning * into v_file;

  update public.upload_sessions set status = 'confirmed' where id = v_session.id;

  /*
   * Quarantined uploads are not charged: the bytes are not usable, so they are not
   * committed. This mirrors the application, which skipped the commit when scanning was
   * enabled.
   *
   * The commit is deliberately allowed to fail without failing the upload. That was the
   * application's behaviour and it is the right one — the object is verified and the file
   * row is correct, so a stale reservation is a bookkeeping problem for the sweeper, not
   * a reason to tell the customer their upload failed. The sub-block rolls back only the
   * commit, leaving the file update intact.
   */
  if p_status = 'available' then
    select id into v_reservation from public.storage_reservations
      where upload_id = v_session.id and status = 'reserved'
      order by created_at
      limit 1;

    if v_reservation is not null then
      begin
        perform public.commit_reservation(v_reservation, p_actual_bytes);
      exception when others then
        raise warning 'finalize_upload: commit_reservation failed for % (%): %',
          v_reservation, sqlstate, sqlerrm;
      end;
    end if;
  end if;

  insert into public.activity_events
    (actor_id, organization_id, subject_type, subject_id, kind, metadata)
    values (
      v_uid,
      v_file.organization_id,
      'file',
      v_file.id,
      'file.uploaded',
      jsonb_build_object(
        'size', p_actual_bytes,
        'multipart', v_session.multipart,
        'name', v_file.name
      )
    );

  return v_file;
end;
$$;

comment on function public.finalize_upload(uuid, bigint, text) is
  'Marks a verified upload available and commits its storage, atomically. Definer so the pending→available UPDATE is not filtered out by files_select, which hides pending rows from their own owner.';

/*
 * Activity rows are written by these functions as their definer, so `authenticated`
 * still needs no INSERT grant on `activity_events`. That table stays service- and
 * function-written only, which is what keeps the customer-facing activity log from being
 * forgeable by a client.
 */
grant execute on function public.create_folder(text, uuid) to authenticated;
grant execute on function public.finalize_upload(uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0026 — Folder tree integrity, batched child counts, global file listing.
--
-- Three defects, all of them in the data layer, all of them customer-visible:
--
--   1. **Moving a folder left its whole subtree behind.** `folders.path` is derived
--      by the `set_folder_path` BEFORE trigger from the parent's path. The trigger
--      fires for the row being updated ("before insert or update of parent_id"), so
--      moving `A` rewrote `A.path` and left every descendant still holding the old
--      prefix. The descendants kept pointing at their own correct `parent_id`, so the
--      tree *looked* right, while every ancestry read — breadcrumb, descendant query,
--      "is this folder inside that one" — was answered from a stale string. A
--      recursive rescore of the subtree is what the header comment in 0004 always
--      promised ("a move of a 1,000-folder subtree rewrites 1,000 rows"); the trigger
--      never did it.
--
--   2. **`childCount` was the literal 0** in both `fileToItem` and `folderToItem`, so
--      every folder card said "0 items" no matter what it held. A per-row query would
--      be one round trip per card, so the count is a batched aggregate instead.
--
--   3. **Nothing could list files across the whole tree.** `list` treats an omitted
--      parent as "no filter" only for folders; for files it needed to be explicit.
--      The repository change is in TypeScript; what belongs here is the index that
--      makes an owner-wide file read cheap, because that is now a page view rather
--      than a rare operation.
--
-- Everything is additive and idempotent: no historical migration is rewritten, no
-- existing row is deleted, and no access rule is widened. RLS is untouched — the
-- counting functions are `security invoker`, so they run under the caller's own
-- policies and can only ever see rows that caller could already read.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Keep descendants' paths correct when a folder moves.
-- ---------------------------------------------------------------------------
create or replace function public.rescore_folder_subtree(
  p_folder uuid,
  p_old_prefix text,
  p_new_prefix text,
  p_old_depth int,
  p_new_depth int
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.folders as child
     set path = p_new_prefix || substring(child.path from char_length(p_old_prefix) + 1),
         depth = p_new_depth + (child.depth - p_old_depth)
   where child.id <> p_folder
     and child.path like p_old_prefix || '%'
     -- Anchored on a whole segment: `/abc/` must not match `/abcdef/`.
     and starts_with(child.path, p_old_prefix);
$$;

comment on function public.rescore_folder_subtree(uuid, text, text, int, int) is
  'Rewrites the stored ancestry of every descendant after a folder moves. Without it the subtree keeps a stale path prefix and every ancestry read is answered from it.';

-- ---------------------------------------------------------------------------
-- 2. Fire it on a move.
-- ---------------------------------------------------------------------------
/*
 * An AFTER trigger, not BEFORE.
 *
 * The path of the moved row is produced by `set_folder_path` in a BEFORE trigger, and
 * this one needs both the old prefix and the new one. `OLD` gives the former and `NEW`
 * the latter, so an AFTER trigger has everything and cannot be reordered against the
 * path calculation by another BEFORE trigger added later.
 */
create or replace function public.folders_rescore_on_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.path is distinct from new.path then
    perform public.rescore_folder_subtree(new.id, old.path, new.path, old.depth, new.depth);
  end if;
  return null;
end;
$$;

comment on function public.folders_rescore_on_move() is
  'Definer: rescoring must reach every descendant row, including ones the moving user can read but whose update would otherwise be filtered by folders_update.';

drop trigger if exists folders_rescore_descendants on public.folders;
create trigger folders_rescore_descendants
  after update of parent_id on public.folders
  for each row
  execute function public.folders_rescore_on_move();

-- ---------------------------------------------------------------------------
-- 3. Repair existing rows.
-- ---------------------------------------------------------------------------
/*
 * Rebuild every path and depth from `parent_id`, which is the authoritative
 * relationship. Any database written before this migration may hold a subtree whose
 * path was never rescored; that is the state this repairs, once, in place.
 *
 * A recursive walk rather than a string rewrite: it is the only version that is
 * correct for rows that are *already* inconsistent, which a string rewrite cannot fix
 * — it would faithfully copy the wrong prefix.
 */
with recursive tree as (
  select
    f.id,
    ('/' || f.id::text || '/')::text as path,
    0 as depth
  from public.folders f
  where f.parent_id is null
  union all
  select
    f.id,
    (t.path || f.id::text || '/')::text,
    t.depth + 1
  from public.folders f
  join tree t on f.parent_id = t.id
)
update public.folders as target
   set path = tree.path,
       depth = tree.depth
  from tree
 where target.id = tree.id
   and (target.path is distinct from tree.path or target.depth is distinct from tree.depth);

-- ---------------------------------------------------------------------------
-- 4. Batched child counts.
-- ---------------------------------------------------------------------------
/*
 * One row per folder that has contents, optionally restricted to a set of folders.
 *
 * The alternative was a query per card. A grid of sixty folders means sixty round
 * trips to count children, on every render of the page, which is a page whose cost
 * scales with the number of folders in it. This is one statement and one round trip.
 *
 * Counting rules, which are the rules the list itself uses:
 *   - parent not deleted (a trashed folder's contents are not "here")
 *   - child not deleted
 *   - a file must be `status = 'available'`: a pending or quarantined upload is not
 *     content yet, and counting it would make the badge disagree with the list.
 *
 * `security invoker`, so both CTEs read through the caller's RLS. A folder belonging
 * to somebody else therefore contributes nothing, and the function cannot be used as
 * an oracle for "does this folder exist".
 */
create or replace function public.folder_child_counts(p_folder_ids uuid[] default null)
returns table (folder_id uuid, child_count integer)
language sql
stable
security invoker
set search_path = public
as $$
  with direct_children as (
    select f.parent_id as folder_id, count(*)::int as n
      from public.folders f
     where f.parent_id is not null
       and f.deleted_at is null
       and (p_folder_ids is null or f.parent_id = any (p_folder_ids))
     group by f.parent_id
  ),
  direct_files as (
    select fl.folder_id, count(*)::int as n
      from public.files fl
     where fl.folder_id is not null
       and fl.deleted_at is null
       and fl.status = 'available'
       and (p_folder_ids is null or fl.folder_id = any (p_folder_ids))
     group by fl.folder_id
  )
  select ids.folder_id,
         coalesce(dc.n, 0) + coalesce(df.n, 0) as child_count
    from (
      select distinct folder_id from direct_children
      union
      select distinct folder_id from direct_files
    ) as ids
    left join direct_children dc on dc.folder_id = ids.folder_id
    left join direct_files df on df.folder_id = ids.folder_id;
$$;

comment on function public.folder_child_counts(uuid[]) is
  'Direct child folders plus direct available files, per folder, in one round trip. Respects the caller''s RLS.';

grant execute on function public.folder_child_counts(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The index the global file listing needs.
-- ---------------------------------------------------------------------------
/*
 * `before`: `/dashboard/files` listed only the root, so an owner-wide read was rare.
 * It is now the default view — every available file the account owns, at any depth —
 * so the read is `(owner_id, created_at desc)` filtered to live, available rows, and
 * that is what this covers. The existing `files_owner_live` index covers
 * `(owner_id, created_at desc) where deleted_at is null`; adding `status` keeps the
 * pending rows out of the scan rather than filtering them after the fact.
 */
create index if not exists files_owner_available on public.files (owner_id, created_at desc)
  where deleted_at is null and status = 'available';

-- ---------------------------------------------------------------------------
-- 6. Canonical ancestry for a folder, for URL and breadcrumb construction.
-- ---------------------------------------------------------------------------
/*
 * `folders.path` is ids only, so a caller that wants "the chain from the root to this
 * folder, with names" has to join it back to the table. Doing that in the repository is
 * one extra query per page; doing it here is one statement and one round trip, and it
 * keeps the definition of "ancestry" in the same place as the storage of it.
 *
 * Returns the chain *including* the requested folder, ordered root first, each row
 * carrying its parent so a caller can build nested URLs without a second lookup.
 */
create or replace function public.folder_ancestry(p_folder uuid)
returns table (id uuid, name text, parent_id uuid, depth int)
language sql
stable
security invoker
set search_path = public
as $$
  select f.id, f.name, f.parent_id, f.depth
    from public.folders f
   where f.deleted_at is null
     and f.id in (
       select unnest(string_to_array(btrim(t.path, '/'), '/'))::uuid
         from public.folders t
        where t.id = p_folder and t.deleted_at is null
     )
   order by f.depth asc;
$$;

comment on function public.folder_ancestry(uuid) is
  'The chain from the root to a folder, root first, resolved from the stored path and read through RLS.';

grant execute on function public.folder_ancestry(uuid) to authenticated;

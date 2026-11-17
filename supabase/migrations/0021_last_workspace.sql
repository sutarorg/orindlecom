-- ---------------------------------------------------------------------------
-- 0021 — remember which workspace the customer was last using.
--
-- ── Why this is in the database and not a cookie ─────────────────────────────
--
-- The requirement: signing in takes you back to where you left off — either
-- `/dashboard` or `/business` — instead of to the old `/account` chooser.
--
-- A cookie seems like the obvious place to put that, and it is the wrong one for
-- the case that matters. Sign-out clears cookies; signing in on a second device
-- sends no cookie; and a "remember the last workspace" that forgets the moment you
-- log out is not remembering the last workspace. The preference belongs to the
-- account, so it is stored on the account.
--
-- ── Why two columns and not one ─────────────────────────────────────────────
--
-- `last_workspace` answers "which one", and `last_path` answers "where inside it".
-- Storing only the workspace means a customer who was in the middle of a folder
-- tree lands back on the overview every time, which is the same complaint in a
-- smaller form.
--
-- `last_path` is validated on the way in *and* on the way out (see
-- `src/lib/navigation/last-workspace.ts`). It is a value the client supplies, so it
-- is treated as untrusted: only a path that begins with `/dashboard` or `/business`
-- is ever stored or redirected to. That check is what stops this becoming an open
-- redirect.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists last_workspace text
    check (last_workspace is null or last_workspace in ('personal', 'business')),
  add column if not exists last_path text
    check (
      last_path is null
      or last_path like '/dashboard%'
      or last_path like '/business%'
    );

comment on column public.profiles.last_workspace is
  'Which workspace the customer last used: personal (/dashboard) or business (/business). Drives the post-login destination.';
comment on column public.profiles.last_path is
  'Last in-app path inside that workspace. Constrained to /dashboard or /business prefixes; re-validated before use as a redirect target.';

-- The customer writes this themselves, so the existing `profiles_update_own`
-- policy already covers it — no new policy is needed, and adding a permissive one
-- would widen writes to this table for no reason. Kept as an assertion rather than
-- a silent assumption: if the policy is ever narrowed, this comment is where to
-- look when the feature stops persisting.
--
-- Verified against 0009_rls_policies.sql: `profiles_update_own` is
-- `for update to authenticated using (id = auth.uid())`.

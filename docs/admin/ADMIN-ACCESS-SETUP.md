# Setting up platform administrator access

**Status:** implemented. Requires migrations `0017` and `0018` applied.

This document covers the one step that cannot be automated: creating the first
platform administrator. Everything after that is done from the console itself.

---

## 1. What a platform administrator is

A platform administrator operates Orindle. A business Owner or business Admin
operates a customer organization inside Orindle. **They are different things.**

| | Platform administrator | Business Owner / Admin |
| --- | --- | --- |
| Stored in | `public.platform_admins` | `public.members` |
| Roles | `owner`, `admin` | `owner`, `admin`, `member` |
| Sees | Every customer's account, billing, storage, tickets | Their own organization's members and files |
| Can be granted by | A platform owner | That organization's owner |
| Has an `/admin` route | Yes | **No** |

There is no path from the right column to the left. A business Owner cannot grant
themselves platform rights, cannot read `platform_admins`, and is refused by every
`/api/admin/**` endpoint independently of any UI. The two tables have separate
policies and neither policy references the other.

**Do not** put a platform administrator's privileges in `members.role`, in
`auth.users.raw_user_meta_data`, or in a hardcoded email allowlist. None of those is
accepted as proof of anything, and a test asserts they are not read.

---

## 2. Before you start

1. Migrations `0001`…`0018` applied to the target database, in filename order.
2. `SUPABASE_SERVICE_ROLE_KEY` set on the server. Without it the console reports
   `not_configured` and no privileged work can run.
3. The person who will be the first owner has **already signed up** through the
   normal sign-up flow and **verified their email**. An unverified account is
   refused, even if the row exists.

Verify their account exists and is confirmed:

```sql
select id, email, email_confirmed_at, created_at
from auth.users
where email = 'person@example.com';
```

`email_confirmed_at` must not be null. Copy the `id` — you need the UUID, and it
must be an exact match. **Do not guess or construct one.**

---

## 3. Create the first owner

Run this in the Supabase SQL editor, or with `psql`. Replace
`<PASTE-THE-AUTH-USER-UUID-HERE>` with the UUID from step 2.

```sql
insert into public.platform_admins (user_id, role, is_active, created_by)
values (
  '<PASTE-THE-AUTH-USER-UUID-HERE>'::uuid,
  'owner',
  true,
  null          -- the first owner has no creator; this is the only row that may
);
```

`created_by` is null **only** for this first row. Every later grant records which
owner created it, which is what makes the audit trail meaningful.

The insert fails if:

- the UUID does not exist in `auth.users` (foreign key)
- the user is already a platform administrator (primary key)
- the account is unverified — `platform_admins` does not check this, but the
  authorization layer will refuse the session, so fix the verification first

### Verify

```sql
select pa.user_id, u.email, pa.role, pa.is_active, pa.created_at
from public.platform_admins pa
join auth.users u on u.id = pa.user_id;
```

Expect exactly one row: `owner`, `is_active = true`.

Then sign in as that person and open `/admin`. If you land on
"Your account doesn't have platform administration access", the usual causes are,
in order:

| Symptom | Cause |
| --- | --- |
| Redirect to `/login` | No session at all |
| Redirect to `/verify-email` | Email never confirmed |
| `/access-denied` | Row missing, or `is_active = false`, or the UUID is a different user |
| `/access-denied?reason=not-configured` | No Supabase credentials on this deployment |

---

## 4. Adding more administrators

Once one owner exists, use the console: **Settings → Platform administrators**.

- An **owner** can grant either role, change a role, and revoke access.
- An **admin** sees the table and cannot change it. The controls are disabled with
  the reason stated, and the API refuses the request regardless of the UI.
- Revoking is a **soft** operation: `is_active` becomes false and `disabled_at` is
  set. The row is kept so the audit trail still resolves the actor's identity.

The last active owner cannot be revoked or demoted. The database enforces this with
a deferred constraint trigger that raises `last_platform_owner`; the API surfaces
that as a conflict message rather than a 500. This is deliberate — a platform with
no owner is unrecoverable without database access.

### If you are locked out

You need database access. This is the recovery path, and it requires the same
privilege as creating the first owner:

```sql
-- Re-enable a disabled administrator
update public.platform_admins
set is_active = true, disabled_at = null
where user_id = '<UUID>'::uuid;

-- Or promote someone new, recording who did it
insert into public.platform_admins (user_id, role, is_active, created_by)
values ('<UUID>'::uuid, 'owner', true, '<EXISTING-OWNER-UUID>'::uuid);
```

---

## 5. Bootstrap rules this design deliberately does not have

Stated because each is a common convenience that creates a permanent hole.

- **No auto-promotion of the first user.** A database that promotes whoever signs up
  first hands the console to whoever finds the deployment first.
- **No seeded administrator.** A migration that inserts an admin ships a known
  identity in source control, in every environment.
- **No hardcoded email allowlist.** An email address is not an authorization system;
  addresses are reassigned, and the check lives in code rather than in the database
  where it could be audited.
- **No environment-variable list of administrator emails.** Same problem, plus it
  makes a production grant depend on a deploy.
- **No "admin" boolean on `profiles`.** A profile row is readable and writable in
  more places than a dedicated table, and a boolean cannot express two roles.

Every one of these is a single line of code that would make setup easier, and each
one is a way for the wrong person to become an administrator. The manual step is the
feature.

---

## 6. What the console can and cannot do

Capabilities, so nobody goes looking for a button that is not there:

| Available | Not available, by design |
| --- | --- |
| Read every account's plan, status, usage and join date | Delete or suspend a customer account |
| Export the filtered user list as CSV | Impersonate a customer |
| Read billing figures and invoice counts | Assign a plan by hand |
| Read storage aggregates by plan and account | Adjust a storage figure |
| Read and reply to support tickets | Refund a payment or confirm one manually |
| Read the audit trail | Delete an audit row |
| Grant and revoke administrator access | Change a price without approval |

A billing change and a support reply do different things and are kept apart on
purpose. Nothing in the console writes a customer's files.

---

## 7. Secrets

No administrator credential is stored in this repository. The console uses the
server-side `SUPABASE_SERVICE_ROLE_KEY` that already exists for jobs and webhooks —
still not obtained until authorization has succeeded, which
`tests/unit/admin-security.test.ts` asserts by reading the source.

Analytics reporting credentials (`GA_SERVICE_ACCOUNT_PRIVATE_KEY`,
`GSC_SERVICE_ACCOUNT_PRIVATE_KEY`) are separate, optional, and server-only. See
`docs/deployment/environment-variables.md` §2.0. Do not reuse the Google sign-in
OAuth client for them.

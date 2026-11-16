# Orindle — Member Management UX

One screen, `/dashboard/business/members`, covering everyone who has access and
everyone who has been invited but hasn't accepted yet.

---

## 1. The two kinds of person

The single most confusing thing about a member list is that it mixes people who
exist with people who might never exist. Orindle keeps them in one list — because
"where's Priya?" should have one answer — but never lets them look alike:

| | Accepted | Invited |
| --- | --- | --- |
| Identity | Name and email | Email only, derived display name |
| Avatar | Initials from their name | Dashed outline, hollow |
| Status | Active / Suspended | Invited |
| Actions | Change role, Remove | Resend, Revoke |
| Counted in "with access" | Yes | No |

`Member.name` and `Member.userId` are null until an invitation is accepted. The
list renders `email.split("@")[0]` in that case and marks the row, rather than
inventing a name from the address and presenting it as identity.

Nobody is ever seeded. An organization with one member is one row, and the empty
state below it says so.

---

## 2. Empty states

Two, and they are different situations:

**First use** — the organization has only the viewer. `EmptyState` variant
`first-use`, icon `Users`, title *"It's just you so far."*, body explaining what
changes when a second person joins, primary action *"Invite your first member"*,
footnote noting the 7-day expiry.

Non-inviters get the same panel with read-only copy: *"An owner or admin can
invite people…"* and no button. No disabled button — a control you can see but
can't use with no explanation reads as a permission bug.

**No search results** — variant `collection`, icon `SearchX`, *"No one matches"*,
with a *Clear filters* action. This one only appears when the roster is non-empty,
so the two states can't be confused.

---

## 3. Roster layout

**≥768px — table.** Five columns: person, role, status, joined, actions. The
person column carries avatar, name and email stacked, because the email is the
only identity an invited person has.

**<768px — cards.** The same records as stacked cards: avatar and name on the
first line, status pill on the second, role and actions on a footer row. No
horizontal scroll, no squeezed columns. `MemberTable` and `MemberCard` share the
`MemberAvatar` and `MemberStatusPill` components so the two views can't diverge.

---

## 4. Searching and filtering

- Search matches name, email and — for invited people — the local part of the
  address. Case-insensitive, trimmed, no debounce needed at this scale.
- Status tabs double as counts: All · Active · Invited · Suspended · Expired ·
  Failed, each with a live number from `members()`. A tab is **hidden when its
  count is zero** — an empty "Failed" tab would imply delivery problems that
  don't exist. The active tab always renders, so the control can't vanish while
  it is selected.
- Search and status compose. The result line reads "Showing N of M" whenever
  either is active, and a single *Clear filters* action resets both.

The counts come from `members()`; the filter is applied in `MembersView` so the
numbers stay stable while typing.

---

## 5. Inviting someone

`InviteDialog`, size `md`, three sections:

1. **Email** — one field, `type="email"`, validated on submit rather than on
   keystroke (nobody wants to be told their address is invalid at the 4th
   character). Inline error under the field, `aria-invalid` + `aria-describedby`.
2. **Role** — radio cards, one per assignable role, each with its summary line so
   the choice is made on consequences rather than on the word "Admin". Owner is
   never offered. A role above the inviter's own is shown but disabled with the
   reason "Not assignable — you can't grant a role above your own", per
   `canAssignRole()`.
3. **Optional folder access** — a folder picker plus an access level, defaulting
   to none. This is the "share the project on day one" path.

Footer: *Send invitation*, disabled until an email and role exist. Submitting
reports `BUSINESS_NOT_CONNECTED` in the error tone: *"Invitation wasn't sent."*

The role is chosen by the inviter and stored on the invitation. The invitee never
picks their own role — self-selection is privilege escalation with a friendly
face on it.

---

## 6. Invitation lifecycle

```
        invite
          │
          ▼
      ┌────────┐  accept   ┌────────┐
      │ pending│ ────────► │accepted│
      └────────┘           └────────┘
        │      │
 expires│      │revoke
        ▼      ▼
    ┌────────┐ ┌────────┐
    │expired │ │revoked │
    └────────┘ └────────┘
```

- **Pending** — resend and revoke are both available.
- **Expired** — `INVITATION_EXPIRY_DAYS` (7) after sending. Resend issues a fresh
  token and restarts the clock; the expired record is not resurrected.
- **Revoked** — final. The row stays with the revoked status so the audit trail
  is honest; re-inviting creates a new invitation.
- **Failed** — delivery failed at the mail provider. Distinct from expired,
  because the fix is different: resend, not re-invite.
- **Suspended** — access revoked by an admin while the account still exists. A
  suspended member is not invited and not active; the member row keeps their
  name and history.

### The attention banner

When any invitation has already expired or failed to deliver, an amber banner
sits above the roster: *"N invitations have expired or couldn't be delivered.
Send a fresh one from the row menu."* with a *Show them* action that filters the
list to the affected rows.

It counts what has already gone wrong rather than predicting what will — a
"expiring soon" count would need a daily job to keep it honest. Only
invitation-capable roles (owner and admin) see it; a member can't resend
anything, so telling them about a broken invitation would be pure alarm.

---

## 7. Actions on a member

Reached from the row's action menu. Each item is disabled with a visible reason
when the viewer can't do it, and the reason is the real constraint, not "You
don't have permission":

| Action | Guard | Reason shown |
| --- | --- | --- |
| Change role | `roleChangeBlocker()` | "You can't change your own role." / "You can't assign a role above your own." / "Only the owner can change another owner's role." |
| Remove | `removalBlocker()` | "The last owner can't be removed. Transfer ownership first." / "You can't remove someone at or above your own role." |
| Resend invitation | `members.invite` | "Only owners and admins can send invitations." |
| Revoke invitation | `members.invite` | same |
| Transfer ownership | `members.transferOwnership` | owner only |

Both blockers return **strings**, never booleans, so the disabled control can
explain itself in one place. A guard that can only say "no" produces a UI that
can only say "no".

### Changing a role

`RoleSelector` opens in a dialog with radio cards. Owner is excluded from the
list. `RoleBoundaryNote` under the list restates the ladder in a sentence. On
submit, a role change that reduces privilege gets a `ConfirmDialog` — *"Make Priya
a member?"* — because losing access is the kind of thing people do by mis-tapping
a radio.

### Removing someone

`ConfirmDialog`, destructive. Copy names the consequence precisely: shared folder
access is revoked, files in their personal workspace are untouched, and it can be
re-done by inviting again. No type-to-confirm here — that friction is reserved
for destructive actions that can't be undone (folder and organization deletion).

### Transferring ownership

A separate card rather than a role option, because it is a different act. It
names the target, states that the viewer becomes an admin in the same transaction,
and requires typing the target's name. Ownership never passes through a state
where nobody holds it.

---

## 8. Member detail

Selecting a row opens `MemberDetailsDialog` (size `md`, full-screen on mobile). It
shows: name or email as the title, avatar, role in words with the role's summary
("Role allows"), status with its hint, joined date with a relative time, and —
for an invitation still outstanding — when it expires. A revoke date is shown
once the account has lost access.

The footer carries the same actions as the row menu: *Change role* and *Remove*,
each guarded and each explaining itself when unavailable. Choosing one closes the
detail and opens the corresponding dialog, so the person is never in two modals
at once.

There is no separate folder-access panel in the detail. Per-member folder grants
are set from the folder itself, in `FolderAccessDialog`, where the other people
with access are visible next to the one being changed — judging one grant in
isolation is how access sprawl happens.

## 9. Responsive summary

| | Mobile <640 | Tablet 640–1023 | Desktop ≥1024 |
| --- | --- | --- | --- |
| Roster | Cards | Cards to 767, table from 768 | Full table |
| Search | Full width, above tabs | Inline | Inline |
| Status | Pill under the email | Own column | Own column |
| Status tabs | Horizontally scrollable | Inline | Inline |
| Row actions | Card footer buttons | Menu | Menu |
| Detail | Full-screen | `md` dialog | `md` dialog |
| Invite | Full-screen | `md` dialog | `md` dialog |

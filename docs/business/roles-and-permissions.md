# Orindle — Roles and Permissions

Three roles. Not three plus a builder, not three with per-folder exceptions.

The reason for the constraint is stated once, here, and then never apologised
for again: a permission model is only worth what it is enforced, and Orindle's
enforcement points are known and finite. Every role on this page maps to checks
that actually run.

---

## 1. The ladder

| Role | Rank | Summary (shown to users verbatim) |
| --- | --- | --- |
| Owner | 3 | Full control, including billing and who else is an owner. |
| Admin | 2 | Runs the team day to day. Cannot change billing or ownership. |
| Member | 1 | Works inside shared folders. Cannot manage people. |

`ROLE_RANK` is a numeric map, and every comparison in the product goes through
it. There is no second place where "how senior is an admin" is decided.

`ROLES` in `src/lib/business/roles.ts` is the only source of role definitions.
The matrix on `/permissions`, the invite dialog's radio cards, the change-role
dialog and the guards all read from it. There is no copy of the table in a
component, so a capability can't be granted in one screen and refused in another.

---

## 2. Capabilities

Named `area.action`, so a capability is greppable from the guard that uses it:

| Group | Capability | Owner | Admin | Member |
| --- | --- | :---: | :---: | :---: |
| Members | `members.view` | ✓ | ✓ | ✓ |
| | `members.invite` | ✓ | ✓ | |
| | `members.changeRole` | ✓ | ✓ | |
| | `members.remove` | ✓ | ✓ | |
| | `members.transferOwnership` | ✓ | | |
| Folders | `folders.create` | ✓ | ✓ | ✓ |
| | `folders.manageAccess` | ✓ | ✓ | |
| | `folders.delete` | ✓ | ✓ | |
| Workspace | `storage.view` | ✓ | ✓ | ✓ |
| | `activity.view` | ✓ | ✓ | ✓ |
| | `org.edit` | ✓ | ✓ | |
| | `billing.manage` | ✓ | | |
| | `org.delete` | ✓ | | |

`can(role, capability)` is the single predicate. It is called in the matrix (to
render a tick), in the member actions (to decide whether to open a dialog) and
behind write paths.

Member is not a read-only role: members create folders and see the storage and
activity pages. Treating every non-admin as a passenger makes a team feel like a
broadcast, and it is the most common thing teams ask to change.

---

## 3. The five boundaries

Capabilities alone don't describe a hierarchy — these rules do. Each is enforced
in a helper that returns a reason.

### 3.1 Exactly one owner

Ownership is transferred, not granted. `transferOwnership()` moves the role from
one account to another in a single transaction, and the outgoing owner becomes an
admin in the same step.

Consequence: the organization is never ownerless and never double-owned. There is
no "add owner" button anywhere in the product, because a second owner would make
the last-owner guard ambiguous.

### 3.2 Nobody promotes past their own role

`canAssignRole(actorRole, role)` is a boolean — you can't grant above your own
rank, and a member can't grant anything at all. The *explanation* lives in
`roleChangeBlocker`, which wraps it and returns the sentence:

```ts
canAssignRole("admin", "owner")  // → false
roleChangeBlocker({ actorRole: "admin", targetRole: "member", nextRole: "member", isSelf: false })
// → "You can't assign a role above your own."

assignableRoles("admin")  // → ["admin", "member"]   owner is never offerable
```

Without this rule, roles are advisory. Every escalation would need a second guard
elsewhere, and one of those guards would eventually be forgotten.

### 3.3 You can't change your own role

Self-promotion is impossible structurally, not by a check that could be reordered.
The change-role action is absent from your own row, and the backend refuses it
independently.

Combined with 3.2, privilege escalation is always a two-person event.

### 3.4 The last owner can't be removed

`removalBlocker({ actorRole, targetRole, isSelf, isLastOwner })` returns, in
order of precedence:

| Condition | Message |
| --- | --- |
| Target is you | "You can't remove yourself. Leave the organization instead." |
| Target is the owner | "The owner has to transfer ownership before leaving." |
| Last owner | "This is the only owner. Transfer ownership first." |
| Equal or higher rank | "You can only remove people below your own role." |

`isLastOwner` is a fact the backend reports on the member record, not something
the UI counts. Counting client-side means a stale list decides whether the
organization can be modified.

### 3.5 Removal is not deletion

Removing somebody revokes their access to shared folders and ends their
membership. Files in their own workspace stay theirs. The confirmation says this
in those words, because "remove" reads like "delete their stuff" to about half of
everyone.

---

## 4. Why blockers return strings

The two guards that block an action return a human-readable reason instead of a
boolean:

```ts
roleChangeBlocker({ actorRole, targetRole, nextRole, isSelf }): string | null
removalBlocker({ actorRole, targetRole, isSelf, isLastOwner }): string | null
```

`can()` and `canAssignRole()` are plain predicates, used where the answer is a
tick in a table or a filter — no sentence is needed there.

A boolean guard forces the caller to invent a reason, and callers invent the
wrong one — usually a generic "You don't have permission", which is both
insulting and unhelpful. Returning the reason means the disabled control explains
itself in the same words the guard used, for free, everywhere.

Concretely, a disabled *Remove* on the owner row reads *"The last owner can't be
removed. Transfer ownership first."* — which tells the person what to do next
instead of what they did wrong.

The UI pairing rule: **a control that is refused is either hidden or disabled
with its reason visible.** Never disabled and silent.

| Situation | Treatment |
| --- | --- |
| Viewer is a member looking at team management | Read-only notice above the list; actions absent |
| Action impossible for structural reasons | Disabled, reason visible in the menu item |
| Action possible but unbacked (no service) | Enabled; reports the failure on submit |
| Role not assignable by this viewer | Radio shown, disabled, "Not assignable" + reason |

---

## 5. Role changes

Changing a role is a two-step interaction on purpose:

1. `ChangeRoleDialog` — radio cards from `assignableRoles()`, owner excluded, with
   `RoleBoundaryNote` restating that the ladder caps what you can hand out.
2. If the change **reduces** privilege, a `ConfirmDialog` — *"Make Priya a
   member?"* — stating what she loses. Promotions apply without a second dialog;
   losing access deserves the extra tap.

`outranks(a, b)` is the comparison used for both the guard and this
"is this a demotion" decision, so a rule about who can change a role and a rule
about whether to warn about it can't disagree.

---

## 6. What the permissions page is for

`/dashboard/business/permissions` is a **reference**, not a settings page. It is
where somebody checks what they're allowed to do before asking, and where an
owner decides who to promote.

- Three role cards at the top, each with its summary and a live count of people
  holding it. The viewer's own role is ringed and tagged *Your role*.
- One capability matrix: rows are capabilities grouped by area, columns are roles.
  Every cell is `can()` — the table is a render of the enforcement, not a
  description of it.
- Access boundaries below the matrix, in prose, because 3.2 and 3.4 aren't
  expressible as a cell.
- A closing note: custom roles are not available, and why.

The page has no controls. Its job is to answer a question, and adding a toggle
would make it a settings screen with a documentation habit.

---

## 7. Not built, and why

| Not available | Reason |
| --- | --- |
| Custom roles | No permission store. A builder would produce roles that look real and enforce nothing. |
| Per-folder roles | Access is per folder (view/comment/edit), but the *role* is org-wide. Two independent ladders is how you get someone who is an admin everywhere except the folder they need. |
| Guest / external collaborator | The backend model is org → member. An external account would be a member in an org they don't belong to. |
| Role expiry / temporary access | No scheduler, and an expiry nobody enforces is worse than permanent access. |
| Audit of refused actions | The activity log records changes, not attempts. Refusals are not events. |

Each absence is stated in the product where a user would look for it, usually in
the closing note on the permissions page or as a "Planned" row in settings.

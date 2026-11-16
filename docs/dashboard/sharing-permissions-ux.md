# Orindle — Sharing Permissions UX

What the share dialog offers, what it refuses to offer, and why the gap between
those two lists is the point of this document.

---

## 1. The permission model

Exactly three levels exist in the contract:

| Level | Label in UI | What it means |
| --- | --- | --- |
| `viewer` | Can view | Open and download. No edits. |
| `commenter` | Can comment | View, plus leave comments. No edits to the file. |
| `editor` | Can edit | Modify the file's contents. |

`PERMISSION_LABEL` and `PERMISSION_DESCRIPTION` live in
`src/lib/drive/types.ts`. The dialog iterates those two maps and offers nothing
else.

**Not offered, because the backend does not enforce them:** "Can manage", "Full
control", "Owner transfer", "Can download but not print", password-protected
links, per-recipient expiry, and domain-restricted sharing. Every one of those is
a common cloud-drive feature and every one of those would be a selector that
saves a value nothing reads. A permission picker whose options don't map to
enforcement is a security theatre problem, not a UI gap.

---

## 2. Dialog anatomy

```
┌───────────────────────────────────────────────────────┐
│  Share “Quarterly report.pdf”                     ✕   │
│  Invite people by email, or send a link anyone can use│
├───────────────────────────────────────────────────────┤
│  Add people                                           │
│  ┌───────────────────────────────┐ ┌──────────┐┌────┐ │
│  │ ✉ name@example.com            │ │ Can view ▾││Send│ │
│  └───────────────────────────────┘ └──────────┘└────┘ │
│  Recipients can open and download this file.          │
├───────────────────────────────────────────────────────┤
│  WHO HAS ACCESS                                       │
│  (You)  You                             Owner         │
│  ⓘ No one else has access. Recipients appear here     │
│    once an invite is accepted.                        │
├───────────────────────────────────────────────────────┤
│  ◈ Anyone with the link              [Turn on]        │
│    Link sharing is off. Only people you invite...     │
└───────────────────────────────────────────────────────┘
```

Modal on desktop, bottom sheet below 640px. Focus is trapped, `Escape` closes,
focus returns to whatever opened it, and the email field takes autofocus.

---

## 3. The invite flow

1. **Validate on submit**, not on every keystroke. Typing "n" shouldn't already be
   an error.
2. **Reject empty** — "Enter an email address."
3. **Reject malformed** — "Enter an email address we can send to."
4. **Reject the owner's own address** when the record carries one.
5. **Submit** shows a pending state on the button, then reports the outcome.

The permission description under the field updates as the selector changes, so
the difference between "Can view" and "Can comment" is stated in words before
anyone commits to it, rather than inferred from a dropdown label.

Today step 5 always reports: *"Invite wasn't sent — your storage provider isn't
connected yet, so no changes were saved."* No email is sent, no grant is created,
and the dialog says so.

---

## 4. The access list

The list is built from the record, not from a member query:

- **Owner row** — the real owner. For an item you own it reads "You · Owner". For
  an item shared with you it reads the owner's display name and "Shared with you".
- **Recipients** — none exist yet. Rather than an empty box or a spinner, the
  section carries a note: *"No one else has access. Recipients appear here once an
  invite is accepted."*

This is the honest version of an empty list, and it doubles as an explanation of
when the list will fill.

Removing a recipient is not shown while there are no recipients to remove. When
grants arrive, the row gains a permission selector and a remove button, and
removal gets a confirmation because losing access is destructive to the other
person, not to you.

---

## 5. Link sharing

A two-state control, off by default:

- **Off:** "Link sharing is off. Only people you invite can open this."
- **On:** permission selector plus **Copy** and a **turn off** button.

**Copy never writes to the clipboard unless a link exists.** With no grant
server-side there is no URL to copy, and a clipboard containing a plausible-looking
but invalid link is worse than an error — the user pastes it to someone and the
failure happens out of sight. So Copy reports that there's no link yet.

When the backend lands, `copyLink()` gains a real URL and the rest of the
component is unchanged.

---

## 6. Expiry and access information

- **Expiry is not offered.** The contract has no expiry field, and a date picker
  that stores nothing is a false promise about a security control.
- **Access information is shown** where it's known: who owns the item and whether
  you're the owner or a recipient. The dialog header changes accordingly —
  *"Shared with you by Priya Sharma. You can change who else has access."*
- **Download/copy restrictions** are not offered for the reason in §1.

---

## 7. States

| State | UI |
| --- | --- |
| Empty email | Inline error under the field, `aria-invalid`, `role="alert"` |
| Malformed email | Same, different message |
| Pending | Button reads "Sending…", disabled, spinner-free |
| Failure | Destructive toast with the reason; dialog stays open with input intact |
| Success (future) | Row added to access list, field cleared, focus back to the field |
| No link yet | Error toast explaining why nothing was copied |

The dialog never closes itself on failure. Losing typed input because a request
failed is a small betrayal that people remember.

---

## 8. Backend contract

```ts
listGrants(itemId: string): Promise<DriveResult<ShareGrant[]>>
invite(input: { itemId: string; email: string; permission: PermissionLevel })
  : Promise<DriveResult<ShareGrant>>
revoke(input: { itemId: string; grantId: string }): Promise<DriveResult<null>>
createLink(input: { itemId: string; permission: PermissionLevel })
  : Promise<DriveResult<{ url: string; permission: PermissionLevel }>>
disableLink(input: { itemId: string }): Promise<DriveResult<null>>
```

`ShareGrant` carries `id`, `email`, `displayName`, `permission`, and
`acceptedAt | null`. The dialog already reads `item.owned` and `item.ownerName`,
which is all it needs to describe access before grants exist.

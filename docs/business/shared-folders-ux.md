# Orindle — Shared Folders UX

`/dashboard/business/folders` — the folders a team can reach, and the terms
they're reached on.

---

## 1. Why not a table

The obvious build is a table: name, owner, items, size, modified. It would be
wrong, for one reason — **a shared folder's defining property is who can get
into it, and that is not a column.** "3 people" doesn't distinguish a folder
locked to three individuals from one open to the whole company, and those two
folders need completely different amounts of attention.

So each folder is a card, and the card's lower half is an access summary in words:

```
┌──────────────────────────────────────┐
│ ▣  Client work                    ⋯  │
│    24 items · 3.2 GB                 │
├──────────────────────────────────────┤
│ 🌐 Everyone · Can view         +2     │
│ (AM)(PR)(SK)                          │
│ Priya Rao · 2 hours ago      [Access] │
└──────────────────────────────────────┘
```

Locked format: `🔒 2 with access` plus the faces of those two people.
Open format: `🌐 Everyone · Can view` plus `+2` when overrides exist and the
faces of anyone who has a different level from the default.

The `+N` badge and the faces answer different questions — "how many exceptions"
and "who are they" — and both are worth a small amount of space.

---

## 2. Layout

**≥1280px** three columns · **640–1279px** two · **<640px** one.

Cards are equal height within a row, with the access block pinned to the bottom
(`mt-auto`) so the summaries line up across the row and can be compared by
scanning down. Uneven card heights would break exactly the comparison the cards
exist for.

---

## 3. Empty state

`EmptyState` variant `first-use`, icon `FolderLock`, *"No shared folders yet."*

The body explains the concept rather than the feature: *"A shared folder is where
the team's work lives: everyone you choose can reach it, and you set what they
can do. It isn't a copy — it's one folder with one set of rules."* The last
sentence matters because people arrive expecting sharing to duplicate the folder.

The footnote is the reassurance that makes the action safe: *"Deleting a folder
later doesn't delete the files people have already downloaded."*

Non-creators get the same panel with the read-only variant and no button: *"An
owner or admin can create shared folders. Once they do, the ones you have access
to appear here."*

---

## 4. Creating a folder

`NameFolderDialog`, size `sm`, one field. Validation is deliberate about what a
folder name can't contain:

| Rule | Message |
| --- | --- |
| Empty | "Enter a folder name." |
| Contains `\ / : * ? " < > \|` | `A folder name can't contain \ / : * ? " < > \|` |
| Leading dot | "A folder name can't start with a dot." |
| Over 120 characters | "Keep the name under 120 characters." |

The reserved-character rule names the characters, because "invalid name" makes
people guess. Errors are `role="alert"` with `aria-invalid` and
`aria-describedby` on the input, and clear as soon as the field is edited.

The dialog's description sets the privacy expectation: *"Only you will be able to
see it until you give someone access."* A new folder starts closed.

Submitting reports *"Folder wasn't created"* with `BUSINESS_NOT_CONNECTED` — the
folder does not appear in the list, because no folder was created.

Rename uses the same component in `rename` mode with the current name
pre-filled, and its description says *"Renaming doesn't change who has access."*

---

## 5. The access dialog

`FolderAccessDialog` — the most important surface in this section.

It works on a **draft**. Nothing is applied until *Save access* is pressed, so
somebody can adjust several people without each click firing a request.

### Shape

1. **Organization-wide** — whether the folder is open to everyone, and at what
   level by default. One switch and one selector.
2. **Individual access** — one row per active member: avatar, name, email, and
   either a level `<select>` with a remove button, or a *Give access* button.

A search field appears above the member list once the organization has more than
six active members. Below that, a filter would be a control that never earns its
space.

Granting access defaults to **Can view**, not edit. Access is added at the
smallest level that does something useful, and widened deliberately; the reverse
— granting edit and hoping somebody notices — is how a shared drive ends up with
everyone able to delete everything.

### Draft semantics

Nothing is applied until *Save access*. The footer states the situation in words
— *"No changes"* or *"2 unsaved changes"* — and the save button is disabled at
zero.

The counter compares the draft against the **saved** folder record rather than
counting draft entries, so opening the dialog on a folder that already has
overrides reads "No changes" instead of a false positive. A counter that cries
wolf the moment a dialog opens trains people to ignore it, and then it fails to
warn when it matters.

Removing an override returns that person to the folder's default (or to no
access, when the folder isn't organization-wide). For members with an override,
the row shows the level selector and an explicit remove button rather than a
fourth "No access" option in the list — `No access` is the absence of a grant, and
listing it beside real levels makes it look like a fourth setting.

### The three levels

| Level | Label | Description shown |
| --- | --- | --- |
| `viewer` | Can view | Open and download. Cannot change anything inside. |
| `commenter` | Can comment | Open, download, and leave comments on files. |
| `editor` | Can edit | Add, rename and remove files inside this folder. |

`FOLDER_ACCESS_LABEL` and `FOLDER_ACCESS_DESCRIPTION` in `types.ts` are the only
place these are written. They appear identically in the folder dialog, the invite
dialog and organization defaults, so "Can comment" can't mean two things in two
screens.

`No access` is not a fourth level. It is the absence of a grant, and it's
expressed by removing the override — a separate button, not an option inside the
level list.

### Why one dialog beats a members page

The alternative design is a permissions table on the folder page listing every
member with a dropdown. It's overcrowded at 20 members, unusable at 200, and it
hides the thing that actually matters: whether the folder is open to everyone.
Putting organization-wide first, in a single checkbox, makes the biggest decision
the first one.

---

## 6. Deleting a folder

`ConfirmDialog`, destructive, `requireTyping={folder.name}`.

Type-to-confirm is used here and *not* for removing a member, because these two
actions differ in kind: removing somebody can be undone by inviting them again;
deleting a folder takes the files inside with it. The friction belongs on the
irreversible one.

Two dialogue surfaces, both guarded:

- The `Menu` item is disabled when the viewer lacks `folders.delete`.
- The confirm dialog states: *"Every file inside is removed for everyone in the
  organization. This can't be undone."*

---

## 7. Row actions

The card's `⋯` opens a `Menu`:

| Item | Guard | Notes |
| --- | --- | --- |
| Manage access | `folders.manageAccess` **and** `folder.canManage` | Opens the access dialog |
| Rename | `folders.manageAccess` | Same dialog component, rename mode |
| Delete folder | `folders.delete` | Destructive, separated above a rule |

`folder.canManage` is a per-folder fact from the backend, distinct from the
capability. Someone who can manage access generally might not be allowed on a
particular folder — that's a real case when folders are created by different
teams, and the card's *Access* button is disabled rather than hidden so the
folder still reads as manageable by somebody.

The *Access* shortcut on the card footer duplicates the menu item. That's
intentional: access is the thing people come to this page to change, so it gets
a primary position rather than a one-item-deep menu.

---

## 8. Responsive

| | Mobile <640 | Tablet 640–1279 | Desktop ≥1280 |
| --- | --- | --- | --- |
| Grid | 1 column | 2 columns | 3 columns |
| Card footer | Wraps; faces above the button | Inline | Inline |
| Access dialog | Full-screen sheet | `md` dialog | `lg` dialog |
| Member list in dialog | Scrolls within the sheet | Scrolls at `max-h` | Scrolls at `max-h` |
| Create | Header button, full width | Inline | Inline |
| Menu | Same, anchored to the `⋯` | Same | Same |

In the dialog on mobile the member list gets its own scroll container so the
organization-wide controls and the save button stay reachable — a full-page
scroll that pushes *Save* off-screen is how people abandon a permission change
half-finished.

---

## 9. Contract

```ts
folders(orgId): Promise<BusinessResult<BusinessFolder[]>>
folder(orgId, folderId): Promise<BusinessResult<BusinessFolder>>
createFolder(orgId, { name }): Promise<BusinessResult<BusinessFolder>>
renameFolder(orgId, folderId, name): Promise<BusinessResult<BusinessFolder>>
deleteFolder(orgId, folderId): Promise<BusinessResult<null>>
setFolderAccess(orgId, folderId, {
  openToOrganization: boolean;
  defaultAccess: FolderAccess;
  grants: Array<{ memberId: string; access: FolderAccess }>;
}): Promise<BusinessResult<BusinessFolder>>
```

`setFolderAccess` takes the complete desired state rather than a diff, so a save
is a single idempotent request — a series of per-grant calls would leave the
folder in a half-applied state if the third one failed.

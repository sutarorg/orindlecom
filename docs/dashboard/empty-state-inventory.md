# Orindle — Empty State Inventory

Every empty state in the dashboard, the situation it covers, and its exact copy.

The rule that shapes this inventory: **two empty states that look identical should
be the same state, and two situations that differ should not look identical.**
"Your library has nothing in it" and "your filter matched nothing" are not the
same problem and must not share a layout.

Eleven routes, twelve states (My Files has two: first-use and filter-miss).

---

## Variants

| Variant | Weight | Used when |
| --- | --- | --- |
| `first-use` | Largest — illustration, 19–22px heading, three elements | The product is introducing itself. Earns the space. |
| `collection` | Medium — 48px icon plate, 14px heading | The library exists; this particular view is empty. |
| `inline` | Smallest — no plate | Empty panel inside an existing card. |
| `error` | Medium, destructive tint | A load failed, always with a retry. |

---

## 1. `/dashboard` — Overview

**Situation:** new account, nothing uploaded. `usage.fileCount === 0` and
`folderCount === 0`.

> *(illustration: folder with sheets lifting out, upload badge)*
>
> ### Your files start here.
> Upload your first file to make Orindle your home for digital storage.
>
> **[ Upload files ]**
>
> Or drag files anywhere on this page.

The populated sections — Recently opened, Recent activity — do not render at all
when they have no data. They are not shown empty; they are absent. A card that
exists only to say "nothing here yet" is clutter, and on a first visit it would
mean three such cards stacked above the one that matters.

**Situation:** has files, but has never opened one.

> ### Nothing opened yet
> Files you open will show up here. Recently opened and recent activity only
> appear once there's something to report.
>
> → Go to My Files

---

## 2. `/dashboard/files`

**Situation:** first use.

> *(same illustration as Overview)*
>
> ### Your files start here.
> Upload your first file to make Orindle your home for digital storage.
>
> **[ Upload files ]**
>
> Files you upload appear here immediately, newest first.

**Situation:** search or filter matched nothing.

> *(search icon plate)*
>
> ### Nothing matches those filters
> No files here match the current search or type filter. Clearing them brings the
> full list back.
>
> **[ Clear filters ]**

This second state is what makes the first one trustworthy. If filtering to zero
showed "Your files start here", a user with 400 files would think they'd been
deleted.

---

## 3. `/dashboard/folders`

**Situation:** no folders created.

> *(illustration: nested folder tree)*
>
> ### No folders yet.
> Folders keep related files together and let you share a whole set of work with
> one permission.
>
> **[ New folder ]**
>
> You can always move files into a folder later.

Note the action is **New folder**, not Upload — on a page about folders, the
primary action creates a folder.

---

## 4. `/dashboard/folders/[id]`

**Situation:** the folder exists and is empty.

> *(folder-open icon plate)*
>
> ### This folder is empty.
> Add files here, or move existing ones in from My Files.
>
> **[ New folder ] [ Upload files ]**
>
> Only folders and files that live directly here are listed.

Distinct from the Folders route: here the folder *does* exist, which is why the
copy says "this folder" and why Upload is offered alongside New folder. The
footnote pre-empts the most common question about nested views.

The card has a 320–380px minimum height so an empty folder keeps the page's
shape instead of collapsing to a strip.

---

## 5. `/dashboard/recent`

**Situation:** nothing opened.

> *(card with clock)*
>
> ### Nothing opened yet.
> Files you open show up here, newest first. This list is built from your actual
> activity — it can't be filled in for you.
>
> **[ Go to My Files ]**
>
> Opening a file doesn't move or copy it.

The explicit "it can't be filled in for you" does real work: it tells the user
that the emptiness is a property of the feature, not a bug or a slow load.

---

## 6. `/dashboard/starred`

**Situation:** nothing starred.

> ### Nothing starred yet.
> Star a file or folder and it lands here — a shortcut for the things you return
> to.
>
> **[ Browse your files ]**
>
> Starring doesn't move or copy anything.

---

## 7. `/dashboard/shared`

**Situation:** nothing shared in either direction.

> ### Nothing shared yet.
> When someone shares a file with you it appears here. Files you share with others
> appear here too, with who can see them.
>
> **[ Open My Files ]**
>
> You control access at any time from the Share dialog.

Covers both directions, because this route shows both and the usual empty state
only explains one.

---

## 8. `/dashboard/trash`

**Situation:** nothing deleted.

> *(trash icon plate)*
>
> ### Trash is empty.
> Nothing has been deleted. When you delete a file it waits here for 30 days
> before it's removed for good.
>
> Files you delete from Trash can't be recovered.

Preceded by a retention banner that reads the window from `TRASH_RETENTION` and,
while `approved` is false, adds: *"This retention window is provisional and may
change before launch."*

"Empty Trash" and "Restore all" are **not rendered** when the list is empty. A
button that acts on nothing is a dead control.

---

## 9. `/dashboard/storage`

**Situation:** usage not measured by the backend (`authoritative: false`).

> ### No usage breakdown yet
> A per-category split needs measured file sizes from storage. Until that's
> connected, Orindle shows the plan allowance rather than an estimated chart.

Inline variant, inside the "What's using space" card. The capacity figures above
it are still real — the plan allowance is known even when the composition isn't.

---

## 10. `/dashboard/billing`

**Situation:** no invoices.

> *(receipt icon plate)*
>
> ### No invoices yet
> Receipts appear here after your first payment. Orindle doesn't generate
> placeholder invoices.
>
> Card details are never stored on Orindle servers.

---

## 11. `/dashboard/settings`

**Situation:** notification preferences don't exist yet.

> ### Nothing to configure yet
> Orindle doesn't send email notifications today, so this page shows no switches
> rather than switches that do nothing. Preferences will appear here when delivery
> exists.

This is the only empty state in the product that exists to justify *absence of a
control* rather than absence of data. It is worth the space: without it, the
notification section looks broken or unfinished.

**Situation:** no sessions to list.

> Active sessions — "Session management isn't wired up yet" — with an em dash in
> the value column.

---

## 12. `/dashboard/profile`

No empty state. The page renders the viewer's identity, plan and storage, all of
which exist from the first request. A profile with nothing to show isn't a state
this app can reach.

---

## Copy rules applied throughout

1. **Say what the state is, then what will change it.** Two sentences, in that
   order.
2. **No "Oops", no "Uh oh", no exclamation marks.** A storage product's empty
   state is not a personality moment.
3. **Never blame the user.** "Nothing opened yet", not "You haven't opened
   anything".
4. **Footnote the surprising consequence.** "Opening a file doesn't move or copy
   it" answers the question the empty state creates.
5. **The action must be the thing this screen is about.** Folders offers New
   folder. Recent offers a route to files. Trash offers nothing.
6. **Silence beats a false positive.** If a section has no data, it is absent, not
   rendered empty — with the single exception of the Settings notification note,
   which exists to explain a missing control.

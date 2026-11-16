# Orindle — Personal Dashboard Specification

The visual and structural contract for the signed-in product. Values come from
`docs/design/design-system.md` and `src/styles/tokens.css`; nothing here invents
a colour, radius or type size that isn't already in the token layer.

**The governing rule of this phase:** the dashboard shows what the backend
actually knows. Where it knows nothing, the interface says so plainly and offers
the next action. There is no seeded content, no placeholder activity feed, no
estimated storage chart.

---

## 1. What this dashboard is

A personal cloud-storage workspace: one person, their files, their plan. Not an
admin console. Nothing on screen is furniture — every panel either holds real
records or explains, in the space it would have occupied, why it is empty and
what will fill it.

The product lives at `/dashboard` and eleven routes below it:

| Route | Purpose | Data source |
| --- | --- | --- |
| `/dashboard` | Overview: greeting, storage, recent, activity | `usage()`, `list({scope:"recent"})`, `activity()`, `list({scope:"starred"})` |
| `/dashboard/files` | The canonical file manager | `list({scope:"files", parentId:null})` |
| `/dashboard/folders` | Folder-only listing | `list({scope:"folders"})` |
| `/dashboard/folders/[id]` | One folder, with breadcrumbs | `get(id)`, `list({scope:"files", parentId:id})` |
| `/dashboard/recent` | Recently opened files | `list({scope:"recent"})` |
| `/dashboard/starred` | Starred files and folders | `list({scope:"starred"})` |
| `/dashboard/shared` | Shared in and shared out | `list({scope:"shared"})` |
| `/dashboard/trash` | Deleted items, restorable | `list({scope:"trash"})` |
| `/dashboard/storage` | Plan, capacity, usage breakdown | `usage()` |
| `/dashboard/billing` | Subscription, plans, invoices | `subscription()` |
| `/dashboard/settings` | Profile, security, deletion | `getViewer()` |
| `/dashboard/profile` | Read-only account summary | `getViewer()`, `usage()`, `subscription()` |

Every route is `force-dynamic` and `noindex`. A dashboard behind auth has no
business in a search index, and its content is per-request by definition.

---

## 2. The shell

### Grid

```
≥1024px   248px sidebar  │  flexible main  (sidebar collapsible to 68px rail)
768–1023  auto-collapsed 68px rail on first visit, expandable
<768px    no rail — sidebar becomes a full-height overlay sheet
```

The sidebar never shrinks below 768px into a squeezed rail. A 40px icon strip on
a phone is a desktop layout that has given up, not a mobile one.

### Sidebar

Three groups, separated by rule and label rather than boxes:

- **Library** — Overview, My Files, Folders
- **Collections** — Recent, Starred, Shared, Trash
- **Account** — Storage, Billing, Settings

Above the groups, two actions: **Upload** (primary, full width) and **New
folder** (secondary). Below them, a storage meter that links to
`/dashboard/storage`. Collapsed, the groups keep their icons, the labels move to
tooltips via `title`, and the meter becomes a vertical bar with the percentage.

The active state is a `--brand-surface-muted` fill with a 2px `--brand-primary`
left bar and `font-medium` ink text. Not a solid blue block: the reference uses
weight and a hairline accent, and a solid fill at this density would compete with
the Upload button directly above it.

### Topbar

60px, sticky, `--brand-border-soft` rule beneath. Left: mobile nav button (below
768px), then breadcrumbs. Right: search, help, account menu.

**Search is conditional on a list being present.** The field mounts in the shell
but only appears when a mounted list registers itself through the search bridge
(`src/components/dashboard/search-bridge.tsx`). On Overview, Storage, Billing,
Settings and Profile there is no field, because there is nothing to filter — a
search box that swallows keystrokes is worse than no search box.

Keyboard: `/` focuses the field from anywhere outside an input. `Escape` clears
the query if there is one, otherwise blurs. Both behaviours are on the input
itself, so they work whether the focus arrived by keyboard, click or `/`.

### Main region

Every route: a page header (title, one-sentence description, primary action),
then content constrained to a shared measure — 1180px for list routes, 860px for
settings-shaped routes, 760px for Profile. Consistent left edge across routes
matters more than filling a 4K monitor.

---

## 3. Type and spacing

Inherited, not redefined:

- Page title `20px/24px` extrabold, `-0.035em` tracking
- Body `12.5–13px`, `--brand-body-tracking`
- Metadata `10.5–11.5px` in `--brand-text-subtle`
- Card padding `16px`; row padding `10px × 16px`; grid gap `10–12px`

The dashboard runs a step tighter than the marketing site. A file list at 16px
body text reads as a document, not a workspace.

---

## 4. Component inventory

| Component | File | Notes |
| --- | --- | --- |
| `DashboardShell` | `dashboard-shell.tsx` | Sidebar, topbar, mobile drawer, FAB, upload mounts |
| `Sidebar` | `sidebar.tsx` | Groups, collapse, storage meter |
| `Topbar` | `topbar.tsx` | Breadcrumbs, search, help, account menu |
| `PageHeader` | `page-header.tsx` | Title, description, action slot |
| `FileManager` | `file-manager.tsx` | Container: store + toolbar + grid/list + selection + preview + dialogs |
| `FileGrid` / `FileList` | `file-grid.tsx` / `file-list.tsx` | Two views over one store |
| `FileToolbar` | `file-toolbar.tsx` | Search, sort, filter, view toggle |
| `SelectionBar` | `selection-bar.tsx` | Replaces the toolbar while a selection exists |
| `PreviewPanel` | `preview-panel.tsx` | Non-modal desktop panel / mobile sheet |
| `ShareDialog` | `share-dialog.tsx` | Invite, permissions, link sharing |
| `UploadManager` | `upload-manager.tsx` | Queue, progress, tray, failure states |
| `UploadZone` | `upload-zone.tsx` | Drag-and-drop target, compact and full |
| `Dialog` / `ConfirmDialog` | `ui/dialog.tsx` | Focus trap, sheet on mobile, type-to-confirm |
| `Menu` | `ui/menu.tsx` | One menu instance per surface, anchor in state |
| `EmptyState` | `ui/empty-state.tsx` | Four variants: first-use, collection, inline, error |
| `DriveProvider` | `drive-store.tsx` | Sort, filter, search, selection, view mode, preview |

---

## 5. Empty, loading and error states

Every route has an empty state that is specific to *why* it is empty — see
`empty-state-inventory.md` for all eleven and their copy.

Loading uses `.skeleton` blocks shaped like the content they replace, never a
centred spinner over a blank page. Errors surface as a destructive-tinted
`EmptyState` with a retry action, or as a toast when the failure is a side effect
of an action rather than the page's reason for existing.

---

## 6. What is deliberately absent

Each of these was considered and rejected for this phase:

- **A notifications bell.** There is no notification delivery, so a bell would
  be a decorative control with an empty panel behind it.
- **A storage breakdown chart when usage isn't measured.** The model exposes
  `authoritative`; when false, the page says the allowance is known but the
  composition isn't.
- **Breadcrumb dropdowns that list sibling folders.** They need a folder tree
  query that doesn't exist yet. The trail is linear and every crumb navigates.
- **Drag-to-move between folders.** The repository has `move()`, but there is no
  drop target outside the current folder in scope, and a drag that silently
  fails is worse than a menu item that explains itself.
- **A "recently opened" list built from anything other than `openedAt`.**

---

## 7. Backend handoff

`DriveRepository` (`src/lib/drive/repository.ts`) is the only seam. Components
never touch a storage provider. `createEmptyDriveRepository()` is what ships
today: reads return empty arrays, writes return `not_configured`. Wiring a real
backend means writing one adapter and calling `setDriveRepository()`.

No component constructs a `DriveItem`. No component derives storage usage from a
paginated list. Both rules exist so a wrong number can never come from the client.

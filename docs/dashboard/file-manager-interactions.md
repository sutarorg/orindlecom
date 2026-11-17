# Orindle — File Manager Interactions

Every interaction in the file manager, what triggers it, what it does, and what it
does when the backend isn't there. The last column is not an afterthought: on
this deployment almost every write is unbacked, and the rule is that an unbacked
action reports itself rather than doing nothing.

---

## 1. Two views, one store

Grid and list are the same data through two renderers, both driven by
`DriveProvider`. Switching views preserves selection, sort, filter and search —
only the layout changes. The choice persists to `localStorage` under
`orindle:view`, because someone who prefers a list will prefer it tomorrow.

| | Grid | List |
| --- | --- | --- |
| Best for | Images, mixed libraries, thumbnails | Dense document sets, scanning by date or size |
| Columns | — | File name, Type, Modified, Size, Actions |
| Column hiding | — | Type at <768px, Modified at <640px, Size at <1024px |
| Mobile | 2 columns, metadata on one line | Single line with name + metadata beneath |

Narrow screens drop columns rather than shrinking them. A 60px "Size" column
holding "175 MB" is not an adapted layout.

**One plate shape, 16:10, for both kinds.** Grid tiles used to be square for files and
landscape for folders, so a mixed grid had two card heights and its rows stepped
wherever the two met. The square was also the wrong crop for the commonest content —
screenshots, photos and landscape phone shots all lost their sides to it. Everything is
16:10 now, the server thumbnail is cropped to the same shape (a square thumbnail under
a landscape plate is cropped twice), and the folder glyph is sized by the plate's
height rather than to a fixed 70 × 58 sticker that floated in the middle of a big card.

---

## 2. Keyboard model

Both surfaces are `role="grid"` with roving tabindex: one tile or row is in the
tab order, everything else is reachable by arrow keys. This is the pattern screen
readers expect from a table-of-files, and it keeps the tab stop count at one per
surface instead of one per file.

| Key | Action |
| --- | --- |
| `↑ ↓ ← →` | Move focus within the grid |
| `Home` / `End` | First / last item |
| `Enter` | Open — folder navigates, file opens preview |
| `Space` | Toggle selection of the focused item |
| `Shift` + click / `Space` | Select the range from the anchor |
| `Ctrl`/`Cmd` + click | Add or remove one item |
| `Ctrl`/`Cmd` + `A` | Select everything visible (only inside the grid) |
| `Shift` + `F10` or menu key | Open the context menu |
| `Escape` | Close menu, preview or dialog; clear selection when nothing is open |
| `/` | Focus the search field |

`Ctrl+A` is scoped to `[data-drive-surface]` so it still selects text inside the
search box.

---

## 3. Selection

Selection is a set of ids, with an anchor for range selection. It survives
sorting and filtering, but not a route change.

- While anything is selected, unselected tiles drop to 70% opacity so the
  selection reads at a glance rather than by hunting for checkmarks.
- The toolbar is replaced by the selection bar: count, "Select all", then
  Download, Star, Share, Delete (destructive).
- Below 640px the selection bar's actions collapse into an overflow menu;
  the count and the clear button stay visible.
- `Escape` clears the selection when no overlay is open.

---

## 4. The context menu

One `<Menu>` per surface, not one per row. The anchor and the item are held in
state (`{item, anchor}`), and the menu renders once with that anchor. Rendering a
portal per row would mean 400 portals for 400 files.

Items, by mode:

| Mode | Menu |
| --- | --- |
| Default (files) | Preview · Select · Add to Starred · Share · Move to Trash |
| Default (folders) | Open · Select · Add to Starred · Share · Move to Trash |
| Starred | Open · Select · Remove from Starred · Share · Move to Trash |
| Shared | Open · Select · Share · Move to Trash |
| Trash | Restore · Select · Delete permanently |

Every entry carries an icon. "Preview" did not, so it read as a heading above a list
of icons rather than as something you could press.

**Two rules the menu learned the hard way.**

*No item is highlighted on open.* The first entry used to receive focus, and the
focus background then painted it — which reads as "already chosen". In the bin that
made "Restore" look like the default action on a deleted file. The panel itself takes
focus now (`tabIndex={-1}`), and `ArrowDown` moves into the list from there.

*A menu click stops at the menu.* The panel is a portal, and a portal changes where
its children paint, not who their React parent is: a click on "Share" bubbled through
the component tree to the tile that owned the trigger and ran the tile's `onClick`,
opening the preview behind the menu. `event.stopPropagation()` on the item is the fix
at the source — a menu action answers "what may I do with this row", it is not a click
*on* the row.

Each menu dismisses on `Escape`, on outside click, on scroll, and returns focus to
its trigger when it closes.

---

## 5. Sort and filter

Sort keys: name, modified date, size, type. Clicking the active key reverses
direction. Default is name ascending — except Recent, which defaults to modified
descending because that ordering is the whole point of the collection.

**Folders always sort before files.** This is not configurable, and it is applied
inside `sortItems()` so no view can accidentally break it.

Filter is a category multi-select with a count badge on the trigger. Categories
come from `FileCategory`; an empty set means no filter. Filters are hidden on
Recent, Starred, Shared and Trash, where narrowing by type adds friction to a
list that is already small.

When a filter or search is active and produces nothing, the empty state is the
"Nothing matches those filters" variant with a clear action — not the route's
first-use state. Conflating "you have no files" with "your filter matched
nothing" is the most common empty-state bug in file managers.

---

## 6. Search

Three things can filter by text, and they are all the same state:

1. The toolbar field
2. The topbar field, via the search bridge
3. The `/` shortcut, which focuses the topbar field

Typing in any of them narrows both views and updates the "matching …" notice
above the grid. Clearing is a single click in either field, and `Escape` clears.

Matching is case-insensitive substring against the name. When the backend lands,
`onQueryChange` fires with sort/search/filter so a live repository can refetch
server-side instead of filtering in memory — the callback exists now and is a
no-op because the list is already complete.

---

## 7. Preview

Clicking a file, or `Enter` on a focused one, opens the preview panel.

- **Desktop (≥1024px):** a 380px non-modal panel on the right. `aria-modal="false"`
  and no scroll lock, because the list stays interactive — arrow keys step through
  siblings while the panel is open. A modal over a list you want to keep browsing
  is the wrong shape.
- **Below 1024px:** a bottom sheet with a scrim and scroll lock, because there is
  no room for both.

**Opening it costs one round trip, and usually none.** A preview needs a signed URL
before it can request a single byte, so the panel keeps the minted URL for four
minutes (inside the five-minute life of the signature) and reuses it: reopening a file
you just looked at paints with no request. The neighbouring files in the folder are
prefetched while you read, so arrow-key stepping has nothing to wait for.

The stage also used to sit on "Loading preview…" forever. `setLoading(false)` was
called only on the error branch, and the render checks `loading` before anything else —
so a *successful* load left the spinner up while the image had already arrived. The
flag now means "waiting for an address" and is cleared as soon as one is known.

The panel shows a stage per category (image, PDF, text, video, audio, and a
designed "no source" state for the rest), then metadata — type, size, modified,
owner — then Download and Share.

Sibling navigation counts files only. Folders aren't previewable, so including
them made the "3 of 12" counter wrong.

---

## 8. What each action does today

| Action | Result |
| --- | --- |
| Open folder | Navigates to `/dashboard/folders/[id]` — works end to end |
| Preview file | Opens the panel with metadata and a no-source stage |
| Share / Copy link | Opens the share dialog; sending reports that nothing was sent |
| Rename | Dialog with validation, then reports nothing was saved |
| Move to Trash | Confirmation, then reports nothing was deleted |
| Restore / Delete permanently | Same pattern, with type-to-confirm for permanent |
| Star | Reports that starring isn't stored yet |
| Download | Reports that the file can't be fetched yet |
| Upload | Runs the full progress UI and fails at 96% with an explanation |

Every one of those failures uses `NOT_CONNECTED_MESSAGE` from the repository
module, so the wording is in one place and changing the backend story changes it
everywhere.

---

## 9. Why nothing marks itself successful

The upload path deliberately tops out at 96% and then fails. It is the one
simulated number in the interface, and it exists so the progress states — queued,
preparing, uploading, finalising, failed, cancelled — can be designed and
reviewed before the transport exists. It never reaches `complete`, because
`complete` is reserved for a repository confirmation.

The same principle governs Rename, Move, Share and Delete: a successful-looking
toast for an operation that didn't happen is a data-loss bug wearing a checkmark.

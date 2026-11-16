# Orindle — Responsive Dashboard

How the dashboard changes across three device classes. The rule that governs all
of it: **the mobile layout is a different arrangement, not a smaller one.**

---

## 1. Breakpoints

| Name | Range | Reference |
| --- | --- | --- |
| Mobile | < 640px | 390 (iPhone 14/15), 430 (Pro Max) |
| Small tablet / phablet | 640–767px | 744 |
| Tablet | 768–1023px | 768, 834, 1024 edge |
| Desktop | ≥ 1024px | 1280, 1440, 1920 |

Verified matrix: **390, 430, 768, 1024, 1280, 1440** across all eleven routes —
66 screenshots, audited for horizontal overflow, undersized touch targets and
console errors.

---

## 2. Desktop (≥1024px)

- Persistent 248px sidebar, collapsible to a 68px icon rail.
- Topbar 60px: breadcrumbs left, search + help + account right.
- Content 1180px for lists, 860px for settings-shaped pages, 760px for Profile.
- Grid: 4 columns at 1024–1535, 5 at ≥1536.
- List: all five columns visible.
- Preview: a 380px docked right panel, non-modal.
- Selection bar replaces the toolbar in place.

---

## 3. Tablet (768–1023px)

- The sidebar rail: 68px, auto-collapsed on first visit and expandable. Expand
  overlays the content rather than pushing it, so the file grid doesn't reflow
  when someone peeks at the labels.
- Grid drops to 3 columns at 768–1023.
- List hides Size (returns at ≥1024); keeps Type and Modified.
- The upload tray docks bottom-right at 380px.
- Preview stays a docked panel until 1024 where it begins to crowd the grid —
  below that it becomes a sheet.
- Toolbar keeps search inline with the sort/filter/view cluster on one row.

---

## 4. Mobile (<768px)

### Navigation

No rail. The sidebar becomes a full-height overlay sheet from the left, with a
scrim, scroll lock, `Escape` to close, a `Tab` trap, and focus restored to the
trigger. The sheet carries the same groups, the same Upload and New folder
actions, and the same storage meter — nothing is dropped, it is just elsewhere.

### Topbar

48px, tighter: menu button, breadcrumbs truncated to the last crumb, account
avatar. Search moves into the page as part of the toolbar, where it has room.

### Page header

Title and description stack; the action row sits beneath them. On the files route
"New folder" and "Upload files" sit side by side, both at full tap height.

### Toolbar

Two rows instead of one:

1. Search — full width
2. Sort (label hidden, arrow only), Filter, and the grid/list toggle

The sort button carries `aria-label="Sort by Name, ascending"` because its visible
label is hidden at this width — an unlabelled icon button is the classic mobile
accessibility regression.

### Grid and list

- **Grid:** 2 columns at 390–639, tiles 160px wide.
- **List:** one row per item, name and metadata stacked on two lines. Type,
  Modified and Size columns are removed, not squeezed. The header keeps only the
  Name sort control.

### Selection

The selection bar collapses to: count, clear, and one overflow menu holding
Download, Star, Share and Delete. The destructive item stays last and separated.

### Upload

A 52px floating action button, bottom-right, clear of the safe area, hidden while
a dialog is open. `<main>` carries 96px of bottom padding so the last row can
always scroll clear of it.

### Dialogs

Every dialog becomes a bottom sheet below 640px: full width, rounded top corners,
slide-up animation, drag handle, safe-area padding at the bottom. Confirm dialogs
with type-to-confirm keep the input visible above the keyboard.

---

## 5. Touch targets

The audit enforces a 24×24px minimum for every interactive element, and the
design targets 40px+ for primary actions. Three findings from the first pass were
fixed rather than waived:

| Element | Was | Now |
| --- | --- | --- |
| "Manage account security" (Profile) | 153×19 | 153×24 |
| "Cancel subscription" (Billing) | 107×19 | 107×24 |
| "See all" / "Manage" (Overview) | 47×18, 60×19 | 24px min height |

Text links get `min-h-6` with `inline-flex items-center`, which raises the hit
area without changing the visual rhythm.

---

## 6. Layout invariants

Held at every width, checked by the screenshot audit:

- No horizontal overflow on any route at any width.
- No console errors, on any route, at any width.
- Sidebar and topbar never overlap content.
- Every empty state keeps its heading, description and action visible without
  scrolling at 390×844.
- The grid never renders a column narrower than 140px.
- Focus rings are never clipped by an overflow container.

---

## 7. Motion

All transitions respect `prefers-reduced-motion`. The reduced-motion path
collapses durations to `1e-06s` rather than removing transitions, so state still
changes — it just doesn't take time. Sheet and dialog entry animations, the toast
slide, the menu fade and the progress bar width transition all honour it.

The rule for choosing what animates: only things that explain a change. The
selection bar replacing the toolbar, the preview panel entering, a toast
arriving. Nothing decorative, and nothing that delays an action.

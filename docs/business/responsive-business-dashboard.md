# Orindle — Responsive Business Dashboard

How the organization workspace changes across three device classes. The rule is
the same one the personal dashboard uses: **the mobile layout is a different
arrangement, not a smaller one.**

The constraint behind most of these decisions is that team management is done in
short bursts — an invitation sent from a phone between meetings, a role changed
from a tablet on a call. It is rarely a long sit-down, so the compressed layouts
have to be complete rather than degraded.

---

## 1. Breakpoints

| Name | Range | Reference width |
| --- | --- | --- |
| Mobile | < 640px | 390, 430 |
| Small tablet | 640–767px | 744 |
| Tablet | 768–1023px | 768, 834 |
| Desktop | ≥ 1024px | 1280, 1440, 1920 |

Content widths: **1180px** for list-shaped pages (overview, members, folders,
permissions), **900px** for settings, storage and activity — prose-adjacent pages
where a wide measure makes rows hard to trace.

---

## 2. Desktop (≥1024px)

- Persistent 248px sidebar, collapsible to a 68px icon rail. In a business
  workspace the rail shows the organization mark, not the personal one.
- Sidebar carries the workspace switcher above the navigation, then three groups:
  **Organization** (Overview, Members, Shared folders) · **Access** (Roles &
  permissions, Activity) · **Workspace** (Storage, Settings).
- Storage meter in the sidebar footer links to `/dashboard/business/storage` and
  reads the organization's allowance, not the viewer's personal usage.
- Topbar 60px: breadcrumbs starting at "Organization", then search, help, account.
- Members: full five-column table.
- Folders: three cards per row.
- Permissions: the matrix fits without scrolling; three role cards across the top.
- Activity: 200 events in one scroll with sticky day headings.

---

## 3. Tablet (768–1023px)

- The sidebar rail at 68px, expandable. Expanding **overlays** the content instead
  of pushing it, so the member table doesn't reflow when somebody peeks at a
  label.
- Members: the table still runs, with the joined-date column dropped. Status stays
  — it's the column people scan for.
- Folders: two cards per row.
- Permissions: the matrix scrolls horizontally within its own container
  (`overflow-x-auto`, `min-w-[520px]`). The page itself never scrolls sideways; a
  matrix is genuinely wider than a tablet, so it gets a scroller rather than a
  redesign.
- Dialogs: `md`/`lg` centred, with the folder dialog's member list capped at
  `max-h-[240px]`.
- Overview: the two-column layout collapses at 1024, so on tablet the storage card
  and access summary stack below the main column rather than squeezing beside it.

---

## 4. Mobile (<640px)

- **Navigation.** A drawer from the sidebar trigger, containing the workspace
  switcher and the compact business navigation. The switcher stays at the top of
  the drawer — the "which workspace am I in" question is more urgent on a phone,
  because the surrounding context that usually answers it isn't visible.
- **Breadcrumbs** truncate from the left, keeping the current page name.
- **Members become cards.** Avatar and name on the first line, role and status on
  the second, actions in a footer row. Status also appears inline under the email
  in the table at 640–767, so no view loses it.
- **Filters stack.** Search full width, then status tabs in their own horizontally
  scrollable strip. Neither shrinks below a comfortable tap target.
- **Folders go to one column**, with the access summary still pinned to the card
  bottom.
- **The folder access dialog becomes a full-screen sheet.** Two reasons: it has a
  member list that needs vertical room, and every member row has a select and a
  button that need horizontal room. A centred `lg` dialog on a 390px viewport
  would clip both.
- **Invitation dialog is full-screen** with sections stacked: email, then role
  cards, then optional folder access. The send button sits in a sticky footer so
  it stays reachable regardless of scroll position.
- **The permissions matrix scrolls horizontally** rather than collapsing to cards.
  A comparison is only useful side by side; three separate role cards with their
  own tick lists would force the reader to hold one list in memory while reading
  the next.
- **Activity** keeps day headings but drops the actor's email to its own line.
- **Storage** stats go from four across to two by two.

---

## 5. Touch and accessibility

- Minimum target 36px for secondary controls, 40px for primary actions. Icon-only
  buttons carry `aria-label`.
- Row action menus open on tap with the anchor computed from the trigger, not the
  pointer position, so they don't land half off-screen.
- Selection and focus use `focus-visible` rings, so a touch that opens a dialog
  doesn't leave a focus ring behind it.
- Menus and dialogs close on backdrop tap and on `Escape`.
- Every status is written as well as coloured. `MemberStatusPill` renders the
  label; the permission matrix carries `sr-only` "Allowed"/"Not allowed" per cell;
  the timeline's tone is decorative on top of a full sentence.
- Long dialogs scroll their own body, not the page, so the footer action stays
  reachable.

---

## 6. Overflow and reflow rules

- Wide tables (members) reflow into cards at 768; the permissions matrix
  horizontally scrolls instead, because its cells are ticks with no card
  equivalent.
- Card grids step 3 → 2 → 1 without intermediate fractional columns.
- No element relies on `hidden` being overridden by a `flex` on the same element —
  responsive display classes sit on the definition, not on a wrapper.
- Numeric summaries (`0 B of 10 GB`, percentages, counts) use `tabular-nums` so
  meters and stat blocks don't jitter as values change.
- Sidebar width is a token (248/68); nothing hard-codes a nav width.

---

## 7. Route-by-route summary

| Route | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| `/dashboard/business` | Checklist stacks; invite opens full-screen | Two-column from 1024 | Full two-column summary |
| `/members` | Cards, stacked filters | Table, joined column dropped | Five-column table |
| `/folders` | 1 column | 2 columns | 3 columns |
| `/permissions` | Role cards, matrix scrolls | Matrix scrolls | Matrix fits |
| `/storage` | Stats 2×2, meters full width | Single column | Single column, 900px |
| `/activity` | Timeline, longer rows | Timeline | Timeline with full meta |
| `/settings` | Sections stack, delete at the end | Single column | Single column, 900px |

---

## 8. Verification

Without a browser in the build sandbox, verification is done by rendering every
route server-side and reading the emitted markup:

- All seven routes return 200 and a full document.
- The business shell renders both navigations in separate DOM trees (personal for
  the mobile drawer, business for the workspace) with the correct labels.
- Empty states are present and worded as designed.
- No route emits a horizontal scroll container outside the permissions matrix.

A screenshot matrix across 390/430/768/1024/1280/1440 remains the right final
check and is listed as outstanding rather than claimed.

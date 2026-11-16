# Orindle — Business Dashboard Specification

The organization workspace: one place for a team's people, its shared folders and
its storage allowance.

This is the same product as the personal dashboard, approached from a different
starting point. The personal dashboard answers *"where are my files?"*. The
business dashboard answers *"who is on my team, what can they reach, and is
anything about to break?"*. Both use the same typography, buttons, icons,
shadows, borders and spacing. What changes is the information architecture, not
the theme.

---

## 1. Scope

**Frontend only.** There is no organization service at the end of this build.
Every read goes through `BusinessRepository`, and on a deployment without one the
reads resolve empty and the writes report `BUSINESS_NOT_CONNECTED`. Nothing on
these screens is invented to fill the space.

| In scope | Out of scope |
| --- | --- |
| Seven business routes and their flows | Any backend, database or email work |
| Role and capability model, enforced client-side | Custom role builder (no permission store) |
| Complete invitation states | Payment provider integration |
| Folder access configuration | File-level sharing inside a shared folder |
| Honest empty and unconfigured states | Seeded demo data of any kind |

---

## 2. Routes

| Route | Screen | Why it exists |
| --- | --- | --- |
| `/dashboard/business` | Overview | Orientation: what is set up, what needs attention |
| `/dashboard/business/members` | Members | The roster and every action on a person |
| `/dashboard/business/folders` | Shared folders | What the team can reach, and on what terms |
| `/dashboard/business/permissions` | Roles & permissions | The boundary model, in one comparative table |
| `/dashboard/business/storage` | Team storage | The shared allowance and what is using it |
| `/dashboard/business/activity` | Activity | The audit trail of who changed what |
| `/dashboard/business/settings` | Settings | Profile, defaults, governance, deletion |

All seven are `force-dynamic` and `noIndex`. Each is wrapped by
`src/app/dashboard/business/layout.tsx`, which loads the organizations, the
workspace storage and the viewer's personal usage in parallel and hands the
business allowance to the sidebar meter.

---

## 3. Which workspace am I in?

The failure mode this section prevents: somebody adds a person to the wrong
account, or wonders why their personal files aren't in the list.

Three separate signals, because one is never enough:

1. **The sidebar navigation changes entirely.** A business workspace shows eight
   organization links and no Personal links. There is no merge.
2. **A workspace switcher sits above the navigation**, naming the active workspace
   in words — "Personal", or the organization's short name with the viewer's role.
3. **The page header starts its breadcrumb at "Organization"**, not at the
   viewer's name.

The switcher moves between `/dashboard` and `/dashboard/business` with
`router.push`. It is a destination, not a dropdown that silently swaps context in
place: silently swapping is how people file something into the wrong workspace.

---

## 4. The overview

Two layouts behind one route, chosen by whether the organization has anything in
it yet.

### 4.1 New organization — getting started

An organization with at most one active member and no folders is new, and the
overview becomes a three-step checklist:

| Step | Done when | Action |
| --- | --- | --- |
| Invite your first teammate | More than one member record exists | Opens the invitation dialog |
| Create a shared folder | At least one folder exists | Links to Shared folders |
| Decide who can do what | Both of the above | Links to Roles & permissions |

Completed steps collapse to a struck-through label with a "Done" tag rather than
disappearing, so the person can see how far they've come and knows the list
wasn't truncated. The count in the header is live ("3 steps left", "You're set
up.").

The invitation step degrades for non-inviters: a member sees "View members"
instead of a button that would be refused.

### 4.2 Established organization — operational summary

| Region | Content | Source |
| --- | --- | --- |
| Organization header | Name, mark, plan, viewer role, copyable ID | `Organization` |
| Members | First five by roster order with role and status | `members()` |
| Pending invitations | Count with a link to review | Members filtered to `invited` |
| Shared folders | First four with item count and who can reach them | `folders()` |
| Recent activity | Six most recent events | `summary().recentActivity` |
| Storage | Compact meter linking to the storage page | `storage()` |
| Your access | Four capabilities checked against the viewer's role | `can()` |

Panels with nothing in them are **omitted**, not rendered empty. An established
organization with no recent activity doesn't get a framed blank box; the activity
panel simply isn't there. Only the getting-started layout is allowed to be mostly
whitespace, because there it means something.

The "Your access" card exists because the overview is where people arrive after
accepting an invitation, and the first question is usually "what am I allowed to
do here?"

---

## 5. The contract

`src/lib/business/repository.ts` defines `BusinessRepository`. Every method takes
an `organizationId` — deliberately, even where a single organization exists — so
no method can quietly become "the current org".

```ts
interface BusinessRepository {
  /** True when the organization service is connected and calls can succeed. */
  readonly configured: boolean;

  organizations(): Promise<BusinessResult<Organization[]>>;
  organization(id: string): Promise<BusinessResult<Organization>>;
  summary(id: string): Promise<BusinessResult<BusinessSummary>>;
  storage(id: string): Promise<BusinessResult<BusinessStorage>>;

  members(orgId: string, filter?: MemberFilter): Promise<BusinessResult<Member[]>>;
  member(orgId: string, memberId: string): Promise<BusinessResult<Member>>;
  invite(orgId: string, input: InviteInput): Promise<BusinessResult<Member>>;
  resendInvitation(orgId: string, memberId: string): Promise<BusinessResult<Member>>;
  revokeInvitation(orgId: string, memberId: string): Promise<BusinessResult<null>>;
  changeRole(orgId: string, memberId: string, role: BusinessRole): Promise<BusinessResult<Member>>;
  removeMember(orgId: string, memberId: string): Promise<BusinessResult<null>>;
  transferOwnership(orgId: string, memberId: string): Promise<BusinessResult<Member>>;

  folders(orgId: string): Promise<BusinessResult<BusinessFolder[]>>;
  folder(orgId: string, folderId: string): Promise<BusinessResult<BusinessFolder>>;
  createFolder(orgId: string, input: { name: string }): Promise<BusinessResult<BusinessFolder>>;
  renameFolder(orgId: string, folderId: string, name: string): Promise<BusinessResult<BusinessFolder>>;
  deleteFolder(orgId: string, folderId: string): Promise<BusinessResult<null>>;
  setFolderAccess(orgId: string, folderId: string, input: FolderAccessInput): Promise<BusinessResult<BusinessFolder>>;

  activity(orgId: string, filter?: ActivityFilter): Promise<BusinessResult<BusinessActivityEvent[]>>;

  updateOrganization(orgId: string, input: { name: string; initials?: string }): Promise<BusinessResult<Organization>>;
  deleteOrganization(orgId: string, confirmation: string): Promise<BusinessResult<null>>;
}
```

`BusinessResult<T>` is `{ ok: true; data: T } | BusinessFailure`, where a failure
carries a `code` from `BusinessErrorCode` (`not_configured`, `forbidden`,
`last_owner`, `already_member`, `seat_limit`, `invalid_email`, …), a
`message` that is safe to render, and optional `fieldErrors` for form
highlighting.
Never a thrown error and never a bare null: a failed read has to be able to say
why, because the UI distinguishes "you have no folders" from "we couldn't load
your folders".

### 5.1 The empty repository

`createEmptyBusinessRepository()` is what ships today:

- One placeholder organization, `id: "workspace"`, name "Your organization".
- Reads resolve empty arrays and zero counts.
- Writes resolve `{ ok: false, code: "not_configured" }`.
- `storage.authoritative` is `false` and `byMember` is absent.

That last flag is load-bearing. The storage page shows the plan allowance with a
note that usage isn't confirmed yet, rather than a 0 B used arc, which would be a
measurement we didn't take.

`service.ts` holds the singleton and a `setBusinessRepository()` hook for tests.
It imports `server-only`, so the repository can never be pulled into a client
bundle.

---

## 6. Writes, honestly

No organization service exists, so no write can succeed. The rule that follows:
**a control must never imply it worked.**

Every mutation in this build routes through a local `reportUnbacked(title)`:

```ts
const reportUnbacked = async (title: string) => {
  await new Promise((resolve) => setTimeout(resolve, 450));
  toast({ tone: "error", title, description: BUSINESS_NOT_CONNECTED });
};
```

The delay is there so the interaction feels like a request rather than a no-op
that was dead on arrival; the toast is an error, in the error tone, with a title
naming the specific action ("Folder wasn't renamed") and a body saying no changes
were saved. When the repository starts returning real results, the helper is
replaced by the call and the surrounding UI needs no other change — the dialogs
already close on submit and the optimistic state is already local.

`BUSINESS_NOT_CONNECTED` is a single exported constant so the sentence appears
once in the codebase.

---

## 7. Design system

Nothing new. Specifically:

| Element | Reused from |
| --- | --- |
| Page header, breadcrumbs | `PageHeader`, `BusinessClient` |
| Buttons, heights, radii | `h-9` primary, `h-8` secondary, `rounded-lg` |
| Dialogs | `Dialog` (`sm`/`md`/`lg`), `ConfirmDialog` with `requireTyping` |
| Toasts | `useToast()` |
| Empty states | `EmptyState` with `first-use` / `collection` |
| Menus | `Menu` with `anchor` + `onSelect` |
| Bytes, dates | `formatBytes`, `formatRelative`, `formatDate` |

Shared tokens: primary `#3178fb`, ink `#171d3a`, borders `#e6e9f2` / `#d5daea`
/ `#eef1f7`, sidebar 248px expanded / 68px rail.

Type runs one notch tighter than the marketing site — 12–13px body, 17px page
titles, `-0.03em` tracking on headings — because these screens are dense with
labels rather than prose. That is the personal dashboard's scale, unchanged.

The one deliberate addition is the organization mark: a `#8B5CF6 → #3178FB`
gradient square with two letters, used in the header, the switcher and the
avatar fallback for a member who has never signed in. It gives the workspace an
identity the personal dashboard doesn't need.

---

## 8. What is deliberately absent

| Not built | Why |
| --- | --- |
| Custom roles | No permission store for a builder to write to. A builder that produces roles nothing enforces is worse than no builder. |
| Email-domain restrictions | Not implemented in the invitation path; a toggle would be a lie. |
| Reminder emails | No scheduler. Shown in settings as "Planned". |
| Group/team nesting | The backend model is org → member. A UI with teams would need a level that doesn't exist. |
| Bulk member actions | Selection implies bulk operations the contract doesn't have. |
| Per-member storage figures | Only rendered when `byMember` is present; never zero-filled. |

Each of these appears in the UI as a stated fact — "Planned", "Not assignable",
"Only owners and admins can…" — rather than as a disabled control with no
explanation.

---

## 9. File map

```
src/lib/business/
  types.ts            Roles, capabilities, records, display copy
  roles.ts            ROLES, can(), outranks(), blockers that return reasons
  repository.ts       BusinessRepository, BusinessResult, error codes
  empty-repository.ts The unconfigured implementation
  service.ts          Singleton + test hook (server-only)
src/config/business.ts  BUSINESS_NAV_GROUPS, path helpers
src/components/business/
  workspace-switcher.tsx  role-badge.tsx  member-status.tsx
  role-selector.tsx       invite-dialog.tsx
  member-table.tsx        members-view.tsx
  folder-access-dialog.tsx folders-view.tsx
  activity-timeline.tsx   activity-view.tsx
  business-storage-card.tsx
  organization-header.tsx business-overview.tsx
  permissions-view.tsx    settings-view.tsx
src/app/dashboard/business/
  layout.tsx  business-client.tsx  page.tsx
  members/page.tsx  folders/page.tsx  permissions/page.tsx
  storage/page.tsx  activity/page.tsx  settings/page.tsx
```

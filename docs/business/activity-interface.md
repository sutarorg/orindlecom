# Orindle — Activity Interface

`/dashboard/business/activity` — the record of what changed in the organization.

**This log is not generated.** There is no seed data, no synthetic history and no
backfill. On a deployment without an organization service the page shows its
empty state, because nothing has happened. A demo timeline that starts three
weeks before the organization existed would destroy the page's only real value,
which is being trustworthy.

---

## 1. What an event is

```ts
interface BusinessActivityEvent {
  id: string;
  kind: BusinessEventKind;
  /** ISO 8601. */
  at: string;
  /** Who did it. Null for system events. */
  actorName: string | null;
  actorEmail: string | null;
  /** What it was done to — a member, a folder, a file. */
  targetName: string;
  /** Stable id for linking to the resource, when it still exists. */
  targetId: string | null;
  targetKind: "member" | "folder" | "file" | "organization";
  /** Optional structured detail, e.g. "member → admin". Rendered after the verb. */
  detail?: string;
}
```

`targetKind` exists so a future row can link to the surviving resource; the
current timeline renders it silently, since a link to a deleted folder would be a
dead end. `targetId` is null once the target is gone.

Twelve kinds, grouped into five families:

| Family | Kinds |
| --- | --- |
| Members | `member.invited`, `member.joined`, `member.removed`, `member.roleChanged` |
| Invitations | `invitation.resent`, `invitation.revoked` |
| Folders | `folder.created`, `folder.accessChanged`, `folder.deleted` |
| Files | `file.uploaded`, `file.deleted` |
| Workspace | `settings.changed` |

`BUSINESS_EVENT_LABEL` in `types.ts` holds the display verb for each kind
("invited", "changed the role of", "deleted"). The timeline reads as a sentence:
**actor · verb · target**. That ordering matters — "Priya removed Sam" is
parseable at a glance in a way that "Sam — removed by Priya" isn't.

`actorName` is nullable because not every event has a person behind it. A system
event renders as "Orindle" rather than being attributed to whoever was signed in
at the time.

---

## 2. Timeline composition

Each row:

```
[icon]  Priya Rao  changed the role of  Sam Okafor — member → admin
        2 hours ago · priya@acme.example
```

- **Icon** — one per event kind, in a rounded square with a ring.
- **Tone** — three families: constructive (invited, joined, created, uploaded) in
  green, lossy (removed, deleted, revoked, role-changed) in red, routine
  (resent, settings) in blue.
- **Time** — relative ("2 hours ago"), with the absolute date in the `title` and
  a `<time dateTime>` for machines.

Colour and icon are reinforcement only. The sentence carries the meaning, so the
log is fully readable with styles off, in a screen reader, or by someone who
can't distinguish the tones.

---

## 3. Day grouping

Events are grouped under sticky day headings — **Today**, **Yesterday**, then
`formatDate`.

"Why did you group them?" The question people bring to an audit log is temporal:
"what happened while I was away", "what changed yesterday". A flat reverse-
chronological list makes every reader do that grouping in their head, and the
grouping is deterministic, so the UI may as well do it.

The headings are computed in **UTC**, matching `formatDate`, rather than via
`toLocaleDateString`. Local formatting would produce a different "Today" on the
server and the client and hand React a hydration mismatch on the one page that is
nothing but timestamps. The `time` element's `dateTime` attribute is the ISO
string, so the reader's own timezone is available to anything that needs it.

The sticky heading sits at `top-[60px]` to clear the topbar.

---

## 4. Filtering

A family tablist with live counts: Everything · Members · Invitations · Folders ·
Files · Workspace.

A family with a zero count is **hidden**. An empty "Files" tab would assert that
files are tracked while showing nothing about them.

Search runs over actor name, actor email, target name and the event label — which
covers both readings of "find where Priya…" (as the actor, or as the target)
without adding a field to choose between them.

Filter and search compose. When either is active, the result count appears below
the list — *"Showing 18 of 143 events"* — with `aria-live="polite"` so it
announces on change.

The filter control renders only for roles with `activity.view`. Every role
currently has it, so in practice the tabs are always present; the guard exists so
the screen doesn't break if that changes.

---

## 5. Empty states

Two, and they must never be confused:

**No events at all** — `first-use`, icon `Activity`, *"Nothing has happened yet."*
The body lists the kinds of things that will appear and states plainly that
nothing is backfilled: *"This log starts at the organization's first event. It
isn't reconstructed after the fact."*

**No match** — `collection`, icon `SearchX`, *"No activity matches"*, with a
*Clear filters* action. Only reachable when the log is non-empty, and the copy
says so: *"The full history is still there."*

An established organization that has genuinely done nothing gets the first state,
not a fake event. The honest empty page is a feature.

---

## 6. Placement in the product

| Surface | Shows | Why |
| --- | --- | --- |
| `/activity` | Up to 200 events, filterable | The full record |
| Overview | Six most recent, no filters | A pulse, not a log |
| Member detail | Not shown | The roster is the member view; duplicating it invites divergence |

The overview panel is **omitted entirely** when there are no events, rather than
rendering a framed empty box next to populated ones. Tiles with nothing to say
shouldn't take up room saying it.

---

## 7. Contract

```ts
activity(orgId, {
  kinds?: BusinessEventKind[];
  since?: string;      // ISO lower bound
  search?: string;
  limit?: number;      // default and cap decided by the backend
}): Promise<BusinessResult<BusinessActivityEvent[]>>
```

Filtering is server-side by design. Applying filters client-side against a capped
page would silently lie: a filter returning nothing would mean "not in the last
200 events" while reading as "never happened".

The repository returns newest-first. The UI does not re-sort — if it did, a
server that returned partial results would be rendered as a complete ordered
history.

Pagination is not implemented. When the log outgrows a page, the right shape is a
cursor (`before`) rather than an offset, because events are appended continuously
and offset pagination skips rows when new events arrive.

---

## 8. What is deliberately not recorded

| Not an event | Why |
| --- | --- |
| Page views, downloads, sign-ins | This is a change log, not analytics. Mixing read activity in makes the write changes harder to find. |
| Refused actions | A blocked attempt is a failed action, not a change. It belongs in a security log, which this is not. |
| Invitation open/click tracking | Requires mail-provider webhooks; without them any "opened" marker would be a guess. |
| Storage threshold crossings | Derivative of usage, not an actor's action. |
| Edits to a file's contents | Version history belongs to the file. |

Each exclusion keeps one property intact: everything in this log happened, and
somebody did it.

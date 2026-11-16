# Orindle — Upload State Flow

The upload path is the most consequential interaction in a storage product: it is
where trust is won or lost. This document is the state machine, the UI at each
state, and the contract the backend has to satisfy.

**The non-negotiable rule:** `complete` is set only after the repository confirms
the file exists. Nothing in the UI can move a task to `complete` on its own.

---

## 1. States

```ts
type UploadStatus =
  | "queued"      // accepted, waiting for a slot
  | "preparing"   // size/type checked, signing requested
  | "uploading"   // bytes moving
  | "finalising"  // upload done, waiting for the backend to confirm
  | "complete"    // confirmed by the repository
  | "failed"      // terminal, with a reason
  | "cancelled";  // terminal, by the user
```

```
            ┌──────────┐
            │  queued  │
            └────┬─────┘
                 ▼
            ┌──────────┐   bad type / too big
            │preparing │──────────────────┐
            └────┬─────┘                  │
                 ▼                        │
           ┌───────────┐   network/abort  │
           │ uploading │──────┐           │
           └─────┬─────┘      │           │
                 ▼            ▼           ▼
          ┌────────────┐  ┌────────┐  ┌────────┐
          │ finalising │  │ failed │  │ failed │
          └─────┬──────┘  └────────┘  └────────┘
                ▼
          ┌──────────┐
          │ complete │  ← only on repository confirmation
          └──────────┘
```

`cancelled` is reachable from `queued`, `preparing` and `uploading`. A cancel
during `finalising` is not offered: the bytes are uploaded and the server is
deciding, and an "abort" there would be a promise the client can't keep.

---

## 2. Where each state is shown

| Surface | States | What it shows |
| --- | --- | --- |
| Tray header | any active | "3 uploads · 42%", collapses the list |
| Tray row | queued | name, size, "Waiting" |
| Tray row | preparing / uploading | name, size, progress bar, percentage, Cancel |
| Tray row | finalising | indeterminate bar, "Finishing…", no Cancel |
| Tray row | complete | check, name, "Uploaded" |
| Tray row | failed | destructive icon, name, reason, Retry, Dismiss |
| Tray row | cancelled | muted, name, "Cancelled", Dismiss |
| Empty state | — | disappears when no tasks remain |

The tray sits above the toast stack and clears it vertically, because a failed
upload raises both a toast and a tray row and stacking them hid whichever
arrived second.

---

## 3. Entry points

All of them funnel into `addFiles()` on the single `UploadManager`:

1. **Sidebar "Upload"** — always visible on desktop and tablet
2. **Mobile floating button** — 52px, bottom right, hidden while a dialog is open
3. **Page header "Upload files"** on files, folders and folder-detail routes
4. **Dropzone in the manager** — compact bar, or the tall first-use target
5. **Empty-state "Upload files"** button
6. **Drag anywhere on the page** — a full-window overlay appears on `dragenter`

The window-level overlay uses a drag depth counter, because `dragleave` fires when
crossing child elements and a naive boolean flickers the overlay. Only `Files`
drags are accepted; dragging text or a link does nothing.

---

## 4. Pre-flight validation

| Check | Behaviour |
| --- | --- |
| Blocked extension (`.exe`, `.dll`, `.app`, `.bat`, `.cmd`, `.scr`, `.msi`) | Rejected before upload with a named reason |
| Over `maxFileSize` (5 GiB) | Rejected with the limit stated |
| Over `multipartThreshold` (16 MiB) | Marked for multipart; same UI, different transport |
| Zero bytes | Allowed — empty files are legitimate |

Limits come from `UPLOAD_LIMITS` in `src/lib/drive/types.ts`. Nothing hard-codes
a number in a component.

---

## 5. What is simulated, and what that means

Today the repository returns `not_configured` for every write. So the manager
runs a timer that advances progress to a hard ceiling of **96%**, then flips the
task to `failed` with an explanation. It never reaches `complete`.

That is one simulated number, in one place, with a visible consequence — and it
is deliberately visible. The alternative, a bar that sits at 100% and then
apologises, would teach the user that a full bar means nothing.

Replacing the timer with a real XHR progress handler changes the body of one
function. The states, the tray, the retry path and the copy all stay as they are.

---

## 6. Direct-to-R2 contract

The frontend is prepared for signed direct-to-object-storage uploads:

```ts
prepareUpload(input: { file: File; parentId: string | null })
  : Promise<DriveResult<{ taskId: string; multipart: boolean }>>

// then, per file:
//   ≤ 16 MiB — single PUT to a presigned URL
//   > 16 MiB — create multipart upload, PUT parts, complete
//   either way — confirm() before the item appears in any list
```

Three properties the UI depends on:

1. **`prepareUpload` returns a task id before bytes move**, so a task can be
   cancelled cleanly and progress can be attributed.
2. **`multipart` is decided by the server**, not recomputed in the client, so the
   threshold can change without shipping a new frontend.
3. **A separate confirmation step exists.** The upload finishing and the item
   existing are two events. The UI treats only the second as success.

Progress is per-file, measured in bytes, and the tray percentage is total bytes
across tasks — not the mean of per-file percentages, which would let a 4 KB file
dominating the average make a 4 GB upload look nearly done.

---

## 7. Retry, cancel and resume

- **Retry** re-runs `prepareUpload` for that file from `failed`. It does not reuse
  a stale signed URL.
- **Cancel** aborts the in-flight request and marks the task `cancelled`. Uploaded
  parts of a multipart upload are cleaned up server-side; the client only reports.
- **Resume** is not offered. A real resume needs persisted part state, and a
  resume that silently restarts from zero is a lie about progress.
- **Dismiss** appears only on terminal states, so an active upload can't be
  removed from the tray while it is still running.

---

## 8. Failure copy

Failures name the file and the reason, and say what happens next:

| Cause | Message |
| --- | --- |
| No backend | "Your storage provider isn't connected yet, so nothing was stored." |
| Type blocked | "`.exe` files can't be uploaded." |
| Too large | "This file is larger than the 5 GB limit." |
| Network | "The connection dropped. Retry when you're back online." |
| Storage full | "You're out of space. Free some up or upgrade to continue." |

None of these say "something went wrong". Each says what, and what to do.

---

## 9. Accessibility

- The tray is a `region` with `aria-label="Uploads"`; the header button reports
  `aria-expanded` and the count.
- Each progress bar is `role="progressbar"` with `aria-valuenow` updated per
  tick, and an `aria-label` naming the file.
- Terminal state changes are announced once through a polite live region — not on
  every progress tick, which would make a screen reader unusable during upload.
- Retry, Cancel and Dismiss are real buttons with visible focus rings and a
  minimum 24px target.

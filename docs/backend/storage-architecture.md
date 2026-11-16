# Storage Architecture

**Status:** Design locked. Implements the 13-step upload flow and byte-accurate
accounting. Sizes are decimal (1 GB = 10⁹ bytes) throughout — see
`implementation-audit.md` §8.1.

---

## 1. Principles

1. **Bytes never touch the application server.** The browser uploads directly to
   Cloudflare R2 with a presigned URL. Vercel functions are small and time-limited;
   proxying a 5 GB upload through one is not architectural taste, it is a hard
   constraint.
2. **Nothing is available until verified.** An object existing in a bucket is not
   the same as a file the customer can use. Metadata commits only after the object
   is confirmed to exist with the expected size.
3. **Private by default.** No permanent public URL. Downloads are short-lived
   presigned GETs, or a link that expires.
4. **A reservation is a promise with a deadline.** Unused reservations are released
   by a sweeper, not by hoping the browser comes back.
5. **Accounting is recomputable.** `storage_usage` is a cache; the truth is derivable
   from `files` and `storage_reservations`. A daily job proves they agree, which also
   catches the accounting bug before the customer does.

---

## 2. Object layout

```
orindle-prod/
  u/{userId}/{yyyy}/{mm}/{uuid}            personal files
  o/{orgId}/{yyyy}/{mm}/{uuid}             organisation files
  tmp/{userId}/{uploadId}/{part}           multipart parts before completion
  avatars/{userId}/{uuid}                  public profile images
```

- The key is **server-generated and opaque**. Nothing about the customer's file name
  appears in it. That removes path traversal, unicode normalisation, emoji, RTL
  override and 255-byte-key problems in one decision, and it means two files named
  `invoice.pdf` never collide.
- The original name lives in `files.name`, for display only.
- The tenant prefix (`u/` or `o/`) makes lifecycle rules and access audits possible
  per tenant without reading the database.

**Only `avatars/` is public.** Everything else is private and reachable solely via a
presigned URL. `R2_PUBLIC_BASE_URL` must be used to build URLs for `avatars/` only;
using it for a private key would create exactly the permanent public URL the
requirements forbid. This is enforced by a function that takes the key prefix and
throws if asked for a public URL for anything else.

---

## 3. The 13 steps

Every upload follows this order. The numbers are used in code comments and in the
audit log so a stuck upload can be traced to the step where it stopped.

### 1. Authenticate
`resolveActor()` reads the verified session. No body-supplied user id is consulted.
Failure → `401`, nothing else happens.

### 2. Authorise
The actor must be able to write to the target folder: owner, org member with
`editor` or above, or a grant with `editor`. A folder the actor cannot see returns
`forbidden`, not `not_found`, so the response does not reveal whether the folder
exists.

### 3. Validate
Server-side, always, regardless of what the client checked:
- name: non-empty, ≤ 255 bytes after normalisation, no `/` `\` or control characters,
  not `.` or `..`, not a reserved Windows device name
- size: > 0 and ≤ `UPLOAD_LIMITS.maxFileSize` (5 GB decimal)
- MIME: declared type must be plausible for the extension; the stored type is the
  declared one, and it is never trusted for rendering decisions (see §7)
- extension: `UPLOAD_LIMITS.blockedExtensions` rejected outright

### 4. Quota check
`effective_plan_bytes(owner)` is the plan allowance, or the **Free** allowance if the
subscription has expired. An account over quota may still *download* and still
*delete*; it may not upload. That is the difference between a lapse and a hostage
situation.

### 5. Transactional reservation
`reserve_storage(owner, bytes, uploadId)` — the `security definer` function from
`database-schema.md` §4.1. It takes a row lock on `storage_usage`, re-checks the
quota inside the lock, increments `reserved_bytes`, and writes the reservation row.
**Two parallel uploads cannot both pass this check**; the second blocks on the lock
and then fails with `quota_exceeded`. This is the single most important line of code
in the storage system.

### 6. Upload session
Insert `upload_sessions` with a server-generated `storage_key`, `declared_size`, and
`expires_at` (24 h for multipart, 1 h for single-part). `multipart` is true when
`declared_size >= UPLOAD_LIMITS.multipartThreshold` (16 MiB).

### 7. Short-lived presigned URL
- single-part: `PUT` presigned for 15 minutes, with `Content-Length` and content type
  bound where R2 supports it
- multipart: `CreateMultipartUpload` → presign each part (5 MiB minimum part size
  except the last) for 15 minutes each
The response carries only the URL(s) and the upload id. Never a bucket credential.

### 8. Browser → R2 direct
The browser `PUT`s bytes straight to R2. It reports progress from XHR events, which
is what replaces the simulated progress bar in `upload-manager.tsx`. On failure the
client calls `cancelUpload`, which releases the reservation immediately rather than
waiting for expiry.

### 9. Confirm
`completeUpload(taskId)` — the server does **not** trust the client's claim that the
upload finished. For multipart it calls `CompleteMultipartUpload` with the part
ETags the client collected, and R2's ETag response is what proves the bytes arrived.

### 10. Verify metadata and checksum
`HeadObject` on the key must report a size equal to `declared_size`. If the client
supplied a SHA-256, it must match the stored checksum metadata. A mismatch marks the
file `failed`, releases the reservation and deletes the object — **it never becomes
available**, because a size mismatch means either a truncated upload or a client
lying about what it sent.

### 11. Security-scan hook
`onObjectStored(file)` is called. **No scanner is configured.** The hook:
- when `MALWARE_SCAN_ENABLED` is false (today): sets nothing, and the file becomes
  `available` because storage integrity has been verified
- when enabled: leaves the file in `pending`/`quarantined` until a scanner verdict
  arrives asynchronously

A file that has not been scanned is never automatically shareable by public link; the
UI says scanning is not configured rather than implying protection. This is the
honest implementation of "integration point only".

### 12. Commit metadata and accounting
In one transaction:
- `files.status = 'available'`, `size_bytes` set from the verified object size
- `storage_usage.committed_bytes += actual`, `reserved_bytes -= requested`
- reservation → `committed`
- `activity_events` row (`file.uploaded`)
If the actual size differs from the reservation (multipart with a truncated final
part), the *actual* is committed and the difference released.

### 13. Release unused reservations
Any reservation still `reserved` for this upload is released. The sweeper
(`expire-reservations`, every 15 minutes) does the same for uploads that never came
back, so an abandoned tab cannot hold quota for 24 hours by accident.

---

## 4. The quota arithmetic

```
total      = plan.storage_bytes              (Free allowance if expired)
committed  = Σ available, non-deleted files + Σ files in trash
reserved   = Σ live reservations
available  = total − committed − reserved    (clamped at 0)
```

Every figure the UI shows comes from these five numbers. `StorageUsage` is extended
with `reserved`, `trash`, `available`, and the existing `used` is kept equal to
`committed + reserved` so no component changes.

**Trash counts against quota.** A deleted file still occupies the bucket. The UI
states this instead of implying that emptying the bin is what frees space — emptying
the bin *is* what frees it, and it only does so after the purge job actually deletes
the object.

### 4.1 Worked example (decimal)

Free plan, 10 GB = 10,000,000,000 bytes.

| Event | committed | reserved | available |
| --- | ---: | ---: | ---: |
| New account | 0 | 0 | 10,000,000,000 |
| Start 3 GB upload | 0 | 3,000,000,000 | 7,000,000,000 |
| Second tab, 8 GB upload | — | — | **refused** (`quota_exceeded`) |
| First completes at 3.0 GB | 3,000,000,000 | 0 | 7,000,000,000 |
| Move 1 GB to trash | 3,000,000,000 (1 GB of it trash) | 0 | 7,000,000,000 |
| Purge trash (job deletes object) | 2,000,000,000 | 0 | 8,000,000,000 |

Note the third row: the refusal is the point of step 5. Without the transaction, both
uploads pass a check against 10 GB free and the account ends up at 11 GB.

---

## 5. Trash

- `deleted_at` set by the `trash` action; folders cascade to descendants.
- Retention = `TRASH_RETENTION_DAYS`, default 30, read from the environment.
  `TRASH_RETENTION.approved` is `false` and the UI labels the number provisional.
- `trash-cleanup` runs hourly: selects files past retention in batches of 500, deletes
  the R2 object, then the row, then decrements `committed_bytes` — in that order, so
  a failure leaves an orphan object to be swept rather than a broken row pointing at
  nothing.
- **Purge is backend-validated.** `emptyTrash` and `purge` re-check ownership server
  side and only ever act on rows already in the bin. A file not in the bin cannot be
  purged by passing its id.

---

## 6. Downloads and previews

- `GET /api/files/:id/url` → presigned GET, 5 minutes, `Content-Disposition:
  attachment` by default.
- Inline previews get a separate narrow presigned URL and are only issued for
  categories that are safe to render inline: images, PDFs, plain text, audio, video.
  HTML, SVG and anything executable are **never** served inline, because an
  attacker-supplied SVG on the storage origin is a script execution vector.
- `Content-Type` on the presigned response is set from the stored MIME, and
  `X-Content-Type-Options: nosniff` is applied.
- Share links resolve to a server route that authorises, then redirects to a 60-second
  presigned URL. The link is the stable thing; the URL behind it is not.

---

## 7. Upload safety

Storage accepts arbitrary bytes, so the assumptions are:

- A stored file is **data, never code**. Nothing is ever served as HTML from the
  storage origin.
- The declared MIME is a hint for the icon and for deciding whether an inline preview
  is allowed. It is not a security control.
- `blockedExtensions` blocks the obvious executables. That is a speed bump, not a
  defence — the real defence is that nothing is executed and nothing is served inline
  that could script.
- Scanning is an integration point. Until a scanner is configured, files may be
  shared only with named people and via expiring links, never published publicly.

---

## 8. Reconciliation

`reconcile-storage` runs daily and reports, never silently repairs:

1. Objects in R2 with no `files` row → candidates for `orphan-sweep` after 24 h grace
   (beyond that, they are bytes nobody is billed for).
2. `files` rows with no object → the serious case. The file is marked `failed`,
   the customer is told, and `committed_bytes` is corrected.
3. `storage_usage` discrepancies against a recomputation from `files` +
   `storage_reservations` → corrected, with an `activity_events` row recording the
   delta and the reason.

A drift report is a page for a human, not a self-healing system that quietly changes
what a customer is allowed to store.

---

## 9. Failure modes and what happens

| Failure | Behaviour |
| --- | --- |
| Browser closes mid-upload | Reservation expires; sweeper releases; nothing committed |
| Upload completes, confirm never sent | Same as above; orphan object swept |
| R2 `HeadObject` size mismatch | File `failed`, object deleted, reservation released |
| Complete-multipart rejected | Retried once, then `failed` with the R2 error logged |
| Presigned URL expired | Client requests a fresh one; reservation still valid |
| Quota reduced by downgrade mid-upload | Existing upload completes; the next one is refused |
| Two tabs, same folder, same name | Second gets `conflict`; UI offers rename |

---

## 10. What is deliberately absent

- **No server-side byte proxying.** If a future feature needs transformation, it is
  a separate job reading from R2, not a proxy in the request path.
- **No permanent public object.** Not for files, not for shares. The only public
  prefix is `avatars/`.
- **No client-chosen storage key.** The server generates it.
- **No "delete from bucket, hope the row goes too"**. Object deletion and row
  deletion are ordered so a crash leaves a sweeper-visible orphan, never a dangling
  reference.

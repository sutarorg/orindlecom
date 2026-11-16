# Backup and Recovery

**Status:** Procedure defined. **Not yet rehearsed.** A backup that has never been
restored is a hypothesis, and this document says so until the rehearsal in §6 is
signed off.

---

## 1. What must be recoverable

| Asset | Where it lives | Loss impact | Recovery target |
| --- | --- | --- | --- |
| File bytes | Cloudflare R2 | **Total product loss** | RPO 24 h, RTO 8 h |
| File/folder metadata | Postgres | Files become unreachable even though bytes exist | RPO 5 min, RTO 2 h |
| Accounts and profiles | Postgres + Supabase auth | Nobody can log in | RPO 5 min |
| Billing records | Postgres | Revenue and legal exposure | RPO 5 min, retain 8 years |
| Audit trail | Postgres | Cannot reconstruct events | RPO 1 h |
| Secrets | Platform secret store | Everything stops | Documented in a password manager, offline |

The asymmetry that drives the design: **metadata loss is worse than byte loss.** Losing
an R2 object affects one file. Losing the metadata table makes every file an anonymous
blob. That is why the database backup is tighter than the object backup.

---

## 2. Database

- **Supabase automated backups** — daily on paid plans. Retention and PITR window
  depend on the tier, which is **not yet confirmed**. Confirm before launch; do not
  assume a 7-day window.
- **PITR** — required for RPO 5 min. If the plan does not include it, either upgrade or
  accept the daily RPO and record the acceptance.
- **Independent logical dump** — `pg_dump` weekly to encrypted object storage, kept 90
  days, so a compromised or misconfigured Supabase project is not the only copy. A
  provider's backup inside the provider's account does not protect against account
  compromise.
- **Retention distinction:** financial records (invoices) are kept beyond account
  deletion; everything else follows the erasure path. A restore must not resurrect rows
  that a lawful erasure removed — see §5.

---

## 3. Object storage

- **R2 versioning** on the production bucket. Deleting an object should be reversible
  for at least 30 days without restoring a whole bucket.
- **Lifecycle:** non-current versions expire at 30 days, so versioning does not grow
  without bound.
- **No cross-provider replication initially**, recorded as a gap: a full R2 account loss
  is not recoverable today beyond versioning. If customer data volume justifies it, an
  rclone-based weekly mirror to a second provider is the next step.
- **Restore of a single file** is the common case and must be a documented, rehearsed
  path: locate key via `files.storage_key`, restore the non-current version, verify
  `HeadObject` size against `size_bytes`.

---

## 4. Restore procedures

### 4.1 Single file deleted in error

1. Find the row in `files` (including soft-deleted) or `activity_events`
   (`file.purged` records the key).
2. Restore the non-current object version in R2.
3. If the row is gone, re-insert with the original `storage_key`, size and owner.
4. Verify size matches; the file becomes `available` again.

Time: minutes. **This is the only scenario that should ever be answered immediately.**

### 4.2 Accidental mass delete

1. **Stop the cleanup job first.** `trash-cleanup` running during a restore re-deletes
   what is being recovered.
2. Restore affected object versions from R2 versioning.
3. Restore the corresponding rows from the most recent dump, into a scratch schema.
4. Reconcile: match `storage_key` values, re-insert only missing rows.
5. Run `reconcile-storage` and read the drift report before re-enabling the job.

### 4.3 Database restore to a point in time

1. Provision a replacement project; do not overwrite in place, so the damaged copy
   remains available for forensics.
2. Restore to the target timestamp.
3. **Reconcile against R2:** rows without objects and objects without rows are both
   expected after a rollback. Neither is auto-repaired.
4. Re-point the application via environment variables, not code.
5. Re-enable jobs one at a time, watching the first run.

### 4.4 Full disaster (both lost)

Rebuild in order: database → bucket structure → objects → secrets → DNS. Accept that
bytes uploaded after the last object backup are gone; state that plainly to affected
customers rather than implying a complete restore.

---

## 5. Recovery meets erasure

A restore can resurrect data a customer asked to be deleted. That is a compliance
problem, not a technical one, and it needs an actual answer:

- `account_deletions` records the user id and completion time, and is **exported
  separately** and replayed after any restore.
- After a restore, deleted account ids are re-applied before the service is reopened.
- Invoices are retained deliberately (financial records) but their personal data is
  limited to what the record requires.

Without this step a restore is a silent DPDP violation.

---

## 6. Rehearsal — the gate for calling this real

Before launch, and then quarterly:

| # | Test | Pass condition |
| --- | --- | --- |
| 1 | Restore a single object version | File downloads, size matches |
| 2 | Restore yesterday's dump into a scratch project | Row counts within expectation |
| 3 | PITR to a timestamp 1 hour ago | Data present, ≤ the expected loss |
| 4 | Reconcile after restore | Drift explained, not silently fixed |
| 5 | Replay deletion log | Deleted accounts are absent afterwards |
| 6 | Time the whole thing | Meets the RTO above |

Record each rehearsal with date, operator, and result. **Until at least one rehearsal
passes, the honest status of this document is "no verified restore capability".**

---

## 7. Monitoring

- Backup job success/failure is alerted, not merely logged.
- A restore test failure is a page.
- Bucket object count and total bytes are tracked daily; a sudden drop is an incident,
  not a statistic.
- `reconcile-storage` output is reviewed by a human; drift is a finding, not a
  self-healing routine.

---

## 8. Open items

| Item | State |
| --- | --- |
| Supabase plan tier and PITR window | **unconfirmed** |
| Backup retention on the paid tier | **unconfirmed** |
| R2 versioning enabled on production | not yet configured |
| Off-provider logical dumps | designed, not implemented |
| First rehearsal | **not performed** |
| Second-provider replication | deliberately deferred, recorded as a gap |

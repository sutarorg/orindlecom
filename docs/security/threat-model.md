# Threat Model

**Status:** Design. Each threat below names the control that addresses it and where
that control lives. Threats with no control yet are marked **open** rather than
quietly omitted.

**Method:** asset → adversary → path → control → residual risk. Not a checklist of
acronyms.

---

## 1. Assets, in order of consequence

| Asset | Why it matters | Worst outcome |
| --- | --- | --- |
| Customer files | It is the product | Disclosure, loss, or silent corruption |
| Credentials (keys, secrets) | Everything else | Full tenant compromise |
| Billing integrity | Money and trust | Charged twice, or goods delivered free |
| Personal data (email, name) | Legal duty under DPDP | Unlawful processing, breach notice |
| Availability | Paid service | Reputational, contractual |
| Audit trail | Accountability | Can't tell what happened |

---

## 2. Adversaries

| Adversary | Capability | Motive |
| --- | --- | --- |
| **Authenticated tenant** | Valid session, full API access, can edit requests | Read another tenant's files; exceed quota; escalate role |
| **Anonymous internet** | No session; can hit public routes and share links | Scrape, enumerate, abuse contact form, DoS |
| **Malicious org member** | Session + membership with limited role | Escalate to admin; read billing; exfiltrate org data |
| **Compromised browser session** | Stolen cookie | Account takeover |
| **Malicious file author** | Controls file bytes | XSS via SVG/HTML, malware distribution |
| **Insider / operator** | Database and key access | Reads files, edits billing records |
| **Payment attacker** | Can call the checkout and webhook endpoints | Free plan activation, replay, forged webhook |
| **Supply chain** | A dependency turns hostile | Broad compromise |

The most important sentence in this document: **the authenticated tenant is the
primary adversary**, not the anonymous stranger. Most of the damage surface is behind
a valid login, which is why RLS and server-side authorization carry more weight here
than perimeter defences.

---

## 3. Threats and controls

### T1 — Cross-tenant file read (highest severity)

*Path:* tenant A calls `GET /api/files/{id}` or a share endpoint with tenant B's id;
or supplies B's `user_id` in a request body.

*Controls:*
- Identity comes only from `resolveActor()`; **no endpoint accepts a user id**.
  (architecture §2)
- Every table has RLS enabled with default deny; `files` policy requires ownership or
  an active grant. (schema §10)
- Even the service client's queries are scoped by an id the service resolved, never by
  a request parameter.
- **Negative test:** as tenant B, attempt to read A's file through every route that
  takes a file id; assert zero rows / 404.

*Residual:* An operator with database access can read everything — accepted, and named
in §5.

### T2 — IDOR through nested routes

*Path:* `/api/organizations/{orgId}/members/{memberId}` where `memberId` belongs to a
different org. Authorising the org but not the member is a classic bug.

*Controls:* Every nested resource is loaded **through** its parent: `memberId` is
resolved with `and organization_id = $orgId`. A mismatch is `not_found`, not
`forbidden`, so the response cannot be used to probe for existence.

*Negative test:* attempt each nested route with a valid child id under the wrong
parent.

### T3 — Role escalation

*Path:* A member sends `PATCH …/role` with `role: "owner"`, or an admin tries to demote
the owner.

*Controls:* `canAssignRole` and `removalBlocker` re-implemented server-side in
`domain/permissions`, **not** imported from the UI module. RLS mirrors the rule with
`org_role()`. The last owner cannot be removed or demoted (`conflict` with a reason).
A test asserts server and UI agree for every (actorRole, targetRole) pair, so a UI
change cannot silently widen server authority.

### T4 — Quota bypass via parallel uploads

*Path:* Ten simultaneous `prepare` calls each see 9 GB free and each reserve 9 GB.

*Controls:* `reserve_storage()` takes `SELECT … FOR UPDATE` on the usage row before
deciding. Concurrent callers serialise. **This is the specific bug the requirement
names**, and it is the reason the check is a database function rather than application
code.

*Test:* fire N concurrent reservations and assert the sum never exceeds the plan.

### T5 — Unverified upload becomes available

*Path:* Client calls `complete` without uploading, or uploads fewer bytes than
declared, and the file row goes to `available`.

*Controls:* `complete` calls `HeadObject` and compares size to `declared_size`;
checksum mismatch is a failure. Only then does a transaction set `status='available'`.
Listing filters to `available`. A pending row is invisible to every read path.

*Test:* call `complete` with no object in the bucket; assert `failed` and no
committed bytes.

### T6 — Stored XSS via uploaded file

*Path:* Tenant uploads `evil.svg` or `.html`, shares a link, victim opens it on the
storage origin and it runs script.

*Controls:* HTML and SVG are **never** served inline; they are attachment-only.
`Content-Disposition: attachment` by default, `X-Content-Type-Options: nosniff`, and a
strict CSP. Preview URLs are issued only for a safe category allowlist.

*Residual:* The user can still download and open the file locally. That is their
choice on their machine; what must not happen is our origin executing it.

### T7 — Permanently public file URL

*Path:* `R2_PUBLIC_BASE_URL` used for a private key, or a bucket rule exposing the
prefix.

*Controls:* One helper builds public URLs and it **throws** for any key not under
`avatars/`. Private access is presigned GET only, 5 minutes. Share links expire and are
revocable; there is no "permanent" column in the schema to set.

### T8 — Checkout price tampering

*Path:* Client posts `{ planId: "max", amount: 1 }`.

*Controls:* The request has no amount field. The server resolves `amount_minor` from
`plan_prices WHERE approved = true`. An unapproved price cannot be selected because no
row exists. `unsupported` is returned if the requested combination is not sold.

### T9 — Forged or replayed webhook

*Path:* Attacker POSTs a fake `subscription.charged` to grant a plan; or replays a
genuine one.

*Controls:* HMAC over the **raw** body with `timingSafeEqual`. Missing secret →
`not_configured`, never "assume valid". Raw event stored with a unique
`(provider, event_id)`; duplicates are acknowledged and not reprocessed.
`provider_payment_id` unique on invoices prevents double-billing.

*Test:* invalid signature → no state change. Same event twice → one invoice.

### T10 — Billing data exposure

*Path:* Org admin reads another member's invoices; or any tenant enumerates
`/api/billing/*`.

*Controls:* `subscriptions` and `invoices` policies are `auth.uid() = owner_id` with
**no role-based read**. Adminship in an organisation grants nothing over a person's
payment history. Service role only beyond that.

### T11 — Contact form abuse

*Path:* Bot floods the support inbox; or uses the form to send mail to arbitrary
addresses.

*Controls:* Recipient is a server constant. Honeypot, minimum time-to-fill,
per-IP and per-email rate limits in Postgres. Duplicate submissions within a window
collapsed. `support_requests` is not readable by submitters via the API at all.

### T12 — Support requests publicly readable

*Path:* `support_requests` exposed through a policy that returns true, or a
`select *` on an anon client.

*Controls:* RLS: no policy grants anon or authenticated read. Writes go through a
server action using the service client. **Negative test:** anon `select` returns zero
rows.

### T13 — Service-role key leakage

*Path:* Key imported into a client component; key logged; key in a repo file; key in an
error message.

*Controls:* The service client module begins with `import "server-only"` (a build
error if imported from a client component). A test greps the built client bundle for
the key value and fails if found. No secret is logged: a redaction helper wraps
configuration logging. `.gitignore` covers `.env*` except `.env.example`, and
`.env.example` contains names and explanations only.

*Residual:* Build-time injection mistakes are the realistic failure. The bundle grep is
the control, not the code review.

### T14 — Session theft

*Path:* XSS, or a stolen cookie.

*Controls:* Supabase cookies are `httpOnly`, `secure`, `sameSite=lax`; a session
refresh in middleware rotates tokens. CSP restricts script sources. Email change and
account deletion require the current password, so a borrowed session cannot take the
account permanently.

*Open:* No step-up MFA for destructive actions beyond the password re-check. Recorded
as a gap, not claimed as solved.

### T15 — Data loss

*Path:* A bug deletes rows; a sweep deletes objects still referenced; an operator
error.

*Controls:* Deletion is soft (`deleted_at`) with a 30-day window. Object deletion is
ordered object-then-row so a crash leaves an orphan (sweepable) rather than a dangling
reference. Reconciliation reports drift instead of repairing silently. Backups and the
restore procedure are in `deployment/backup-and-recovery.md`.

*Open:* Supabase's PITR retention on the actual plan must be confirmed before
production. A backup you have not restored is a hypothesis.

### T16 — Dependency compromise

*Path:* A transitive dependency turns hostile or is typosquatted.

*Controls:* Lockfile committed; `npm audit` part of the gate; a small dependency count
(nine runtime) treated as a feature; new dependencies justified in the PR.

*Residual:* Accepted. No SBOM or provenance verification yet — a recorded gap.

---

## 4. What each layer is responsible for

A recurring failure mode is assuming one layer covers everything. The division:

| Layer | Responsible for | Explicitly not responsible for |
| --- | --- | --- |
| Middleware | Session refresh, redirect anonymous from `/dashboard` | Authorization decisions |
| Route handler | Identity, input validation, shaping the response | Business rules |
| Service | Business rules, permission checks | SQL correctness, RLS |
| Repository | Query scoping, parameterisation | Authorization policy |
| RLS | Defence in depth, the backstop that survives an app bug | Business logic, rate limits |
| Database constraints | Invariants that must never be violated | Anything ergonomic |

RLS is the **backstop**, not the primary control. An app that relies only on RLS has
no defence against a missing policy added six months later; an app that relies only on
application checks has nothing when a query is written against the wrong client. Both
are required, and a test proves each holds independently.

---

## 5. Accepted risks (named, not hidden)

1. **Operator access.** Anyone with the service-role key and database credentials can
   read customer data. No encryption-at-rest scheme in this design prevents that.
   Mitigation is procedural: least-privilege key distribution, audit logging of
   privileged actions, and the fact that our own policies say we access data only to
   operate the service.
2. **No MFA step-up** on destructive actions beyond re-authentication.
3. **No confirmed PITR window** until the Supabase plan is known.
4. **No malware scanning.** Files are not scanned. Nothing in the product claims
   otherwise, and unscanned files cannot be made publicly shareable.
5. **Single region.** R2 and Supabase locations are not yet chosen; a data-residency
   statement cannot be made until they are. The privacy policy must not assert one.

---

## 6. Verification, not assertion

Every control above is intended to be proven by a test. A control with no test is a
claim, and this project does not ship claims.

| Control | Test |
| --- | --- |
| No client-supplied identity | Static: no `userId` in request-body schemas; no request import in `src/domain` |
| Cross-tenant isolation | Two identities, every route attempted as the wrong one |
| Org isolation | Two orgs, nested routes attempted across them |
| Role enforcement | Full (actorRole, targetRole) matrix, server vs UI |
| Quota under concurrency | N parallel reservations |
| Unverified upload | `complete` with no object |
| Price tampering | Checkout with a forged amount field is ignored |
| Webhook forgery | Bad signature → no change |
| Webhook replay | Same event id twice → one effect |
| Billing privacy | Org admin reads a member's invoices → zero rows |
| Support privacy | Anon read → zero rows |
| Key never in bundle | Grep the built client chunks |
| No delete on expiry | Run expiry + sweep; assert `deleted_at` is null everywhere |

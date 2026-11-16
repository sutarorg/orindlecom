# Production Readiness

**This document's job is to be uncomfortable.** It is the last thing between a working
demo and a service that takes money and holds people's files.

Every row is marked ✅ verified · 🟡 designed, not built · ⬜ open · ➖ n/a.
**Nothing may be marked ✅ on the strength of a design document.**

---

## 1. Verdict

> **Not ready for production.** The public site and the interface are production
> quality. The backend is not yet built beyond authentication, and several items in §6
> are blockers that no amount of implementation can clear — they need decisions and
> account configuration.

Anything claiming otherwise contradicts this table.

---

## 2. What is genuinely verified today

| Item | Evidence |
| --- | --- |
| All 44 routes render at 5 widths | 220/220 captures, 0 defects |
| No horizontal overflow anywhere | measured, not eyeballed |
| Pointer targets meet WCAG 2.5.8 | measured, exceptions applied deliberately |
| No fake success in any of the 13 simulated seams | inspected individually |
| TypeScript clean | `tsc --noEmit` |
| Production build clean | `next build` |
| Only approved prices exist | `plan_prices` design + code constants agree |
| No secret in the repository | grep over tracked files |
| Contact success gated on provider 2xx | implemented |
| Storage units consistent (decimal) | fixed and re-verified |

That is a real foundation. It is also entirely frontend.

---

## 3. Functional readiness

| Area | State | Blocker to shipping |
| --- | --- | --- |
| Public site | ✅ | — |
| Auth (email/password, Google) | ✅ code, ⬜ untested against a live project | Needs a real Supabase project |
| Dashboard reads | 🟡 adapters designed | Needs schema + RLS |
| Uploads | 🟡 designed | Needs R2 + the 13-step pipeline |
| Storage accounting | 🟡 designed | Needs reservations + reconciliation |
| Trash | 🟡 designed | Needs cleanup job |
| Sharing | 🟡 designed | Needs grants + link expiry |
| Organisations | 🟡 designed | Needs roles in RLS |
| Billing | 🟡 designed | **Blocked on merchant capability** |
| Email | 🟡 one template live | **Blocked on domain verification** |
| Cron jobs | 🟡 designed | Needs deployment |

---

## 4. Security readiness

| Item | State | Note |
| --- | --- | --- |
| RLS everywhere | 🟡 | Designed, not written |
| Negative isolation tests | 🟡 | Blocked on schema |
| No client-supplied identity | 🟡 | Designed; static test planned |
| Signature verification | 🟡 | Designed |
| Webhook idempotency | 🟡 | Designed |
| Service key never in bundle | 🟡 | Bundle grep planned |
| **Security headers** | ⬜ | **Nothing sets CSP/HSTS/frame options today** |
| Rate limiting | ⬜ | Only the contact form has it |
| Malware scanning | ➖ | Not configured; nothing may claim it |
| MFA step-up | ⬜ | Accepted risk |
| Breach notification runbook | ⬜ | Required under DPDP |

---

## 5. Operational readiness

| Item | State |
| --- | --- |
| Backups configured | 🟡 |
| **Restore rehearsed** | ⬜ **never performed** |
| PITR window confirmed | ⬜ unconfirmed |
| R2 versioning on production | ⬜ not configured |
| Alerting | ⬜ none |
| Incident runbook | ⬜ not written |
| On-call | ➖ single-operator project |
| Log retention (DPDP Rules r.6, one year from 13 May 2027) | ⬜ not implemented |
| Cost monitoring | ⬜ |
| Load tested | ⬜ |

---

## 6. Blockers that are decisions, not code

These cannot be resolved by writing software. Each needs a human answer.

1. **Razorpay merchant capability.** Is the account enabled for international payments
   and recurring charges? Until confirmed, `BILLING_CAPABILITIES` stays `false` and
   subscriptions are not offered.
2. **Approved payment methods.** Card? UPI? Net banking? Copy may not name a method the
   account is not approved for.
3. **Supabase plan and PITR.** Determines whether the RPO above is 5 minutes or 24
   hours. Must be known before promising customers anything about recovery.
4. **R2 region.** Determines what can honestly be said about data residency. The
   privacy policy must not assert a location until a bucket has one.
5. **Verified sending domain** for Resend. Without it, transactional email reaches
   exactly one address.
6. **Trash retention approval.** `TRASH_RETENTION.approved` is `false`; the UI says
   provisional. Someone has to approve 30 days.
7. **Organisation billing model.** Does an org have its own subscription, or does it
   inherit the owner's? This changes the schema and is currently unresolved.
8. **Grievance officer / DPO contact.** Required to be displayed under the
   CP(E-Commerce) Rules and DPDP. The support address exists; the named role does not.

---

## 7. Compliance readiness

| Requirement | State |
| --- | --- |
| Policies published as data | ✅ |
| Unresolved claims marked as placeholders | ✅ |
| No invented certifications | ✅ |
| CP(E-Commerce) 48h / 1 month stated | ✅ in copy |
| Same commitments enforced operationally | ⬜ no ticket system |
| DPDP erasure path | 🟡 designed |
| DPDP breach notification (Board + each Data Principal) | ⬜ no runbook |
| Child-user safeguards (§9) | ⬜ not implemented |
| Consent records | ⬜ not implemented |
| EU Data Act switching (2-month notice, 30-day transition, 30-day retrieval) | 🟡 documented; portability tooling not built |
| Export produces a real, complete bundle | 🟡 designed |

---

## 8. Documentation readiness

| Document | State |
| --- | --- |
| `implementation-audit.md` | ✅ |
| `backend-architecture.md` | ✅ |
| `database-schema.md` | ✅ |
| `api-reference.md` | ✅ |
| `storage-architecture.md` | ✅ |
| `payment-lifecycle.md` | ✅ |
| `email-system.md` | ✅ |
| `security/threat-model.md` | ✅ |
| `security/security-checklist.md` | ✅ |
| `deployment/deployment-guide.md` | ✅ |
| `deployment/environment-variables.md` | ✅ |
| `deployment/backup-and-recovery.md` | ✅ |
| Migrations | ⬜ not written |
| Tests | ⬜ not written |

Documentation is complete **as design**. It becomes true as the code lands, and each
document must be corrected in the same commit that diverges from it. This project has
already had one round of doc/code drift and does not need another.

---

## 9. Exit criteria for calling this production-ready

All must be true simultaneously:

- [ ] Migrations applied, RLS enabled on every table, negative tests passing
- [ ] The 13-step upload flow implemented and proven, including the concurrency test
- [ ] Storage accounting reconciles against real R2 objects
- [ ] Trash cleanup runs and is observed running
- [ ] Subscription expiry preserves files, verified by test
- [ ] Billing verified end-to-end with test keys, then once with live keys at minimum
      amount and refunded
- [ ] Duplicate webhook delivery produces exactly one invoice
- [ ] Email sends from a verified domain to a third-party address
- [ ] Security headers set and verified
- [ ] Restore rehearsal passed and recorded
- [ ] No `mismatch` in health
- [ ] Visual gate green against the production host
- [ ] Every blocker in §6 has a written answer

---

## 10. What happens next

The build order in `implementation-audit.md` §9 is the plan: schema and RLS first,
because every subsequent test depends on them, then identity resolution, storage,
uploads, files/folders/trash/sharing, organisations, billing, email and jobs — with the
RLS negative tests landing in the same change as the first migration rather than
"sometime later".

A completion report written before those exit criteria are met would be the exact
failure this project has spent five phases avoiding.

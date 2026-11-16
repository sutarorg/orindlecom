# Anti-Abuse Operations

**How the system behaves without anyone watching it.** That is the requirement, and
this document describes what actually runs, what it costs, and how to diagnose a
decision without a dashboard.

---

## 1. Scheduled work

| Job | Cadence | What it does | If it fails |
| --- | --- | --- | --- |
| `/api/cron/abuse-maintenance` | every 10 min | Releases expired restrictions, closes orphaned blocks, prunes risk data | Cooldowns stay applied past their expiry. Enforcement still works; recovery is delayed. Nothing is lost |
| `/api/cron/domain-intel` | daily 06:00 | Refreshes disposable-domain intelligence; validates the baseline | The seed list remains. Detection is less complete, never off |
| `/api/cron/expire-reservations` | every 10 min | (existing) Releases storage reservations for abandoned uploads | Quota held until the 24 h expiry, then released anyway |

Both new jobs are idempotent and safe to overlap. Vercel may invoke a cron twice; the
guards are `released_at is null` and timestamp-based deletes, so a duplicate run is a
no-op rather than a double release.

**No in-memory state anywhere.** No `setInterval`, no module-level Map. A serverless
function's memory is not shared between instances and does not survive a cold start.

---

## 2. The recovery loop, end to end

This is the part that replaces an administrator.

```
t+0      Signup from a device with 4 accounts today
         → score 80, band `confirmed`
         → apply_signup_outcome() records the decision,
                                       inserts an upload_block expiring in 24 h
t+10m    abuse-maintenance runs; block is not yet expired; nothing happens
t+24h    abuse-maintenance runs; block expires
         → release_expired_restrictions() sets released_at, logs restriction_released
t+24h+   Next signup from that device: device_signups rows are older than the
         windows, so signup_signals() returns zeros, score is 0, band is `low`
```

No human was involved at any point. The account kept every file it had throughout, and
its owner could still download and share them.

**The one case that needs a person** is a lost authenticator with no second factor
enrolled — a recovery request via `/contact`. That is not routine enforcement.

---

## 3. Why the score "decays" without a decay job

The policy row has a `decay_points_per_day` column, and the honest answer is that the
scoring does not use it: **signals are counted over sliding windows, not accumulated into
a stored score.** A device that stops misbehaving has no signals after 30 days because
the rows have aged out of the window, which is decay by construction.

A stored, decaying score would need a job to recalculate it, and a job that fails leaves
scores frozen high. Counting rows cannot get stuck.

The column is retained because it documents the intended rate, and because a future
change that does store a score will need it. It is not dead config that silently does
nothing — this paragraph is the note explaining why it is unused.

---

## 4. Diagnosing a decision with SQL

There is no dashboard. There is a table. These are the queries that replace one.

**Why was this account restricted?**

```sql
select r.kind, r.reason, r.risk_score, r.evidence, r.created_at, r.expires_at, r.released_at
  from public.account_restrictions r
 where r.user_id = '<uuid>'
 order by r.created_at desc;
```

`evidence->'reasons'` names every contributing factor, e.g.
`["disposable_email_domain"]` or `["device_accounts_week:4", "ip_burst:6"]`.

**What happened around this signup?**

```sql
select kind, score, level, metadata, created_at
  from public.risk_events
 where user_id = '<uuid>' or device_hash = '<hash>'
 order by created_at desc
 limit 50;
```

**How many accounts has this device produced?**

```sql
select count(distinct user_id) as accounts,
       min(created_at) as first_seen,
       max(created_at) as last_seen
  from public.device_signups
 where device_hash = '<hash>' and outcome = 'accepted';
```

**Is a domain classification wrong?**

```sql
select * from public.email_domain_risk where domain = 'example.com';
-- Override it without waiting for a feed:
insert into public.email_domain_risk (domain, classification, source)
values ('example.com', 'safe', 'manual')
on conflict (domain) do update set classification = excluded.classification, source = 'manual';
```

Manual corrections survive the daily refresh for `safe` rows because the feed job only
overwrites domains it lists.

**What are the current thresholds?**

```sql
select * from public.abuse_policy;
```

---

## 5. Tuning

Change thresholds by **migration**, not by an ad-hoc `UPDATE` in a console. The policy is
a row so a change is a reviewable statement with a history in `supabase/migrations/`.

| Symptom | Likely cause | Adjustment |
| --- | --- | --- |
| Legitimate customers refused | `weight_disposable` firing on a domain that is not actually disposable | Fix the classification, not the weight |
| Legitimate customers challenged repeatedly | `medium_threshold` too low, or `weight_device_week` too high for shared households | Raise the threshold or lower the weight |
| Abuse getting through | Windows too short, or `confirmed_device_accounts` too high | Lengthen `device_window_hours`, lower the account count |
| Cooldowns feel punitive | `high_restriction_minutes` | Lower it; a false positive should be an inconvenience |

**Never raise `confirmed_threshold` above 100.** The score is clamped to 100 and a
threshold above it would make the band unreachable — caught by the check constraint on
ordering, but worth stating.

---

## 6. Cost

| Store | Growth | Retention |
| --- | --- | --- |
| `risk_events` | ~3 rows per signup | 90 days |
| `device_signups` | 1 row per signup | 30 days |
| `turnstile_tokens` | 1 row per challenge | 1 hour |
| `account_restrictions` | 1 row per restriction | kept (needed as evidence) |

Three queries per signup, all indexed. The gate adds roughly one round trip to a request
that already makes several to Supabase.

---

## 7. What to do if something is badly wrong

| Situation | Action |
| --- | --- |
| Everyone is being refused | `update public.abuse_policy set weight_disposable = 0` via migration. Do not drop the table — the audit trail is in it |
| A specific domain is wrongly blocked | Fix the row (see §4). `safe` entries are not overwritten by the feed |
| Cooldowns are stuck | Run `/api/cron/abuse-maintenance` manually with the cron secret; it releases everything expired |
| Turnstile is blocking everyone | Unset `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The gate degrades to the other five layers, and the UI stops rendering the widget |
| The domain feed is poisoning the list | Unset `DOMAIN_INTEL_URL`. The seed baseline takes over on the next run |

Every one of those is a configuration change, not a code change. That was the point.

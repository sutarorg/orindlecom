-- 0013 · email payload and dedupe
--
-- Two problems the log could not express before this migration:
--
--   1. A retry had no data to render with. `email-retry` re-sent every failed row
--      with an empty payload, so a retried `verify-email` arrived with a blank
--      link — worse than not sending it.
--
--   2. Duplicate suppression had no key. The subscription sweep decided whether a
--      warning had been sent by asking "does any sent row use this template?",
--      which is global: the first subscriber to reach day 7 suppressed day-7 mail
--      for everyone else on the platform, forever.
--
-- `payload` carries whatever the template needs. `dedupe_key` is the caller's
-- promise that this specific notification happens once; the partial unique index
-- enforces it even if the job runs twice concurrently, which a SELECT-then-INSERT
-- check cannot.

alter table public.email_log
  add column payload jsonb not null default '{}'::jsonb;

alter table public.email_log
  add column dedupe_key text;

create unique index email_log_dedupe
  on public.email_log (dedupe_key)
  where dedupe_key is not null;

-- Queued mail is sent by the retry job, so it needs the same due-at index that
-- failed mail already had.
create index email_queued_due
  on public.email_log (next_attempt_at)
  where status = 'queued';

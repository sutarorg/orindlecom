-- 0008 — activity log, support requests, email log.

create table public.activity_events (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  subject_type    text not null,
  subject_id      uuid,
  kind            text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index activity_org_time on public.activity_events (organization_id, created_at desc);
create index activity_actor_time on public.activity_events (actor_id, created_at desc);

create table public.support_requests (
  id                  uuid primary key default gen_random_uuid(),
  submitter_email     text not null,
  submitter_id        uuid references auth.users(id) on delete set null,
  category            text not null,
  subject             text not null,
  message             text not null,
  source              text not null default 'contact-form',
  delivery_status     text not null default 'pending'
                      check (delivery_status in ('pending','delivered','failed')),
  provider_message_id text,
  delivery_error      text,
  created_at          timestamptz not null default now()
);

create index support_created on public.support_requests (created_at desc);

create table public.email_log (
  id                  uuid primary key default gen_random_uuid(),
  to_address          text not null,
  template            text not null,
  status              text not null check (status in ('queued','sent','failed')),
  provider_message_id text,
  error               text,
  attempts            int not null default 0 check (attempts >= 0),
  next_attempt_at     timestamptz,
  created_at          timestamptz not null default now()
);

create index email_retry on public.email_log (next_attempt_at)
  where status = 'failed';

-- Rate limiting that survives multiple serverless instances. In-memory counters
-- reset on every cold start and are useless across concurrent functions.
create table public.rate_limits (
  bucket     text not null,
  window_start timestamptz not null,
  count      int not null default 0,
  primary key (bucket, window_start)
);

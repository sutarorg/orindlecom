-- 0016 — single-use Turnstile tokens.
--
-- Cloudflare already refuses a replayed token, so this table is defence in
-- depth for one specific case: the Siteverify call succeeds but the response is
-- lost in transit, so our caller sees a failure and the client retries with the
-- same token. Cloudflare would accept it; this table refuses it.
--
-- Only the hash is stored, never the token, because a stored token is a
-- credential for the few minutes it remains valid.
--
-- Rows are swept by the daily risk maintenance job; the retention window only
-- needs to exceed a token's lifetime (300 s) by a wide margin.

create table public.turnstile_tokens (
  token_hash  text primary key,
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index turnstile_tokens_age on public.turnstile_tokens (created_at);

alter table public.turnstile_tokens enable row level security;

-- Deny-all by design: no policy, and a grant so a client sees zero rows rather
-- than a permission error. Only the service role writes here.
grant select on public.turnstile_tokens to authenticated;
grant select, insert, update, delete on public.turnstile_tokens to service_role;

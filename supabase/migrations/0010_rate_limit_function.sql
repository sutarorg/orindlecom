-- Atomic rate limiting.
--
-- The table was created in 0008 but nothing consumed it. Doing the counting in
-- application code would be a read-modify-write race: two concurrent requests
-- both read count = 4 and both write 5, so a limit of 5 lets through 6 or more.
-- A single INSERT ... ON CONFLICT DO UPDATE is atomic on its own row, so the
-- increment cannot be lost.
--
-- Window bucketing: the caller passes a window length in seconds. The row key is
-- the start of the window the request falls into, so no cleanup job is needed for
-- windows that have expired beyond the retention sweep below — and an old window
-- cannot be resurrected by a clock change because it is a stored timestamp.

create or replace function public.check_rate_limit(
  p_bucket   text,
  p_limit    int,
  p_window_s int
)
returns table (
  allowed     boolean,
  used        int,
  remaining   int,
  reset_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_window  timestamptz;
  v_count   int;
begin
  if p_limit <= 0 then
    raise exception 'rate limit must be positive' using errcode = '22023';
  end if;
  if p_window_s <= 0 then
    raise exception 'rate window must be positive' using errcode = '22023';
  end if;

  -- Truncate now() down to a multiple of the window length since the epoch, so
  -- every instance agrees on which window a request belongs to without any shared
  -- state beyond the row itself.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_s) * p_window_s
  );

  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  allowed   := v_count <= p_limit;
  used      := v_count;
  remaining := greatest(p_limit - v_count, 0);
  reset_at  := v_window + make_interval(secs => p_window_s);

  return next;
end;
$fn$;

comment on function public.check_rate_limit(text, int, int) is
  'Atomically increments a rate-limit counter for the current window and reports whether the caller is still under the limit.';

-- Only the service role touches this. A client that could call it directly could
-- reset or inflate its own counters.
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

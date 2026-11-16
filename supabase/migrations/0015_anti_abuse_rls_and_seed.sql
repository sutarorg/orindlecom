-- 0015 — RLS for the anti-abuse tables, and the seeded domain baseline.
--
-- The split is deliberate:
--
--   * `account_security` gets a policy, because the Set Password gate is read
--     through the user's own client and doing that with the service key would be
--     exactly the shortcut  src/lib/supabase/service.ts  warns against.
--   * Everything else is deny-all by design. Risk scores, device hashes and
--     restriction records are not the user's data to read, and a client that
--     could read its own risk score could also learn how to stay under the
--     threshold. They are read by the service role from scheduled jobs and
--     server routes only.

alter table public.abuse_policy          enable row level security;
alter table public.email_domain_risk     enable row level security;
alter table public.account_security      enable row level security;
alter table public.device_signups        enable row level security;
alter table public.risk_events           enable row level security;
alter table public.account_restrictions  enable row level security;

-- Grants, so a client gets zero rows rather than a permission error (the same
-- convention 0009 established and explains).
grant select on public.abuse_policy, public.email_domain_risk, public.account_security,
  public.device_signups, public.risk_events, public.account_restrictions
  to authenticated;

-- The service role does all of the writing, and reads every table above. Grants
-- are separate from RLS: without these, the server gets a permission error
-- rather than the rows it is entitled to.
grant select, insert, update, delete on public.abuse_policy, public.email_domain_risk,
  public.account_security, public.device_signups, public.risk_events,
  public.account_restrictions to service_role;

-- The one policy: a signed-in user may read their own security record.
--
-- SELECT only. There is no insert, update or delete policy, so a client cannot
-- clear `password_setup_required`, and the table's column default is the only
-- thing that ever sets it.
create policy account_security_read_own on public.account_security
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The domain baseline.
--
-- Two categories, both curated by hand from widely-documented provider lists:
--
--   safe        — consumer and business providers that are legitimate. Listed
--                 explicitly rather than inferred, because an unclassified
--                 domain is treated as "no signal" and these must not be
--                 accidentally caught by any future heuristic.
--   disposable  — known throwaway-mail services.
--
-- `risky` is seeded empty. Marking a domain risky is a judgement that needs
-- evidence, and shipping guesses would block real customers.
--
-- This is a starting point, not an authority. The scheduled refresh job in
-- src/app/api/cron/domain-intel/route.ts replaces it when an external feed is
-- configured, and a last-known-good copy is retained if that feed fails.
-- ---------------------------------------------------------------------------
insert into public.email_domain_risk (domain, classification, source) values
  ('gmail.com', 'safe', 'baseline'),
  ('googlemail.com', 'safe', 'baseline'),
  ('outlook.com', 'safe', 'baseline'),
  ('outlook.in', 'safe', 'baseline'),
  ('hotmail.com', 'safe', 'baseline'),
  ('hotmail.co.uk', 'safe', 'baseline'),
  ('live.com', 'safe', 'baseline'),
  ('live.in', 'safe', 'baseline'),
  ('msn.com', 'safe', 'baseline'),
  ('yahoo.com', 'safe', 'baseline'),
  ('yahoo.co.in', 'safe', 'baseline'),
  ('yahoo.co.uk', 'safe', 'baseline'),
  ('ymail.com', 'safe', 'baseline'),
  ('icloud.com', 'safe', 'baseline'),
  ('me.com', 'safe', 'baseline'),
  ('mac.com', 'safe', 'baseline'),
  ('protonmail.com', 'safe', 'baseline'),
  ('proton.me', 'safe', 'baseline'),
  ('pm.me', 'safe', 'baseline'),
  ('tutanota.com', 'safe', 'baseline'),
  ('tuta.com', 'safe', 'baseline'),
  ('tuta.io', 'safe', 'baseline'),
  ('zoho.com', 'safe', 'baseline'),
  ('zohomail.com', 'safe', 'baseline'),
  ('fastmail.com', 'safe', 'baseline'),
  ('hey.com', 'safe', 'baseline'),
  ('aol.com', 'safe', 'baseline'),
  ('gmx.com', 'safe', 'baseline'),
  ('gmx.net', 'safe', 'baseline'),
  ('mail.com', 'safe', 'baseline'),
  ('yandex.com', 'safe', 'baseline'),
  ('yandex.ru', 'safe', 'baseline'),
  ('rediffmail.com', 'safe', 'baseline'),
  ('sina.com', 'safe', 'baseline'),
  ('qq.com', 'safe', 'baseline'),
  ('163.com', 'safe', 'baseline'),
  ('126.com', 'safe', 'baseline'),
  ('naver.com', 'safe', 'baseline'),
  ('daum.net', 'safe', 'baseline'),
  -- Common business/workspace providers: an address here is a company, which is
  -- a strong legitimacy signal rather than a risk one.
  ('workspace.google.com', 'safe', 'baseline'),

  ('mailinator.com', 'disposable', 'baseline'),
  ('mailinator.net', 'disposable', 'baseline'),
  ('mailinator2.com', 'disposable', 'baseline'),
  ('guerrillamail.com', 'disposable', 'baseline'),
  ('guerrillamail.net', 'disposable', 'baseline'),
  ('guerrillamail.org', 'disposable', 'baseline'),
  ('guerrillamail.de', 'disposable', 'baseline'),
  ('sharklasers.com', 'disposable', 'baseline'),
  ('grr.la', 'disposable', 'baseline'),
  ('spam4.me', 'disposable', 'baseline'),
  ('tempmail.com', 'disposable', 'baseline'),
  ('temp-mail.org', 'disposable', 'baseline'),
  ('temp-mail.io', 'disposable', 'baseline'),
  ('tempmailo.com', 'disposable', 'baseline'),
  ('tempmail.net', 'disposable', 'baseline'),
  ('10minutemail.com', 'disposable', 'baseline'),
  ('10minutemail.net', 'disposable', 'baseline'),
  ('20minutemail.com', 'disposable', 'baseline'),
  ('throwawaymail.com', 'disposable', 'baseline'),
  ('yopmail.com', 'disposable', 'baseline'),
  ('yopmail.fr', 'disposable', 'baseline'),
  ('yopmail.net', 'disposable', 'baseline'),
  ('maildrop.cc', 'disposable', 'baseline'),
  ('getnada.com', 'disposable', 'baseline'),
  ('nada.email', 'disposable', 'baseline'),
  ('dispostable.com', 'disposable', 'baseline'),
  ('trashmail.com', 'disposable', 'baseline'),
  ('trashmail.de', 'disposable', 'baseline'),
  ('trash-mail.com', 'disposable', 'baseline'),
  ('mytemp.email', 'disposable', 'baseline'),
  ('mohmal.com', 'disposable', 'baseline'),
  ('moakt.com', 'disposable', 'baseline'),
  ('emailondeck.com', 'disposable', 'baseline'),
  ('fakeinbox.com', 'disposable', 'baseline'),
  ('mailnesia.com', 'disposable', 'baseline'),
  ('spambog.com', 'disposable', 'baseline'),
  ('discard.email', 'disposable', 'baseline'),
  ('discardmail.com', 'disposable', 'baseline'),
  ('mailsac.com', 'disposable', 'baseline'),
  ('inboxkitten.com', 'disposable', 'baseline'),
  ('burnermail.io', 'disposable', 'baseline'),
  ('tempinbox.com', 'disposable', 'baseline'),
  ('anonbox.net', 'disposable', 'baseline'),
  ('byom.de', 'disposable', 'baseline'),
  ('sneakemail.com', 'disposable', 'baseline'),
  ('mintemail.com', 'disposable', 'baseline'),
  ('meltmail.com', 'disposable', 'baseline'),
  ('email-temp.com', 'disposable', 'baseline'),
  ('linshiyouxiang.net', 'disposable', 'baseline'),
  ('24mail.chacuo.net', 'disposable', 'baseline')
on conflict (domain) do nothing;

-- A view of the baseline that the refresh job diffs against, so a bad feed can be
-- rejected wholesale rather than partially applied.
create or replace view public.domain_baseline as
  select domain, classification from public.email_domain_risk where source = 'baseline';
grant select on public.domain_baseline to service_role;

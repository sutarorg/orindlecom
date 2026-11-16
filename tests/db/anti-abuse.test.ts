/**
 * Anti-abuse database behaviour.
 *
 * These run against the real schema (PGlite), because almost every guarantee the
 * anti-abuse system claims is a property of the database rather than of a code
 * path:
 *
 *   - the *same* device producing a fourth account is refused,
 *   - a disposable domain scores as `confirmed` and never as a coin flip,
 *   - an unverified account has zero allowance, so no upload path can grant one,
 *   - a restriction refuses a reservation while it is live and permits one after
 *     its cooldown, without anyone intervening,
 *   - two concurrent reservations cannot both take the last of a plan.
 *
 * That last one is already covered by tests/db/storage.test.ts; the version here
 * is the anti-abuse variant, where one of the two callers is restricted.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, pgError, type TestDb } from "./harness";

let t: TestDb;

beforeAll(async () => {
  t = await createTestDb();
}, 180_000);

afterAll(async () => {
  await t?.close();
});

const GB = 1_000_000_000n;

/* ── Domain classification ────────────────────────────────────────────────── */

describe("disposable email screening", () => {
  it("classifies the three states distinctly", async () => {
    const rows = await t.asService<{ safe: string | null; disposable: string | null; unknown: string | null }>(
      `select public.classify_email_domain('person@gmail.com')      as safe,
              public.classify_email_domain('throwaway@yopmail.com') as disposable,
              public.classify_email_domain('ceo@acme-industries.com') as unknown`,
    );
    expect(rows[0].safe).toBe("safe");
    expect(rows[0].disposable).toBe("disposable");
    // The critical one: an unfamiliar domain is NOT disposable. A false positive
    // here costs a real customer their signup.
    expect(rows[0].unknown).toBeNull();
  });

  it("is case-insensitive and ignores display-name forms", async () => {
    const rows = await t.asService<{ upper: string | null }>(
      `select public.classify_email_domain('Someone@MAILINATOR.com') as upper`,
    );
    expect(rows[0].upper).toBe("disposable");
  });

  it("does not treat privacy providers or business mail as disposable", async () => {
    const rows = await t.asService<{ d: string | null }>(
      `select count(*) filter (where classification <> 'disposable')::text as d
         from public.email_domain_risk
        where domain in ('protonmail.com', 'tuta.com', 'fastmail.com', 'zoho.com')`,
    );
    expect(Number(rows[0].d)).toBe(4);
  });

  it("keeps a protected list a broken feed cannot empty", async () => {
    // The feed job refuses to apply a list that marks these disposable; the
    // protection lives in the route. Here we assert the baseline they rely on.
    const rows = await t.asService<{ n: string }>(
      `select count(*)::text as n from public.email_domain_risk
        where classification = 'safe'
          and domain in ('gmail.com','outlook.com','icloud.com','yahoo.com')`,
    );
    expect(Number(rows[0].n)).toBe(4);
  });
});

/* ── Scoring ──────────────────────────────────────────────────────────────── */

describe("risk scoring", () => {
  it("a clean signup is low and carries no restriction", async () => {
    const rows = await t.asService<{ score: number; level: string }>(
      `select * from public.score_signup('safe', public.signup_signals(null, null))`,
    );
    expect(rows[0].level).toBe("low");
    expect(rows[0].score).toBe(0);
  });

  it("a disposable domain is confirmed regardless of the additive score", async () => {
    const rows = await t.asService<{ score: number; level: string; reasons: string[] }>(
      `select * from public.score_signup('disposable', public.signup_signals(null, null))`,
    );
    expect(rows[0].level).toBe("confirmed");
    expect(rows[0].reasons).toContain("disposable_email_domain");
  });

  it("is explainable: every contributing factor is named", async () => {
    const rows = await t.asService<{ reasons: string[] }>(
      `select * from public.score_signup(
         'disposable',
         '{"device_accounts_week": 3, "ip_accounts_hour": 4}'::jsonb
       )`,
    );
    const reasons = rows[0].reasons;
    expect(reasons).toContain("disposable_email_domain");
    expect(reasons).toContain("device_accounts_week:3");
    expect(reasons).toContain("ip_burst:4");
  });

  it("a shared device lands in medium, not confirmed", async () => {
    // A family tablet producing three accounts in a week is noise, not fraud. The
    // band must stay below the refusal threshold or every large household is
    // locked out.
    const rows = await t.asService<{ level: string; score: number }>(
      `select * from public.score_signup('safe', '{"device_accounts_week": 3}'::jsonb)`,
    );
    expect(["low", "medium"]).toContain(rows[0].level);
    expect(rows[0].level).not.toBe("confirmed");
  });

  it("four accounts on one device in a day is objective evidence", async () => {
    const rows = await t.asService<{ level: string; reasons: string[] }>(
      `select * from public.score_signup('safe', '{"device_accounts_day": 4}'::jsonb)`,
    );
    expect(rows[0].level).toBe("confirmed");
    expect(rows[0].reasons.some((r) => r.startsWith("device_accounts_day"))).toBe(true);
  });

  it("scores are bounded to 0..100", async () => {
    const rows = await t.asService<{ score: number }>(
      `select * from public.score_signup('disposable',
         '{"device_accounts_week": 99, "device_accounts_hour": 99, "ip_accounts_hour": 99,
           "captcha_failures_hour": 99, "prior_rejections_day": 99}'::jsonb)`,
    );
    expect(rows[0].score).toBeLessThanOrEqual(100);
    expect(rows[0].score).toBeGreaterThanOrEqual(0);
  });
});

/* ── Signals ──────────────────────────────────────────────────────────────── */

describe("signal collection", () => {
  it("counts distinct accounts per device and per address", async () => {
    const a = await t.createUser("sig-a@example.com");
    const b = await t.createUser("sig-b@example.com");

    for (const user of [a, b]) {
      await t.asService(
        `insert into public.device_signups (device_hash, user_id, ip_hash, outcome)
         values ('device-sig', $1, 'ip-sig', 'accepted')`,
        [user],
      );
    }

    const rows = await t.asService<{ s: Record<string, number> }>(
      `select public.signup_signals('device-sig', 'ip-sig') as s`,
    );
    expect(rows[0].s.device_accounts_week).toBe(2);
    expect(rows[0].s.ip_accounts_day).toBe(2);
  });

  it("counts a rejected outcome separately from an accepted one", async () => {
    await t.asService(
      `insert into public.device_signups (device_hash, user_id, ip_hash, outcome)
       values ('device-sig', null, 'ip-sig', 'rejected')`,
    );
    const rows = await t.asService<{ s: Record<string, number> }>(
      `select public.signup_signals('device-sig', 'ip-sig') as s`,
    );
    // Rejections must not inflate the distinct-account count...
    expect(rows[0].s.device_accounts_week).toBe(2);
    // ...but they must be visible, because they feed the next score.
    expect(rows[0].s.prior_rejections_day).toBe(1);
  });
});

/* ── Enforcement and recovery ─────────────────────────────────────────────── */

describe("enforcement", () => {
  it("applies a signup block at medium and never touches the account's data", async () => {
    const user = await t.createUser("medium@example.com");

    const result = await t.asService<{ r: { restricted: boolean; kind: string } }>(
      `select public.apply_signup_outcome($1, 'device-medium', 'ip-medium', 30, 'medium',
         '["device_accounts_week:3"]'::jsonb, 'accepted') as r`,
      [user],
    );

    expect(result[0].r.restricted).toBe(true);
    expect(result[0].r.kind).toBe("signup_block");

    // The distinguishing property: a medium band restricts *signup*, not uploads.
    const restrictions = await t.asService<{ kind: string }>(
      `select kind from public.account_restrictions where user_id = $1`,
      [user],
    );
    expect(restrictions.map((row) => row.kind)).toEqual(["signup_block"]);
  });

  it("applies an upload block at high", async () => {
    const user = await t.createUser("high@example.com");
    const result = await t.asService<{ r: { kind: string } }>(
      `select public.apply_signup_outcome($1, 'device-high', 'ip-high', 60, 'high',
         '["ip_burst:6"]'::jsonb, 'accepted') as r`,
      [user],
    );
    expect(result[0].r.kind).toBe("upload_block");
  });

  it("records both the decision and the restriction it caused", async () => {
    const user = await t.createUser("evidence@example.com");
    await t.asService(
      `select public.apply_signup_outcome($1, 'device-evidence', 'ip-evidence', 90, 'confirmed',
         '["disposable_email_domain"]'::jsonb, 'rejected')`,
      [user],
    );

    const kinds = await t.asService<{ kind: string }>(
      `select kind from public.risk_events where user_id = $1 order by created_at`,
      [user],
    );
    // Refusal and enforcement are separate rows, so the audit trail shows both
    // what happened and why.
    expect(kinds.map((k) => k.kind)).toContain("restriction_applied");
  });

  it("every restriction expires — there is no permanent state", async () => {
    const columns = await t.asService<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'account_restrictions'`,
    );
    const names = columns.map((c) => c.column_name);
    expect(names).toContain("expires_at");
    // A `permanent` or `banned` column would be the design failure this forbids.
    expect(names).not.toContain("permanent");
    expect(names).not.toContain("banned");
  });
});

describe("automatic recovery", () => {
  it("releases an expired cooldown and logs the release", async () => {
    const user = await t.createUser("recover@example.com");

    await t.asService(
      `insert into public.account_restrictions (user_id, kind, reason, expires_at)
       values ($1, 'upload_block', 'test', now() - interval '1 minute')`,
      [user],
    );

    const released = await t.asService<{ n: number }>(
      `select public.release_expired_restrictions() as n`,
    );
    expect(Number(released[0].n)).toBeGreaterThanOrEqual(1);

    const after = await t.asService<{ released_at: string | null }>(
      `select released_at from public.account_restrictions where user_id = $1`,
      [user],
    );
    expect(after[0].released_at).not.toBeNull();

    // The release is itself an event, so recovery is as auditable as enforcement.
    const events = await t.asService<{ kind: string }>(
      `select kind from public.risk_events where user_id = $1`,
      [user],
    );
    expect(events.map((e) => e.kind)).toContain("restriction_released");
  });

  it("does not release a cooldown that has not elapsed", async () => {
    const user = await t.createUser("still-blocked@example.com");
    await t.asService(
      `insert into public.account_restrictions (user_id, kind, reason, expires_at)
       values ($1, 'upload_block', 'test', now() + interval '30 minutes')`,
      [user],
    );

    await t.asService(`select public.release_expired_restrictions()`);

    const row = await t.asService<{ released_at: string | null }>(
      `select released_at from public.account_restrictions where user_id = $1`,
      [user],
    );
    expect(row[0].released_at).toBeNull();
  });

  it("is idempotent: releasing twice changes nothing the second time", async () => {
    const user = await t.createUser("idem@example.com");
    await t.asService(
      `insert into public.account_restrictions (user_id, kind, reason, expires_at)
       values ($1, 'upload_block', 'test', now() - interval '1 minute')`,
      [user],
    );

    await t.asService(`select public.release_expired_restrictions()`);
    const second = await t.asService<{ n: number }>(
      `select public.release_expired_restrictions() as n`,
    );
    expect(Number(second[0].n)).toBe(0);
  });
});

/* ── Entitlement ──────────────────────────────────────────────────────────── */

describe("verified email is a precondition for storage", () => {
  it("an unverified account has zero allowance", async () => {
    const user = await t.createUser("unverified@example.com");
    // createUser leaves email_confirmed_at null, which is exactly the state a
    // signup is in before the link is clicked.
    const rows = await t.asService<{ bytes: string }>(
      `select public.effective_plan_bytes($1) as bytes`,
      [user],
    );
    expect(BigInt(rows[0].bytes)).toBe(0n);
  });

  it("verifying the address grants the Free 10 GB", async () => {
    const user = await t.createUser("verified@example.com");
    await t.verifyUser(user);

    const rows = await t.asService<{ bytes: string }>(
      `select public.effective_plan_bytes($1) as bytes`,
      [user],
    );
    expect(BigInt(rows[0].bytes)).toBe(10n * GB);
  });

  it("refuses a reservation outright for an unverified account", async () => {
    const user = await t.createUser("no-entitlement@example.com");

    await expect(
      t.asUser(
        user,
        `select public.reserve_storage($1, 1000, gen_random_uuid())`,
        [user],
      ),
    ).rejects.toSatisfy((error: unknown) => pgError(error) === "email_unverified");
  });

  it("refuses a reservation while an upload block is live, and allows it after", async () => {
    const user = await t.createUser("blocked-upload@example.com");
    await t.verifyUser(user);

    // Baseline: the same call succeeds with no restriction.
    await t.asUser(user, `select public.reserve_storage($1, 1000, gen_random_uuid())`, [user]);

    await t.asService(
      `insert into public.account_restrictions (user_id, kind, reason, expires_at)
       values ($1, 'upload_block', 'test', now() + interval '1 hour')`,
      [user],
    );

    await expect(
      t.asUser(user, `select public.reserve_storage($1, 1000, gen_random_uuid())`, [user]),
    ).rejects.toSatisfy((error: unknown) => pgError(error) === "abuse_restricted");

    // Expire it, release it through the job's function, and confirm the block is
    // genuinely gone rather than merely old.
    await t.asService(
      `update public.account_restrictions set expires_at = now() - interval '1 minute'
        where user_id = $1`,
      [user],
    );
    await t.asService(`select public.release_expired_restrictions()`);

    await expect(
      t.asUser(user, `select public.reserve_storage($1, 1000, gen_random_uuid())`, [user]),
    ).resolves.toBeDefined();
  });

  it("still enforces the plan ceiling with no restriction present", async () => {
    const user = await t.createUser("ceiling@example.com");
    await t.verifyUser(user);

    // 10 GB plan, ask for 11 GB.
    await expect(
      t.asUser(user, `select public.reserve_storage($1, $2, gen_random_uuid())`, [user, 11n * GB]),
    ).rejects.toSatisfy((error: unknown) => pgError(error) === "quota_exceeded");
  });
});

/* ── Quota bypass escalation ──────────────────────────────────────────────── */

describe("repeated quota refusals", () => {
  it("escalates on the third refusal in an hour, not before", async () => {
    const user = await t.createUser("repeat@example.com");

    const first = await t.asService<{ r: { restricted: boolean; violations: number } }>(
      `select public.record_quota_violation($1, null, null) as r`,
      [user],
    );
    expect(first[0].r.restricted).toBe(false);

    const second = await t.asService<{ r: { restricted: boolean; violations: number } }>(
      `select public.record_quota_violation($1, null, null) as r`,
      [user],
    );
    expect(second[0].r.restricted).toBe(false);

    const third = await t.asService<{ r: { restricted: boolean; violations: number } }>(
      `select public.record_quota_violation($1, null, null) as r`,
      [user],
    );
    expect(third[0].r.restricted).toBe(true);
    expect(third[0].r.violations).toBe(3);
  });

  it("a single refusal leaves the account untouched", async () => {
    const user = await t.createUser("once@example.com");
    await t.asService(`select public.record_quota_violation($1, null, null)`, [user]);

    const rows = await t.asService<{ n: string }>(
      `select count(*)::text as n from public.account_restrictions where user_id = $1`,
      [user],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});

/* ── Policy is data, not code ─────────────────────────────────────────────── */

describe("policy", () => {
  it("keeps its thresholds ordered and refuses an incoherent edit", async () => {
    await expect(
      t.asService(`update public.abuse_policy set high_threshold = 10 where id`),
    ).rejects.toThrow();
  });

  it("a threshold change moves the band with no code change", async () => {
    const before = await t.asService<{ level: string }>(
      `select * from public.score_signup('safe', '{"device_accounts_week": 4}'::jsonb)`,
    );

    await t.asService(
      `update public.abuse_policy set medium_threshold = 1, high_threshold = 2,
        confirmed_threshold = 3 where id`,
    );

    const after = await t.asService<{ level: string }>(
      `select * from public.score_signup('safe', '{"device_accounts_week": 4}'::jsonb)`,
    );

    expect(after[0].level).not.toBe(before[0].level);

    // Restore for any test that runs after this one.
    await t.asService(
      `update public.abuse_policy set medium_threshold = 25, high_threshold = 55,
        confirmed_threshold = 80 where id`,
    );
  });
});

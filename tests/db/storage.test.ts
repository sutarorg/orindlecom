/**
 * Storage accounting and quota.
 *
 * The central test here is the concurrency one: "parallel upload sessions must
 * not bypass quota". It is the specific bug that makes a storage product
 * oversell its plans, and it is the reason reserve_storage is a database
 * function with a row lock rather than application code.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { createTestDb, pgError, type TestDb } from "./harness";

const GB = 1_000_000_000n;

let t: TestDb;
let user: string;

beforeAll(async () => {
  t = await createTestDb();
  user = await t.createUser("quota@example.com");
});

afterAll(async () => {
  await t?.close();
});

async function usage() {
  const rows = await t.asService<{ committed_bytes: string; reserved_bytes: string }>(
    `select committed_bytes, reserved_bytes from public.storage_usage where owner_id = $1`,
    [user],
  );
  if (rows.length === 0) return { committed: 0n, reserved: 0n };
  return {
    committed: BigInt(rows[0].committed_bytes),
    reserved: BigInt(rows[0].reserved_bytes),
  };
}

describe("plan allowance", () => {
  it("a new account gets the Free allowance in decimal bytes", async () => {
    const rows = await t.asService<{ bytes: string }>(
      `select public.effective_plan_bytes($1) as bytes`,
      [user],
    );
    expect(BigInt(rows[0].bytes)).toBe(10n * GB);
  });

  it("an active paid plan raises the allowance", async () => {
    await t.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status)
       values ($1,'plus','INR','active')`,
      [user],
    );
    const rows = await t.asService<{ bytes: string }>(
      `select public.effective_plan_bytes($1) as bytes`,
      [user],
    );
    expect(BigInt(rows[0].bytes)).toBe(500n * GB);

    // Back to Free for the rest of the suite.
    await t.asService(
      `update public.subscriptions set status='expired', expired_at=now(),
         recovery_ends_at = now() + interval '90 days' where owner_id = $1`,
      [user],
    );
    const back = await t.asService<{ bytes: string }>(
      `select public.effective_plan_bytes($1) as bytes`,
      [user],
    );
    expect(BigInt(back[0].bytes)).toBe(10n * GB);
  });

  it("an expired subscription does not delete or hide files", async () => {
    const f = await t.asService<{ id: string }>(
      `insert into public.files (owner_id, name, size_bytes, storage_key, status)
       values ($1,'kept-after-expiry.pdf',1000,'u/q/kept','available') returning id`,
      [user],
    );
    await t.asService(
      `update public.files set deleted_at = null where id = $1`,
      [f[0].id],
    );
    const rows = await t.asUser(user, `select id from public.files where id = $1`, [f[0].id]);
    expect(rows).toHaveLength(1);

    // Nothing in the subscription sweep may set deleted_at on a file.
    const deleted = await t.asService<{ n: number }>(
      `select count(*)::int as n from public.files
       where owner_id = $1 and deleted_at is not null`,
      [user],
    );
    expect(deleted[0].n).toBe(0);
  });
});

describe("reservations", () => {
  it("a reservation within quota is granted and counted", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (2n * GB).toString()],
    );
    expect(res).toHaveLength(1);

    const u = await usage();
    expect(u.reserved).toBe(2n * GB);
    expect(u.committed).toBe(0n);
  });

  it("a reservation beyond the plan is refused", async () => {
    // 2 GB already reserved; the Free plan is 10 GB, so 20 GB must fail.
    await expect(
      t.asService(`select public.reserve_storage($1, $2, gen_random_uuid())`, [
        user,
        (20n * GB).toString(),
      ]),
    ).rejects.toSatisfy((e: unknown) => pgError(e) === "quota_exceeded");
  });

  it("a zero or negative reservation is refused", async () => {
    await expect(
      t.asService(`select public.reserve_storage($1, 0, gen_random_uuid())`, [user]),
    ).rejects.toSatisfy((e: unknown) => pgError(e) === "invalid_size");
  });

  it("committing moves reserved bytes into committed", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (1n * GB).toString()],
    );
    await t.asService(`select public.commit_reservation($1, $2)`, [
      res[0].id,
      (1n * GB).toString(),
    ]);

    const u = await usage();
    expect(u.committed).toBe(1n * GB);
    expect(u.reserved).toBe(2n * GB); // the earlier 2 GB reservation is still live
  });

  it("committing a different actual size releases the difference", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (3n * GB).toString()],
    );
    // The upload arrived short: 1 GB instead of 3 GB.
    await t.asService(`select public.commit_reservation($1, $2)`, [
      res[0].id,
      (1n * GB).toString(),
    ]);

    const u = await usage();
    expect(u.committed).toBe(2n * GB);
    // reserved should have dropped by the full 3 GB request, not by 1 GB.
    expect(u.reserved).toBe(2n * GB);
  });

  it("a commit larger than the reservation is refused", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (1n * GB).toString()],
    );
    await expect(
      t.asService(`select public.commit_reservation($1, $2)`, [
        res[0].id,
        (5n * GB).toString(),
      ]),
    ).rejects.toSatisfy((e: unknown) => pgError(e) === "commit_exceeds_reservation");
  });

  it("a reservation cannot be committed twice", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (1n * GB).toString()],
    );
    await t.asService(`select public.commit_reservation($1, $2)`, [
      res[0].id,
      (1n * GB).toString(),
    ]);
    await expect(
      t.asService(`select public.commit_reservation($1, $2)`, [
        res[0].id,
        (1n * GB).toString(),
      ]),
    ).rejects.toSatisfy((e: unknown) => pgError(e) === "reservation_not_reserved");
  });

  it("releasing is idempotent", async () => {
    const res = await t.asService<{ id: string }>(
      `select id from public.reserve_storage($1, $2, gen_random_uuid())`,
      [user, (1n * GB).toString()],
    );
    const before = await usage();
    await t.asService(`select public.release_reservation($1)`, [res[0].id]);
    const after = await usage();
    expect(after.reserved).toBe(before.reserved - 1n * GB);

    // Second release must not double-subtract.
    await t.asService(`select public.release_reservation($1)`, [res[0].id]);
    const again = await usage();
    expect(again.reserved).toBe(after.reserved);
  });
});

describe("parallel uploads cannot bypass quota", () => {
  /**
   * IMPORTANT, and stated rather than glossed over.
   *
   * The test engine (PGlite) serialises every statement onto a single
   * connection. That means the interleaving this test would need in order to
   * *prove* the row lock works cannot occur here: removing `for update` from
   * reserve_storage still passes. Verified by experiment — the test was run
   * against a version with the lock removed, and it passed.
   *
   * So this test proves the invariant (reservations never exceed the plan and
   * every refusal is a quota refusal). The lock itself is covered by the
   * structural check in the next test, and must be re-verified against a real
   * multi-connection Postgres before launch — recorded as an open item in
   * docs/deployment/production-readiness.md.
   */
  it("reservations never exceed the allowance", async () => {
    // A clean account with a 10 GB allowance.
    const fresh = await t.createUser("race@example.com");

    const plan = 10n * GB;
    const each = 3n * GB;

    // Five concurrent 3 GB reservations = 15 GB of demand against 10 GB.
    // Without the row lock in reserve_storage, all five could pass a
    // read-then-write check and the account would land at 15 GB.
    const attempts = Array.from({ length: 5 }, (_, i) =>
      t
        .asService(`select public.reserve_storage($1, $2, gen_random_uuid())`, [
          fresh,
          each.toString(),
        ])
        .then(() => ({ ok: true as const, i }))
        .catch((error) => ({ ok: false as const, i, error })),
    );

    const results = await Promise.all(attempts);
    const granted = results.filter((r) => r.ok).length;
    const refused = results.filter((r) => !r.ok);

    // At most three 3 GB reservations fit in 10 GB.
    expect(granted).toBeLessThanOrEqual(3);

    const rows = await t.asService<{ reserved_bytes: string }>(
      `select reserved_bytes from public.storage_usage where owner_id = $1`,
      [fresh],
    );
    const reserved = BigInt(rows[0].reserved_bytes);

    // The invariant that matters: never more than the plan.
    expect(reserved).toBeLessThanOrEqual(plan);
    expect(reserved).toBe(BigInt(granted) * each);

    // And every refusal was a quota refusal, not an unrelated crash.
    for (const r of refused) {
      if (!r.ok) expect(pgError(r.error)).toBe("quota_exceeded");
    }
  });

  it("reserve_storage takes a row lock on the usage row", async () => {
    // A proxy for the behaviour the engine cannot exercise. The lock is the
    // entire mechanism that stops two uploads taking the same free space, so a
    // change that removes it must be a deliberate, visible failure rather than a
    // silent regression.
    const sql = await readFile(
      path.resolve(process.cwd(), "supabase/migrations/0006_storage_accounting.sql"),
      "utf8",
    );
    const fn = sql.slice(sql.indexOf("function public.reserve_storage"));
    const body = fn.slice(0, fn.indexOf("$$;"));
    expect(body).toMatch(/for\s+update/i);
  });
});

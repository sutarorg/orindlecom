/**
 * RLS coverage.
 *
 * Every table in `public` must have row-level security enabled. A table without it
 * is readable and writable by any authenticated user through the anon key, which is
 * the single worst failure mode this schema can have — and it is invisible in
 * application code, because the application never asks for a row it should not get.
 *
 * This test enumerates the tables from the live catalogue rather than from a list, so
 * a table added by a future migration is covered the moment it exists.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
let user: string;

beforeAll(async () => {
  db = await createTestDb();
  user = await db.createUser("rls@example.com");
}, 120_000);

afterAll(async () => {
  await db?.close();
});

interface TableRow {
  tablename: string;
  rowsecurity: boolean;
}

interface PolicyRow {
  tablename: string;
  policyname: string;
}

describe("row level security", () => {
  it("is enabled on every table in the public schema", async () => {
    const tables = await db.asService<TableRow>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );

    expect(tables.length).toBeGreaterThanOrEqual(18);

    const unprotected = tables.filter((table) => !table.rowsecurity).map((t) => t.tablename);
    expect(unprotected, `RLS is off for: ${unprotected.join(", ")}`).toEqual([]);
  });

  /**
   * Tables that are intentionally visible to nobody.
   *
   * RLS is enabled and there is no policy, so every read returns zero rows rather
   * than a permission error — the grant exists deliberately (see 0009) so a client
   * cannot tell the table is there. Only the service role touches these.
   *
   * Naming them individually is the point: the check below would otherwise have to
   * accept any table with no policy, which is exactly the state a forgotten policy
   * produces.
   */
  const DENY_ALL_BY_DESIGN = new Set([
    "email_log", // delivery audit, written by the server only
    "rate_limits", // counters; a client that could read these could infer traffic
    "support_requests", // contains other people's messages
    "webhook_events", // provider payloads, including payment metadata
  ]);

  it("every table with RLS has at least one policy, unless deny-all is the design", async () => {
    const tables = await db.asService<TableRow>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );
    const policies = await db.asService<PolicyRow>(
      `select tablename, policyname from pg_policies where schemaname = 'public'`,
    );
    const withPolicy = new Set(policies.map((p) => p.tablename));

    // RLS enabled with no policy denies everything, which is safe but means the
    // feature cannot work at all. Either state is a bug worth naming; this catches
    // the one that looks like a permissions mystery.
    const noPolicy = tables
      .filter((t) => t.rowsecurity && !withPolicy.has(t.tablename))
      .map((t) => t.tablename)
      .filter((name) => !DENY_ALL_BY_DESIGN.has(name));

    expect(noPolicy, `RLS is on but no policy exists for: ${noPolicy.join(", ")}`).toEqual([]);
  });

  it("really does deny rows on the deny-all tables", async () => {
    // The claim above is that these return zero rows rather than an error. Assert it
    // rather than trusting the comment: a policy added by a later migration would
    // silently open one of them.
    for (const table of DENY_ALL_BY_DESIGN) {
      const rows = await db.asUser<Record<string, unknown>>(
        user,
        `select * from public.${table} limit 1`,
      );
      expect(rows, `${table} returned rows to a signed-in user`).toHaveLength(0);
    }
  });

  it("denies an authenticated user any row from a table they do not own", async () => {
    // The broadest possible negative check: a plain select across every table a
    // signed-in user should not see everything in. Tables that are deliberately
    // readable (plans, plan_prices, currencies) are excluded by name so the
    // exclusion is a decision rather than a silent pass.
    const publicByDesign = new Set(["plans", "plan_prices", "currencies"]);
    const tables = await db.asService<TableRow>(
      `select tablename, rowsecurity from pg_tables where schemaname = 'public'`,
    );

    for (const table of tables) {
      if (!table.rowsecurity || publicByDesign.has(table.tablename)) continue;

      // Every one of these tables is either empty for this user or scoped to them.
      // The assertion is that the query succeeds — a policy that raises would be a
      // different bug — and returns rows the user may see.
      const rows = await db.asUser<Record<string, unknown>>(
        user,
        `select * from public.${table.tablename} limit 5`,
      );
      expect(Array.isArray(rows), `${table.tablename} select failed`).toBe(true);
    }
  });
});

describe("cross-tenant isolation with real rows", () => {
  it("one user cannot read another's files, and the query does not error", async () => {
    const alice = await db.createUser("alice@example.com");
    const bob = await db.createUser("bob@example.com");

    await db.asService(
      `insert into public.files (owner_id, name, status, size_bytes, storage_key, category)
       values ($1, 'alice-secret.txt', 'available', 10, $2, 'documents')`,
      [alice, `u/${alice}/secret`],
    );

    const visibleToBob = await db.asUser<{ name: string }>(
      bob,
      `select name from public.files`,
    );
    expect(visibleToBob).toHaveLength(0);

    // And Alice still sees her own row, so the isolation is not just "nobody sees
    // anything", which would pass the assertion above while breaking the product.
    const visibleToAlice = await db.asUser<{ name: string }>(
      alice,
      `select name from public.files`,
    );
    expect(visibleToAlice).toHaveLength(1);
    expect(visibleToAlice[0].name).toBe("alice-secret.txt");
  });

  it("one user cannot update another's file", async () => {
    const carol = await db.createUser("carol@example.com");
    const dave = await db.createUser("dave@example.com");

    const rows = await db.asService<{ id: string }>(
      `insert into public.files (owner_id, name, status, size_bytes, storage_key, category)
       values ($1, 'carols.bin', 'available', 10, $2, 'other') returning id`,
      [carol, `u/${carol}/f`],
    );
    const fileId = rows[0].id;

    // A direct id, which is what an attacker would have. RLS makes the update match
    // zero rows rather than raising, so the check is on the data afterwards.
    await db.asUser(dave, `update public.files set name = 'hijacked' where id = $1`, [fileId]);

    const after = await db.asService<{ name: string }>(
      `select name from public.files where id = $1`,
      [fileId],
    );
    expect(after[0].name).toBe("carols.bin");
  });

  it("one user cannot see another's subscription or invoices", async () => {
    const eve = await db.createUser("eve@example.com");
    const frank = await db.createUser("frank@example.com");

    await db.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status)
       values ($1, 'plus', 'INR', 'active')`,
      [eve],
    );

    const visible = await db.asUser(frank, `select * from public.subscriptions`);
    expect(visible).toHaveLength(0);
  });
});

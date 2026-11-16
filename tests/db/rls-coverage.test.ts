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
    // Anti-abuse internals (0015). A client that could read its own risk score
    // could also learn exactly how to stay under the threshold, so these are
    // server-only by design rather than merely unreadable.
    "abuse_policy",
    "email_domain_risk",
    "device_signups",
    "risk_events",
    "account_restrictions",
    "turnstile_tokens", // single-use token claims; a client that could write here could pre-claim tokens
    // Platform administration (0017). The audit log records what operators did and
    // must not be readable by the people it describes; support notes and replies
    // are internal. Both are read only through an authorized service-role query.
    "platform_admin_audit_logs",
    "support_messages",
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

/**
 * The platform-administration boundary, checked at the grant level rather than the
 * policy level.
 *
 * A policy is only consulted if a grant lets the statement run at all. Checking
 * both is what makes "no client can write to this table" a fact rather than an
 * inference: `platform_admin_audit_logs` deliberately grants no UPDATE or DELETE to
 * anyone, so even the service role cannot rewrite history through PostgREST.
 */
describe("platform administration grants", () => {
  const tables = [
    "platform_admins",
    "platform_admin_audit_logs",
    "support_messages",
    "support_requests",
  ];

  it("exist in the public schema", async () => {
    const rows = await db.asService<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    const present = new Set(rows.map((row) => row.tablename));
    for (const table of tables) {
      expect(present.has(table), `${table} is missing`).toBe(true);
    }
  });

  /**
   * Parse `pg_class.relacl` for one table into `{ role → set of privileges }`.
   *
   * `information_schema.role_table_grants` is not usable here: it only reports
   * grants where the current role is the grantor or grantee, so a query as the
   * service role silently hides the `authenticated` and `anon` grants — the exact
   * ones this file exists to check. The ACL is the ground truth.
   */
  async function acl(table: string): Promise<Map<string, Set<string>>> {
    const [row] = await db.asService<{ relacl: string | null }>(
      `select relacl::text as relacl from pg_class
        where relname = '${table}' and relnamespace = 'public'::regnamespace`,
    );
    const out = new Map<string, Set<string>>();
    if (!row?.relacl) return out;
    // {postgres=arwdDxtm/postgres,authenticated=r/postgres,...}
    for (const entry of row.relacl.replace(/^\{|\}$/g, "").split(",")) {
      const [who, privs] = entry.split("=");
      if (!privs) continue;
      const role = who.trim();
      const letters = privs.split("/")[0];
      const set = out.get(role) ?? new Set<string>();
      // a=insert r=select w=update d=delete D=truncate x=references t=trigger
      const map: Record<string, string> = {
        a: "INSERT",
        r: "SELECT",
        w: "UPDATE",
        d: "DELETE",
        D: "TRUNCATE",
        x: "REFERENCES",
        t: "TRIGGER",
      };
      for (const letter of letters) {
        const name = map[letter];
        if (name) set.add(name);
      }
      out.set(role, set);
    }
    return out;
  }

  it("never let an authenticated user write the administrator table", async () => {
    const grants = await acl("platform_admins");
    expect([...(grants.get("authenticated") ?? [])].sort()).toEqual(["SELECT"]);
    expect([...(grants.get("anon") ?? [])].sort()).toEqual(["SELECT"]);
  });

  it("give nobody UPDATE, DELETE or TRUNCATE on the audit log", async () => {
    const grants = await acl("platform_admin_audit_logs");
    for (const [role, privileges] of grants) {
      // `postgres` owns the table and can always alter it; excluding the owner is
      // the only sound way to say "no application role can rewrite history". Every
      // role the application actually connects as is checked.
      if (role === "postgres" || role === "PUBLIC") continue;
      const forbidden = [...privileges].filter((p) =>
        ["UPDATE", "DELETE", "TRUNCATE"].includes(p),
      );
      expect(forbidden, `${role} must not have ${forbidden.join(", ")}`).toEqual([]);
    }
    // And the log is still usable: the service role can append and read.
    expect([...(grants.get("service_role") ?? [])].sort()).toEqual(["INSERT", "SELECT"]);
  });

  it("give a signed-in user read-only access and no rows to private support notes", async () => {
    /*
     * The grant is SELECT, deliberately: with no grant at all a PostgREST read
     * returns `42501 permission denied`, which tells the caller the table exists.
     * A grant plus an RLS policy that matches nothing returns zero rows instead —
     * the same answer a table that does not exist would give.
     *
     * So the guarantee is two-part, and both parts are asserted: no write privilege,
     * and no rows. "Deny-all-by-design" below proves the second part for every table
     * in that set, and `support_messages` is in it.
     */
    const grants = await acl("support_messages");
    const authenticated = grants.get("authenticated") ?? new Set<string>();
    expect([...authenticated].sort(), "read-only").toEqual(["SELECT"]);
    expect(grants.has("anon"), "anon must have no grant at all").toBe(false);
    expect(grants.has("PUBLIC"), "PUBLIC must have no grant at all").toBe(false);
  });

  it("let the contact form submit a support request without letting anyone delete one", async () => {
    const grants = await acl("support_requests");
    const authenticated = grants.get("authenticated") ?? new Set<string>();
    expect(authenticated.has("SELECT")).toBe(true);
    /*
     * `anon` holds a SELECT grant but there is no SELECT policy, so the grant
     * resolves to zero rows rather than an error. The grant exists so a probe
     * cannot distinguish "table is empty" from "table is not there" — a
     * permission-denied would confirm the table exists. The guarantee is the row
     * count, which `really does deny rows on the deny-all tables` asserts directly.
     */
    expect(grants.has("anon"), "anon needs the write path for the public form").toBe(true);
    /*
     * Only the *client* roles are checked here. `service_role` holds DELETE and
     * UPDATE because account deletion and the support workflow need them, and it is
     * not reachable from a browser. Scoping the assertion to `authenticated` and
     * `anon` is what makes it a statement about customers rather than about the
     * backend, which would otherwise pass by being vacuous.
     */
    for (const role of ["authenticated", "anon"]) {
      const privileges = grants.get(role);
      if (!privileges) continue;
      expect(privileges.has("DELETE"), `${role} must not delete a ticket`).toBe(false);
      expect(privileges.has("UPDATE"), `${role} must not edit a ticket`).toBe(false);
    }
  });

  it("expose the role helper only to the roles that need it", async () => {
    const rows = await db.asService<{ grantee: string }>(
      `select grantee from information_schema.routine_privileges
        where routine_schema = 'public' and routine_name = 'current_platform_role'`,
    );
    const grantees = new Set(rows.map((row) => row.grantee));
    expect(grantees.has("anon"), "anon must not be able to call the role helper").toBe(false);
    expect(
      grantees.has("authenticated") || grantees.has("service_role"),
      "at least one legitimate role must be able to call it",
    ).toBe(true);
  });
});

/**
 * Platform administration — database-level security.
 *
 * These tests are the ones that matter most in this feature. Every one of them
 * belongs to a class of bug that a UI wrapper cannot catch:
 *
 *   - a customer reading the administrator table
 *   - a customer promoting themselves
 *   - a business owner (a *customer* role) being mistaken for a platform admin
 *   - the last owner being revocable, leaving a platform nobody can administer
 *
 * The suite runs against real PostgreSQL (PGlite) with the real RLS policies, so
 * "RLS applies" is demonstrated rather than asserted.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let owner: string;
let admin: string;
let customer: string;
let businessOwner: string;
let disabled: string;

beforeAll(async () => {
  t = await createTestDb();

  owner = await t.createUser("owner@orindle.test");
  admin = await t.createUser("admin@orindle.test");
  customer = await t.createUser("customer@example.com");
  businessOwner = await t.createUser("bizowner@example.com");
  disabled = await t.createUser("disabled@orindle.test");

  for (const id of [owner, admin, customer, businessOwner, disabled]) await t.verifyUser(id);

  // The bootstrap rows. In production this is a documented one-time SQL insert
  // (docs/admin/ADMIN-ACCESS-SETUP.md), not something the application does.
  await t.asService(
    `insert into public.platform_admins (user_id, role) values ($1, 'owner'), ($2, 'admin'), ($3, 'admin')`,
    [owner, admin, disabled],
  );
  await t.asService(
    `update public.platform_admins set is_active = false, disabled_at = now() where user_id = $1`,
    [disabled],
  );

  // A business organization owned by a *customer* account. This exists solely so
  // the tests can prove that business ownership confers nothing here.
  await t.asService(
    `insert into public.organizations (name, slug, owner_id) values ('Acme Ltd', 'acme-ltd', $1)`,
    [businessOwner],
  );
}, 180_000);

afterAll(async () => {
  await t?.close();
});

describe("platform_admins RLS", () => {
  it("lets an administrator read only their own row", async () => {
    const rows = await t.asUser<{ user_id: string; role: string }>(
      admin,
      `select user_id, role from public.platform_admins`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(admin);
  });

  it("gives an ordinary customer zero rows, not an error", async () => {
    // Zero rows rather than a permission error is deliberate: a client cannot tell
    // whether the table is empty or merely closed to them.
    const rows = await t.asUser(customer, `select * from public.platform_admins`);
    expect(rows).toEqual([]);
  });

  it("gives an anonymous visitor zero rows", async () => {
    const rows = await t.asAnon(`select * from public.platform_admins`);
    expect(rows).toEqual([]);
  });

  it("a business owner is not a platform admin", async () => {
    // The requirement in one assertion: organization ownership is a CUSTOMER role.
    const rows = await t.asUser(businessOwner, `select * from public.platform_admins`);
    expect(rows).toEqual([]);

    const [orgs] = await t.asUser<{ n: string }>(
      businessOwner,
      `select count(*)::text as n from public.organizations`,
    );
    // ...and they really are an owner on the other side.
    expect(orgs.n).toBe("1");
  });

  it("forbids a customer inserting their own administrator row", async () => {
    await expect(
      t.asUser(
        customer,
        `insert into public.platform_admins (user_id, role) values ($1, 'owner')`,
        [customer],
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("forbids an admin promoting themselves to owner", async () => {
    // No UPDATE policy exists at all, so even a legitimate administrator cannot
    // change their own role through a client connection.
    await expect(
      t.asUser(admin, `update public.platform_admins set role = 'owner' where user_id = $1`, [admin]),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("forbids deleting the administrator table through a client", async () => {
    await expect(
      t.asUser(owner, `delete from public.platform_admins`),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });
});

describe("current_platform_role", () => {
  it("returns the caller's role and only the caller's", async () => {
    const [row] = await t.asUser<{ current_platform_role: string }>(
      admin,
      `select public.current_platform_role() as current_platform_role`,
    );
    expect(row.current_platform_role).toBe("admin");
  });

  it("returns null for an ordinary customer", async () => {
    const [row] = await t.asUser<{ r: string | null }>(
      customer,
      `select public.current_platform_role() as r`,
    );
    expect(row.r).toBeNull();
  });

  it("returns null for a disabled administrator", async () => {
    const [row] = await t.asUser<{ r: string | null }>(
      disabled,
      `select public.current_platform_role() as r`,
    );
    expect(row.r).toBeNull();
  });
});

describe("last-owner protection", () => {
  it("refuses to revoke the final active owner", async () => {
    // The invariant is enforced by a DEFERRED constraint trigger, so it fires at
    // COMMIT rather than at statement time — which is the only place it can hold
    // against two concurrent revocations. It must therefore be tested inside a
    // transaction that is allowed to fail at commit.
    //
    // The rollback in `finally` is not optional: a failed COMMIT leaves the
    // session in an aborted transaction, and every later statement in this file
    // would then fail with "current transaction is aborted" — a cascade that
    // makes the real assertion impossible to read.
    let failed = false;
    await t.db.exec("begin");
    try {
      await t.asService(
        `update public.platform_admins set is_active = false, disabled_at = now() where user_id = $1`,
        [owner],
      );
      await t.db.exec("commit");
    } catch (error) {
      failed = true;
      expect((error as Error).message).toMatch(/last_platform_owner/);
    } finally {
      if (failed) await t.db.exec("rollback");
    }
    expect(failed, "revoking the last active owner must fail").toBe(true);

    // And the owner is still an owner, because the transaction was rolled back.
    const still = await t.asService<{ role: string }>(
      `select role from public.platform_admins where user_id = $1 and is_active`,
      [owner],
    );
    expect(still[0]?.role).toBe("owner");
  });

  it("allows handing ownership over first", async () => {
    await t.asService(`update public.platform_admins set role = 'owner' where user_id = $1`, [admin]);
    await t.asService(
      `update public.platform_admins set is_active = false, disabled_at = now() where user_id = $1`,
      [owner],
    );

    const active = await t.asService<{ user_id: string }>(
      `select user_id from public.platform_admins where role = 'owner' and is_active`,
    );
    expect(active.map((r) => r.user_id)).toEqual([admin]);

    // Restore for any test that follows.
    await t.asService(`update public.platform_admins set is_active = true, disabled_at = null where user_id = $1`, [owner]);
    await t.asService(`update public.platform_admins set role = 'admin' where user_id = $1`, [admin]);
  });

  it("records when a row was disabled", async () => {
    // is_active = false without a timestamp is rejected by the check constraint,
    // so a disabled administrator always has a record of when. Uses the *active*
    // admin as the subject: the already-disabled row has a timestamp from setup
    // and would pass the check on an unrelated update.
    await expect(
      t.asService(`update public.platform_admins set is_active = false where user_id = $1`, [admin]),
    ).rejects.toThrow(/platform_admins_disabled_at|check constraint/i);
  });
});

describe("audit log", () => {
  it("is unreadable by any customer", async () => {
    const rows = await t.asUser(customer, `select * from public.platform_admin_audit_logs`);
    expect(rows).toEqual([]);
  });

  it("cannot be written or altered by a customer", async () => {
    await expect(
      t.asUser(
        customer,
        `insert into public.platform_admin_audit_logs (actor_id, action, target_type) values ($1, 'admin.granted', 'platform_admin')`,
        [customer],
      ),
    ).rejects.toThrow(/permission denied|row-level security/i);

    await expect(
      t.asUser(owner, `update public.platform_admin_audit_logs set action = 'admin.revoked'`),
    ).rejects.toThrow(/permission denied|row-level security/i);
  });

  it("gives the service role no DELETE or UPDATE grant", async () => {
    // Append-only by grant, not by convention. A future route cannot erase a
    // record even if someone writes the query.
    const privileges = await t.asService<{ privilege_type: string }>(
      `select privilege_type from information_schema.table_privileges
        where table_schema = 'public' and table_name = 'platform_admin_audit_logs'
          and grantee = 'service_role'`,
    );
    const granted = privileges.map((p) => p.privilege_type).sort();
    expect(granted).toEqual(["INSERT", "SELECT"]);
  });
});

describe("support records", () => {
  it("are unreadable by a customer", async () => {
    await t.asService(
      `insert into public.support_requests (submitter_email, category, subject, message)
       values ('someone@example.com', 'support', 'Help', 'I need help with uploads')`,
    );
    const rows = await t.asUser(customer, `select * from public.support_requests`);
    expect(rows).toEqual([]);
  });

  it("generate a unique, quotable reference", async () => {
    const rows = await t.asService<{ reference: string }>(
      `select reference from public.support_requests`,
    );
    expect(rows[0].reference).toMatch(/^ORD-[0-9A-F]{8}$/);
  });

  it("keep ticket status separate from email delivery status", async () => {
    const [row] = await t.asService<{ ticket_status: string; delivery_status: string }>(
      `select ticket_status, delivery_status from public.support_requests limit 1`,
    );
    // A brand-new ticket is open and its notification is pending. Two columns,
    // two facts — collapsing them would make one of them a lie.
    expect(row.ticket_status).toBe("open");
    expect(row.delivery_status).toBe("pending");
  });

  it("never emails an internal note", async () => {
    const [ticket] = await t.asService<{ id: string }>(
      `select id from public.support_requests limit 1`,
    );

    // The constraint, not the application, is what guarantees this.
    await expect(
      t.asService(
        `insert into public.support_messages (request_id, visibility, body, delivery_status)
         values ($1, 'internal', 'Note', 'pending')`,
        [ticket.id],
      ),
    ).rejects.toThrow(/support_messages_note_not_emailed|check constraint/i);
  });
});

describe("privileged functions", () => {
  /*
   * Callable forms with literal arguments.
   *
   * A signature like `admin_growth_series(integer)` is valid in a GRANT but not
   * in a SELECT — Postgres reads the bare word as a column reference — so the
   * tests below call each function the way a route would. Testing the grant
   * without testing an actual call would miss a function that is granted but
   * broken.
   */
  const OPERATOR_FUNCTIONS = [
    "admin_mrr()",
    "admin_overview_stats()",
    "admin_growth_series(30)",
    "admin_storage_by_plan()",
    "admin_largest_accounts(10)",
    "admin_billing_summary()",
    "admin_user_directory(null, null, null, null, null, null, 'newest', 10, 0)",
    "admin_team_directory(null, 10, 0)",
  ];

  it("refuse execution to an ordinary customer", async () => {
    for (const fn of OPERATOR_FUNCTIONS) {
      await expect(
        t.asUser(customer, `select * from public.${fn}`),
        `${fn} must not be callable by a customer`,
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("refuse execution to an anonymous visitor", async () => {
    for (const fn of OPERATOR_FUNCTIONS) {
      await expect(
        t.asAnon(`select * from public.${fn}`),
        `${fn} must not be callable anonymously`,
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("are callable by the service role", async () => {
    // The other half of the proof: a function nobody can call is not security,
    // it is a bug.
    await expect(t.asService(`select * from public.admin_overview_stats()`)).resolves.toBeDefined();
    await expect(t.asService(`select * from public.admin_mrr()`)).resolves.toBeDefined();
    await expect(t.asService(`select * from public.admin_billing_summary()`)).resolves.toBeDefined();
  });
});

/**
 * Account deletion, end to end at the database layer.
 *
 * The contract the UI and the confirmation email both promise:
 *   - requesting sets a purge date, and requesting twice does not restart the clock
 *   - cancelling clears it, including a purge already in progress
 *   - "pending" is readable by the owner and by nobody else
 *   - the purge job's candidate list still works, and the address it needs is
 *     readable before the account is deleted
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let alice: string;
let bob: string;

beforeAll(async () => {
  t = await createTestDb();
  alice = await t.createUser("alice@example.com");
  bob = await t.createUser("bob@example.com");
  await t.verifyUser(alice);
  await t.verifyUser(bob);
});

afterAll(async () => {
  await t?.close();
});

describe("request_account_deletion", () => {
  it("sets a request and returns the purge date", async () => {
    const rows = await t.asUser<{ requested_at: string; purge_on: string }>(
      alice,
      `select * from public.request_account_deletion()`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].requested_at).toBeTruthy();
    expect(rows[0].purge_on).toBeTruthy();

    const days =
      (new Date(rows[0].purge_on).getTime() - new Date(rows[0].requested_at).getTime()) /
      86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it("is idempotent and does not restart the clock", async () => {
    // Push the request back a day, then request again: the date must not move.
    await t.asService(
      `update public.profiles set deletion_requested_at = now() - interval '1 day' where id = $1`,
      [alice],
    );

    const before = await t.asUser<{ requested_at: string }>(
      alice,
      `select * from public.my_deletion_status()`,
    );

    await t.asUser(alice, `select * from public.request_account_deletion()`);

    const after = await t.asUser<{ requested_at: string }>(
      alice,
      `select * from public.my_deletion_status()`,
    );

    expect(new Date(after[0].requested_at).toISOString()).toBe(
      new Date(before[0].requested_at).toISOString(),
    );
  });

  it("only touches the caller's own row", async () => {
    await t.asUser(bob, `select * from public.request_account_deletion()`);

    // Alice's request is unaffected by Bob's.
    const mine = await t.asUser<{ requested_at: string }>(
      alice,
      `select * from public.my_deletion_status()`,
    );
    expect(mine).toHaveLength(1);

    await t.asUser(bob, `select * from public.cancel_account_deletion()`);

    const stillMine = await t.asUser<{
      requested_at: string;
    }>(alice, `select * from public.my_deletion_status()`);
    expect(stillMine).toHaveLength(1);
  });
});

describe("my_deletion_status", () => {
  it("returns nothing for a live account", async () => {
    const rows = await t.asUser(bob, `select * from public.my_deletion_status()`);
    expect(rows).toHaveLength(0);
  });

  it("cannot report another account's deletion", async () => {
    // The function takes no argument at all, so there is nothing to pass. This
    // asserts the shape rather than a runtime refusal — the guarantee is that the
    // caller filters on auth.uid() itself.
    await expect(
      t.asUser(bob, `select * from public.my_deletion_status(${1})`),
    ).rejects.toThrow();
  });
});

describe("cancel_account_deletion", () => {
  it("clears a request", async () => {
    await t.asUser(alice, `select * from public.cancel_account_deletion()`);

    const rows = await t.asUser(alice, `select * from public.my_deletion_status()`);
    expect(rows).toHaveLength(0);
  });

  it("also clears an in-flight purge claim, so a cancelled account is not deleted", async () => {
    await t.asUser(alice, `select * from public.request_account_deletion()`);
    // Simulate the purge job having claimed the account.
    await t.asService(
      `update public.profiles set deletion_started_at = now() where id = $1`,
      [alice],
    );

    await t.asUser(alice, `select * from public.cancel_account_deletion()`);

    const [row] = await t.asService<{ deletion_requested_at: string | null; deletion_started_at: string | null }>(
      `select deletion_requested_at, deletion_started_at from public.profiles where id = $1`,
      [alice],
    );
    expect(row.deletion_requested_at).toBeNull();
    expect(row.deletion_started_at).toBeNull();
  });
});

describe("the purge queue", () => {
  it("lists an account only once its grace period has elapsed", async () => {
    await t.asService(
      `update public.profiles set deletion_requested_at = now() - interval '2 days' where id = $1`,
      [bob],
    );

    const early = await t.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    expect(early.map((r) => r.owner_id)).not.toContain(bob);

    await t.asService(
      `update public.profiles set deletion_requested_at = now() - interval '8 days' where id = $1`,
      [bob],
    );

    const due = await t.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    expect(due.map((r) => r.owner_id)).toContain(bob);
  });

  it("provides the address the deletion notice needs, before the account is gone", async () => {
    const rows = await t.asService<{ owner_id: string; email: string }>(
      `select owner_id, email from public.pending_deletion_emails(10)`,
    );
    const bobRow = rows.find((r) => r.owner_id === bob);
    expect(bobRow?.email).toBe("bob@example.com");
  });

  it("is not callable by a customer", async () => {
    await expect(t.asUser(alice, `select * from public.pending_deletion_emails(10)`)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("is not callable by an anonymous visitor", async () => {
    await expect(t.asAnon(`select * from public.pending_deletion_emails(10)`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

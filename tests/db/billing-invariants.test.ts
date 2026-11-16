/**
 * Downgrade and expiry behaviour.
 *
 * The requirement is specific: a lapsed or downgraded subscription reduces the
 * allowance and keeps every file. These tests exercise that against the real schema
 * so the guarantee is a property of the database, not of a code review.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;
let owner: string;

beforeAll(async () => {
  db = await createTestDb();
  owner = await db.createUser("billing@example.com");
  // Verified, because an unverified account has no allowance at all (0014).
  await db.verifyUser(owner);
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function seedFiles(userId: string, count: number, bytes: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    await db.asService(
      `insert into public.files (owner_id, name, status, size_bytes, storage_key, category)
       values ($1, $2, 'available', $3, $4, 'other')`,
      // storage_key is unique, so it has to include the owner: two users with
      // "file-0" would otherwise collide.
      [userId, `file-${i}.bin`, bytes, `u/${userId}/file-${i}`],
    );
  }
}

describe("scheduled downgrade", () => {
  it("requires both the plan and the effective date", async () => {
    // A dangling plan id would silently do nothing at sweep time.
    await expect(
      db.asService(
        `insert into public.subscriptions (owner_id, plan_id, currency, status, pending_plan_id)
         values ($1, 'plus', 'INR', 'active', 'free')`,
        [owner],
      ),
    ).rejects.toThrow();

    await expect(
      db.asService(
        `insert into public.subscriptions (owner_id, plan_id, currency, status, pending_plan_effective_at)
         values ($1, 'plus', 'INR', 'active', now() + interval '1 day')`,
        [owner],
      ),
    ).rejects.toThrow();
  });

  it("accepts a complete pair", async () => {
    const rows = await db.asService<{ id: string }>(
      `insert into public.subscriptions
         (owner_id, plan_id, currency, status, pending_plan_id, pending_plan_effective_at)
       values ($1, 'plus', 'INR', 'active', 'free', now() + interval '30 days')
       returning id`,
      [owner],
    );
    expect(rows[0].id).toBeTruthy();
  });
});

describe("the allowance shrinks without touching files", () => {
  it("applying a downgrade leaves every file row intact", async () => {
    const user = await db.createUser("downgrade@example.com");
    await db.verifyUser(user);
    await seedFiles(user, 3, 4_000_000_000);

    const before = await db.asService<{ count: string }>(
      `select count(*)::text as count from public.files where owner_id = $1`,
      [user],
    );

    await db.asService(
      `insert into public.subscriptions
         (owner_id, plan_id, currency, status, pending_plan_id, pending_plan_effective_at)
       values ($1, 'premium', 'INR', 'active', 'free', now())`,
      [user],
    );

    // What the sweep does: move plan_id and clear the pending pair.
    await db.asService(
      `update public.subscriptions
         set plan_id = pending_plan_id,
             pending_plan_id = null,
             pending_plan_effective_at = null
       where owner_id = $1 and status = 'active' and pending_plan_id is not null`,
      [user],
    );

    const after = await db.asService<{ count: string }>(
      `select count(*)::text as count from public.files where owner_id = $1`,
      [user],
    );

    // This is the whole requirement, asserted: the plan got smaller, the files did not.
    expect(after[0].count).toBe(before[0].count);
    expect(Number(after[0].count)).toBe(3);
  });

  it("blocks new uploads once over the smaller allowance, without deleting anything", async () => {
    const user = await db.createUser("overlimit@example.com");
    await db.verifyUser(user);

    // 12 GB committed, which is what the account would be left holding after a
    // downgrade to Free (10 GB). storage_usage is the materialised figure the quota
    // check reads, so the file rows alone would not reproduce the situation.
    await seedFiles(user, 3, 4_000_000_000);
    await db.asService(
      `insert into public.storage_usage (owner_id, committed_bytes)
       values ($1, 12000000000)
       on conflict (owner_id) do update set committed_bytes = 12000000000`,
      [user],
    );

    // Reserve against a Free allowance: this is the check the upload pipeline makes.
    // It RAISES rather than returning null, so a caller cannot ignore the result and
    // get a reservation anyway. Signature is (owner, bytes, upload_id).
    await expect(
      db.asService(
        `select public.reserve_storage($1, $2, gen_random_uuid())`,
        [user, 5_000_000_000],
      ),
    ).rejects.toThrow(/quota_exceeded/);

    const remaining = await db.asService<{ count: string }>(
      `select count(*)::text as count from public.files where owner_id = $1`,
      [user],
    );
    expect(Number(remaining[0].count)).toBe(3);
  });
});

describe("expiry", () => {
  it("moves to expired and records a recovery window, deleting nothing", async () => {
    const user = await db.createUser("expiry@example.com");
    await db.verifyUser(user);
    await seedFiles(user, 2, 1_000_000_000);

    await db.asService(
      `insert into public.subscriptions
         (owner_id, plan_id, currency, status, current_period_end)
       values ($1, 'basic', 'INR', 'active', now() - interval '1 day')`,
      [user],
    );

    // What the sweep does for a lapsed row.
    await db.asService(
      `update public.subscriptions
         set status = 'expired',
             expired_at = now(),
             recovery_ends_at = now() + interval '90 days'
       where owner_id = $1`,
      [user],
    );

    const sub = await db.asService<{ status: string; recovery_ends_at: string | null }>(
      `select status, recovery_ends_at from public.subscriptions where owner_id = $1`,
      [user],
    );
    expect(sub[0].status).toBe("expired");
    expect(sub[0].recovery_ends_at).toBeTruthy();

    // Nothing was deleted, and the files are still marked available — not merely
    // present but unreachable.
    const files = await db.asService<{ status: string }>(
      `select status from public.files where owner_id = $1`,
      [user],
    );
    expect(files).toHaveLength(2);
    expect(files.every((row) => row.status === "available")).toBe(true);
  });
});

describe("account deletion", () => {
  it("a request marks the profile and removes nothing", async () => {
    const user = await db.createUser("delete-me@example.com");
    await db.verifyUser(user);
    await db.asService(
      `insert into public.files (owner_id, name, status, size_bytes, storage_key, category)
       values ($1, 'keep.bin', 'available', 1000, $2, 'other')`,
      [user, `u/${user}/keep.bin`],
    );

    await db.asService(
      `update public.profiles set deletion_requested_at = now() where id = $1`,
      [user],
    );

    const files = await db.asService<{ count: string }>(
      `select count(*)::text as count from public.files where owner_id = $1`,
      [user],
    );
    // Nothing removed at request time. This is the whole point of the grace period.
    expect(Number(files[0].count)).toBe(1);
  });

  it("is not due until the grace period has elapsed", async () => {
    const user = await db.createUser("recent-request@example.com");
    await db.verifyUser(user);
    await db.asService(
      `update public.profiles set deletion_requested_at = now() - interval '1 day' where id = $1`,
      [user],
    );

    const due = await db.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    expect(due.map((row) => row.owner_id)).not.toContain(user);
  });

  it("is due after the grace period", async () => {
    const user = await db.createUser("old-request@example.com");
    await db.verifyUser(user);
    await db.asService(
      `update public.profiles set deletion_requested_at = now() - interval '8 days' where id = $1`,
      [user],
    );

    const due = await db.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    expect(due.map((row) => row.owner_id)).toContain(user);
  });

  it("is cancellable by clearing the timestamp, and disappears from the queue", async () => {
    const user = await db.createUser("cancel-request@example.com");
    await db.verifyUser(user);
    await db.asService(
      `update public.profiles set deletion_requested_at = now() - interval '30 days' where id = $1`,
      [user],
    );
    await db.asService(`update public.profiles set deletion_requested_at = null where id = $1`, [
      user,
    ]);

    const due = await db.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    expect(due.map((row) => row.owner_id)).not.toContain(user);
  });

  it("is not once the purge has started, so a retry is not double-counted", async () => {
    const user = await db.createUser("purging@example.com");
    await db.verifyUser(user);
    await db.asService(
      `update public.profiles
         set deletion_requested_at = now() - interval '10 days',
             deletion_started_at = now()
       where id = $1`,
      [user],
    );

    const due = await db.asService<{ owner_id: string }>(
      `select * from public.pending_account_deletions(7)`,
    );
    // A claimed account is skipped: the job that claimed it owns the work.
    expect(due.map((row) => row.owner_id)).not.toContain(user);
  });
});

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let h: TestDb;

beforeAll(async () => {
  // The harness applies every migration in order, so 0010 is already in place.
  h = await createTestDb();
}, 120_000);

afterAll(async () => {
  await h?.close();
});

describe("check_rate_limit", () => {
  it("allows requests up to the limit and reports what is left", async () => {
    const rows = await h.asService<{ allowed: boolean; used: number; remaining: number }>(
      `select * from public.check_rate_limit('t1', 3, 60)`,
    );
    expect(rows[0].allowed).toBe(true);
    expect(rows[0].used).toBe(1);
    expect(rows[0].remaining).toBe(2);
  });

  it("refuses the request that exceeds the limit", async () => {
    for (let i = 0; i < 3; i += 1) {
      await h.asService(`select * from public.check_rate_limit('t2', 3, 60)`);
    }
    const rows = await h.asService<{ allowed: boolean; used: number; remaining: number }>(
      `select * from public.check_rate_limit('t2', 3, 60)`,
    );
    // The increment still happens: the request is counted and refused, so a
    // caller that keeps hammering does not get a free retry.
    expect(rows[0].allowed).toBe(false);
    expect(rows[0].used).toBe(4);
    expect(rows[0].remaining).toBe(0);
  });

  it("keeps buckets independent", async () => {
    for (let i = 0; i < 3; i += 1) {
      await h.asService(`select * from public.check_rate_limit('bucket-a', 3, 60)`);
    }
    const rows = await h.asService<{ allowed: boolean; used: number }>(
      `select * from public.check_rate_limit('bucket-b', 3, 60)`,
    );
    expect(rows[0].allowed).toBe(true);
    expect(rows[0].used).toBe(1);
  });

  it("returns a reset time in the future and inside the window", async () => {
    const rows = await h.asService<{ reset_at: string }>(
      `select * from public.check_rate_limit('reset-check', 5, 60)`,
    );
    const resetAt = new Date(rows[0].reset_at).getTime();
    expect(resetAt).toBeGreaterThan(Date.now());
    expect(resetAt).toBeLessThanOrEqual(Date.now() + 61_000);
  });

  it("rejects a nonsensical limit rather than allowing everything", async () => {
    await expect(
      h.asService(`select * from public.check_rate_limit('bad', 0, 60)`),
    ).rejects.toThrow();
    await expect(
      h.asService(`select * from public.check_rate_limit('bad', 5, 0)`),
    ).rejects.toThrow();
  });

  it("is not executable by an anonymous user", async () => {
    // A client that could call this directly could reset its own counters.
    await expect(
      h.asAnon(`select * from public.check_rate_limit('anon-attempt', 1, 60)`),
    ).rejects.toThrow();
  });

  it("is not executable by a signed-in user either", async () => {
    const userId = await h.createUser("rl@example.com");
    await expect(
      h.asUser(userId, `select * from public.check_rate_limit('user-attempt', 1, 60)`),
    ).rejects.toThrow();
  });
});

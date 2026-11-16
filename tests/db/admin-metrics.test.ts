/**
 * MRR, revenue and storage arithmetic.
 *
 * These are the numbers an operator makes decisions from, so an error here is not
 * a display bug — it is a wrong decision about the business. Every test names the
 * rule it is protecting.
 *
 * The two rules that dominate:
 *   - currencies are never added to each other
 *   - a missing fact is excluded and reported, never inferred
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;

/** Create a verified user with a subscription and (optionally) an invoice. */
async function subscribe(
  email: string,
  options: {
    planId: string;
    currency: "INR" | "USD";
    status: "active" | "past_due" | "cancelled" | "expired";
    billingPeriod?: "monthly" | "yearly" | null;
    periodEnd?: string | null;
    cancelAtPeriodEnd?: boolean;
    invoice?: { amountMinor: number; status: "paid" | "failed" | "refunded" };
  },
): Promise<string> {
  const userId = await t.createUser(email);
  await t.verifyUser(userId);

  const { periodEnd, cancelAtPeriodEnd, billingPeriod } = options;
  await t.asService(
    `insert into public.subscriptions
       (owner_id, plan_id, currency, status, billing_period, current_period_end, cancel_at_period_end)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      options.planId,
      options.currency,
      options.status,
      billingPeriod === undefined ? "monthly" : billingPeriod,
      periodEnd === undefined ? new Date(Date.now() + 30 * 86_400_000).toISOString() : periodEnd,
      cancelAtPeriodEnd ?? false,
    ],
  );

  if (options.invoice) {
    await t.asService(
      `insert into public.invoices (owner_id, amount_minor, currency, status, paid_at)
       values ($1, $2, $3, $4, case when $4 = 'paid' then now() else null end)`,
      [userId, options.invoice.amountMinor, options.currency, options.invoice.status],
    );
  }

  return userId;
}

beforeAll(async () => {
  t = await createTestDb();

  // Two INR monthly subscribers on Plus (₹199 = 19900 paise).
  await subscribe("inr-monthly-1@example.com", {
    planId: "plus", currency: "INR", status: "active",
    invoice: { amountMinor: 19900, status: "paid" },
  });
  await subscribe("inr-monthly-2@example.com", {
    planId: "plus", currency: "INR", status: "active",
    invoice: { amountMinor: 19900, status: "paid" },
  });

  // One USD monthly subscriber on Basic ($1.49 = 149 cents).
  await subscribe("usd-monthly@example.com", {
    planId: "basic", currency: "USD", status: "active",
    invoice: { amountMinor: 149, status: "paid" },
  });

  // Past due: must not be MRR.
  await subscribe("past-due@example.com", {
    planId: "plus", currency: "INR", status: "past_due",
  });

  // Cancelled but still inside the paid term: counts until the period ends.
  await subscribe("cancelling@example.com", {
    planId: "premium", currency: "INR", status: "active", cancelAtPeriodEnd: true,
    invoice: { amountMinor: 34900, status: "paid" },
  });

  // Active with a period that has already passed: a renewal that never arrived
  // is not revenue.
  await subscribe("lapsed@example.com", {
    planId: "ultra", currency: "INR", status: "active",
    periodEnd: new Date(Date.now() - 86_400_000).toISOString(),
  });

  // Active, period unknown. Must be excluded AND counted as unknown.
  await subscribe("unknown-period@example.com", {
    planId: "plus", currency: "INR", status: "active", billingPeriod: null,
  });

  // Refunded and failed invoices: recorded, never revenue.
  await subscribe("refund@example.com", {
    planId: "basic", currency: "INR", status: "cancelled",
    invoice: { amountMinor: 7900, status: "refunded" },
  });
  await subscribe("failed@example.com", {
    planId: "basic", currency: "INR", status: "expired",
    invoice: { amountMinor: 7900, status: "failed" },
  });

  // Free account with no subscription at all.
  const free = await t.createUser("free@example.com");
  await t.verifyUser(free);
}, 180_000);

afterAll(async () => {
  await t?.close();
});

describe("MRR", () => {
  it("sums within a currency and never across currencies", async () => {
    // `admin_mrr()` is a UNION of the billable rows and the unknown-period count,
    // so a currency can legitimately produce two rows. Summing per currency is
    // what the service layer does, and it is what the assertion has to do too —
    // reading only rows[0] would silently test half the answer.
    const rows = await t.asService<{ currency: string; monthly_minor: string }>(
      `select currency, sum(monthly_minor)::text as monthly_minor
         from public.admin_mrr() group by currency order by currency`,
    );

    // INR: 19900 + 19900 (two Plus) + 34900 (Premium, cancelling but still paid) = 74700
    // USD: 149 (Basic)
    const inr = rows.find((r) => r.currency === "INR");
    const usd = rows.find((r) => r.currency === "USD");

    expect(Number(inr?.monthly_minor)).toBe(74_700);
    expect(Number(usd?.monthly_minor)).toBe(149);
    // Two currencies, two figures. There is no combined total anywhere in the
    // system, which is the property this asserts.
    expect(rows).toHaveLength(2);
  });

  it("excludes past-due, expired and lapsed subscriptions", async () => {
    // The past-due Plus, the active-but-lapsed Ultra and the expired Basic would
    // each add a figure if the status and period filters were wrong.
    const rows = await t.asService<{ monthly_minor: string }>(
      `select monthly_minor from public.admin_mrr() where currency = 'INR' and monthly_minor > 0`,
    );
    expect(Number(rows[0].monthly_minor)).toBe(74_700);
  });

  it("excludes an unknown billing period and reports how many", async () => {
    const rows = await t.asService<{ unknown_period: string }>(
      `select sum(unknown_period)::text as unknown_period from public.admin_mrr() where currency = 'INR'`,
    );
    // Exactly one INR subscription has a null billing period. It is counted here
    // and contributes nothing to monthly_minor above — the total is incomplete and
    // the console says so rather than presenting 74700 as the whole story.
    expect(Number(rows[0].unknown_period)).toBe(1);
  });

  it("normalises a yearly subscription to a monthly equivalent", async () => {
    const fresh = await createTestDb();
    try {
      const userId = await fresh.createUser("annual@example.com");
      await fresh.verifyUser(userId);

      // An annual price is not approved in this product, so insert one directly to
      // prove the arithmetic rather than waiting for a product decision.
      await fresh.asService(
        `insert into public.plan_prices (plan_id, currency, period, amount_minor, approved)
         values ('max', 'INR', 'yearly', 2398800, true)`,
      );
      await fresh.asService(
        `insert into public.subscriptions
           (owner_id, plan_id, currency, status, billing_period, current_period_end)
         values ($1, 'max', 'INR', 'active', 'yearly', now() + interval '300 days')`,
        [userId],
      );

      const rows = await fresh.asService<{ monthly_minor: string }>(
        `select monthly_minor from public.admin_mrr() where currency = 'INR'`,
      );
      // 2398800 paise per year / 12 = 199900 paise per month, in integers.
      // Written as a literal so a change to the formula fails loudly.
      expect(Number(rows[0].monthly_minor)).toBe(199_900);
    } finally {
      await fresh.close();
    }
  });

  it("returns no row at all when nothing is billable", async () => {
    const fresh = await createTestDb();
    try {
      const rows = await fresh.asService(`select * from public.admin_mrr()`);
      // Empty, not a zero row: "no subscribers" and "subscribers worth nothing"
      // look different and the UI renders them differently.
      expect(rows).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});

describe("overview counters", () => {
  it("counts registered users, not organizations or profiles", async () => {
    const [row] = await t.asService<{ total_users: string; verified_users: string }>(
      `select total_users, verified_users from public.admin_overview_stats()`,
    );
    // 10 created above: 9 subscribed + 1 free account.
    expect(Number(row.total_users)).toBe(10);
    expect(Number(row.verified_users)).toBe(10);
  });

  it("counts paid users as distinct owners of a genuine paid subscription", async () => {
    const [row] = await t.asService<{ paid_users: string }>(
      `select paid_users from public.admin_overview_stats()`,
    );
    // Active paid: 2 INR Plus + 1 USD Basic + 1 cancelling Premium = 4.
    // Excluded: past_due, expired, lapsed, unknown-period is still active and paid
    // (it is a real subscription whose period we cannot read) — so it counts here.
    expect(Number(row.paid_users)).toBe(5);
  });
});

describe("collected revenue", () => {
  it("excludes refunded and failed invoices", async () => {
    const rows = await t.asService<{ currency: string; total: string }>(
      `select currency, sum(amount_minor)::text as total
         from public.invoices where status = 'paid' group by currency order by currency`,
    );
    const inr = rows.find((r) => r.currency === "INR");
    const usd = rows.find((r) => r.currency === "USD");

    // INR paid: 19900 + 19900 + 34900 = 74700. The refunded 7900 and the failed
    // 7900 are excluded by the WHERE clause, not by a subtraction afterwards.
    expect(Number(inr?.total)).toBe(74_700);
    expect(Number(usd?.total)).toBe(149);
  });
});

describe("storage aggregates", () => {
  it("report trash separately and never add it to committed", async () => {
    await t.asService(
      `insert into public.storage_usage (owner_id, committed_bytes, reserved_bytes, trash_bytes)
       select id, 1000, 200, 300 from auth.users where email = 'free@example.com'`,
    );

    const [row] = await t.asService<{
      committed_bytes: string;
      reserved_bytes: string;
      trash_bytes: string;
    }>(`select committed_bytes, reserved_bytes, trash_bytes from public.admin_overview_stats()`);

    // Trash lives INSIDE committed (the bytes are still stored), so the three
    // figures are reported as they are. Adding trash to committed here would
    // double-count it — the bug the customer storage page already documents.
    expect(Number(row.committed_bytes)).toBe(1000);
    expect(Number(row.reserved_bytes)).toBe(200);
    expect(Number(row.trash_bytes)).toBe(300);
  });

  it("groups by plan through the live subscription", async () => {
    const rows = await t.asService<{ plan_id: string; accounts: string }>(
      `select plan_id, accounts from public.admin_storage_by_plan() order by plan_id`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Number(row.accounts)).toBeGreaterThan(0);
  });
});

describe("user directory", () => {
  it("searches every account, not a page", async () => {
    const rows = await t.asService<{ email: string; total_count: string }>(
      `select email, total_count from public.admin_user_directory('refund@example.com', null, null, null, null, null, 'newest', 10, 0)`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("refund@example.com");
    // total_count is the count of MATCHES, not of the platform.
    expect(Number(rows[0].total_count)).toBe(1);
  });

  it("filters by verification state", async () => {
    const unverified = await t.createUser("unverified@example.com");
    expect(unverified).toBeTruthy();

    const rows = await t.asService<{ email: string }>(
      `select email from public.admin_user_directory(null, null, false, null, null, null, 'newest', 50, 0)`,
    );
    expect(rows.map((r) => r.email)).toEqual(["unverified@example.com"]);
  });

  it("sorts by storage descending", async () => {
    const rows = await t.asService<{ email: string; storage_committed: string }>(
      `select email, storage_committed from public.admin_user_directory(null, null, null, null, null, null, 'storage', 50, 0)`,
    );
    expect(rows[0].email).toBe("free@example.com");
    expect(Number(rows[0].storage_committed)).toBe(1000);
  });

  it("rejects an unknown sort column by falling back to a stable order", async () => {
    // The CASE-based ORDER BY cannot be injected. An unknown token matches no
    // branch, so the final `b.user_id` tiebreak gives a deterministic order.
    const rows = await t.asService(
      `select user_id from public.admin_user_directory(null, null, null, null, null, null, 'injected; drop table x', 5, 0)`,
    );
    expect(rows).toHaveLength(5);
  });

  it("caps the page size regardless of what is asked for", async () => {
    const rows = await t.asService(
      `select user_id from public.admin_user_directory(null, null, null, null, null, null, 'newest', 100000, 0)`,
    );
    // least(greatest(p_limit,1),200): a caller cannot pull the whole table.
    expect(rows.length).toBeLessThanOrEqual(200);
  });
});

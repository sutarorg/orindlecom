/**
 * The Dodo billing data model.
 *
 * These tests run against the real schema, so the guarantees they assert are
 * properties of the database rather than of a code review:
 *
 *   - Provider-scoped uniqueness: two providers can mint the same external id
 *     without colliding, but one provider still cannot write it twice.
 *   - Legacy Razorpay rows stay readable and stay Razorpay rows.
 *   - A renewal is applied exactly once, with the provider's authoritative
 *     dates, and a replayed renewal does not extend the period twice.
 *   - The new billing tables are not readable by an ordinary authenticated
 *     user, and one customer cannot read another's checkout record.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

/**
 * A fresh account per scenario.
 *
 * The "one live subscription per owner" index is a global invariant on the
 * table, so scenarios that each need a live subscription have to use
 * different accounts or they would collide with each other.
 */
async function freshUser(label: string): Promise<string> {
  const id = await db.createUser(`${label}-${Math.random().toString(36).slice(2)}@example.com`);
  await db.verifyUser(id);
  return id;
}

afterAll(async () => {
  await db?.close();
});

describe("provider-scoped uniqueness", () => {
  it("backfills every existing subscription and invoice to razorpay", async () => {
    const rows = await db.asService<{ provider: string; count: string }>(
      `select billing_provider as provider, count(*)::text as count
         from public.subscriptions group by 1`,
    );
    for (const row of rows) {
      expect(row.provider).toBe("razorpay");
    }

    const invoices = await db.asService<{ provider: string }>(
      `select distinct billing_provider as provider from public.invoices`,
    );
    for (const row of invoices) {
      expect(row.provider).toBe("razorpay");
    }
  });

  it("lets two providers hold the same external id", async () => {
    // "sub_1" is not globally unique across two providers. A global unique
    // index would reject a legitimate Dodo row.
    const sharedOwner = await freshUser("shared-a");
    const sharedOther = await freshUser("shared-b");

    await db.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, provider_subscription_id, billing_provider)
       values ($1, 'plus', 'USD', 'active', 'sub_shared', 'razorpay')`,
      [sharedOwner],
    );
    await db.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, provider_subscription_id, billing_provider)
       values ($1, 'premium', 'USD', 'active', 'sub_shared', 'dodo')`,
      [sharedOther],
    );

    const rows = await db.asService<{ billing_provider: string }>(
      `select billing_provider from public.subscriptions where provider_subscription_id = 'sub_shared' order by billing_provider`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.billing_provider).sort()).toEqual(["dodo", "razorpay"]);
  });

  it("refuses the same external id twice under the same provider", async () => {
    // The property that actually matters: a duplicate delivery produces one
    // row, not two.
    const first = await freshUser("dup-first");
    const second = await freshUser("dup-second");

    await expect(
      db.asService(
        `insert into public.subscriptions (owner_id, plan_id, currency, status, provider_subscription_id, billing_provider)
         values ($1, 'plus', 'USD', 'active', 'sub_dup', 'dodo')`,
        [first],
      ),
    ).resolves.toBeDefined();

    await expect(
      db.asService(
        `insert into public.subscriptions (owner_id, plan_id, currency, status, provider_subscription_id, billing_provider)
         values ($1, 'plus', 'USD', 'active', 'sub_dup', 'dodo')`,
        [second],
      ),
    ).rejects.toThrow();
  });

  it("applies the same rule to invoices", async () => {
    const invoiceOwner = await freshUser("invoice-owner");
    const invoiceOther = await freshUser("invoice-other");

    await db.asService(
      `insert into public.invoices (owner_id, provider_payment_id, billing_provider, amount_minor, currency, status)
       values ($1, 'pay_shared', 'razorpay', 100, 'USD', 'paid')`,
      [invoiceOwner],
    );
    await db.asService(
      `insert into public.invoices (owner_id, provider_payment_id, billing_provider, amount_minor, currency, status)
       values ($1, 'pay_shared', 'dodo', 100, 'USD', 'paid')`,
      [invoiceOther],
    );

    await expect(
      db.asService(
        `insert into public.invoices (owner_id, provider_payment_id, billing_provider, amount_minor, currency, status)
         values ($1, 'pay_shared', 'dodo', 100, 'USD', 'paid')`,
        [invoiceOwner],
      ),
    ).rejects.toThrow();
  });

  it("still allows only one live subscription per owner", async () => {
    // The original invariant is untouched by the provider split.
    const single = await freshUser("single-live");
    await db.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_provider)
       values ($1, 'basic', 'USD', 'active', 'dodo')`,
      [single],
    );

    await expect(
      db.asService(
        `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_provider)
         values ($1, 'plus', 'USD', 'active', 'dodo')`,
        [single],
      ),
    ).rejects.toThrow();
  });
});

describe("historical Razorpay records", () => {
  it("remain readable and keep their provider ids", async () => {
    const legacyOwner = await freshUser("legacy");
    await db.asService(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, provider_subscription_id, billing_provider, current_period_end)
       values ($1, 'plus', 'INR', 'active', 'sub_legacy_1', 'razorpay', now() + interval '20 days')`,
      [legacyOwner],
    );
    await db.asService(
      `insert into public.invoices (owner_id, provider_payment_id, billing_provider, amount_minor, currency, status, paid_at)
       values ($1, 'pay_legacy_1', 'razorpay', 54900, 'INR', 'paid', now())`,
      [legacyOwner],
    );

    const subs = await db.asService<{ billing_provider: string; provider_subscription_id: string }>(
      `select billing_provider, provider_subscription_id from public.subscriptions where provider_subscription_id = 'sub_legacy_1'`,
    );
    expect(subs).toHaveLength(1);
    expect(subs[0].billing_provider).toBe("razorpay");

    const invoices = await db.asService<{ billing_provider: string; amount_minor: string }>(
      `select billing_provider, amount_minor from public.invoices where provider_payment_id = 'pay_legacy_1'`,
    );
    expect(invoices).toHaveLength(1);
    expect(invoices[0].billing_provider).toBe("razorpay");
    expect(Number(invoices[0].amount_minor)).toBe(54900);
  });
});

describe("applying a renewal", () => {
  it("records the invoice and advances the period in one transaction", async () => {
    const renewalOwner = await freshUser("renewal");
    const sub = await db.asService<{ id: string }>(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_period, billing_provider, current_period_end)
       values ($1, 'premium', 'USD', 'active', 'monthly', 'dodo', now() + interval '10 days')
       returning id`,
      [renewalOwner],
    );

    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();

    const inserted = await db.asService<{ apply_renewal: boolean }>(
      `select public.apply_renewal(
         $1, $2, 'dodo', 'sub_renew_1', 'pay_renew_1', 1199, 'USD',
         now(), $3, 'monthly', null
       ) as apply_renewal`,
      [renewalOwner, sub[0].id, periodEnd],
    );
    expect(inserted[0].apply_renewal).toBe(true);

    const invoices = await db.asService<{ amount_minor: string; currency: string }>(
      `select amount_minor, currency from public.invoices where provider_payment_id = 'pay_renew_1'`,
    );
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0].amount_minor)).toBe(1199);
    expect(invoices[0].currency).toBe("USD");

    const updated = await db.asService<{ current_period_end: string }>(
      `select current_period_end from public.subscriptions where id = $1`,
      [sub[0].id],
    );
    // The provider's date, verbatim — not 30 days added to a local date.
    expect(new Date(updated[0].current_period_end).getTime()).toBe(
      new Date(periodEnd).getTime(),
    );
  });

  it("does not extend the period twice when a renewal is replayed", async () => {
    const replayOwner = await freshUser("replay");
    const sub = await db.asService<{ id: string }>(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_period, billing_provider, current_period_end)
       values ($1, 'ultra', 'USD', 'active', 'monthly', 'dodo', now() + interval '5 days')
       returning id`,
      [replayOwner],
    );

    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();

    await db.asService(
      `select public.apply_renewal($1, $2, 'dodo', 'sub_renew_2', 'pay_renew_2', 2399, 'USD', now(), $3, 'monthly', null)`,
      [replayOwner, sub[0].id, periodEnd],
    );

    // The replay: same payment id, same dates.
    const replayed = await db.asService<{ apply_renewal: boolean }>(
      `select public.apply_renewal($1, $2, 'dodo', 'sub_renew_2', 'pay_renew_2', 2399, 'USD', now(), $3, 'monthly', null) as apply_renewal`,
      [replayOwner, sub[0].id, periodEnd],
    );
    // No new invoice.
    expect(replayed[0].apply_renewal).toBe(false);

    const invoices = await db.asService<{ count: string }>(
      `select count(*)::text as count from public.invoices where provider_payment_id = 'pay_renew_2'`,
    );
    expect(Number(invoices[0].count)).toBe(1);
  });

  it("keeps the subscription currency and billing period", async () => {
    const periodOwner = await freshUser("period");
    const sub = await db.asService<{ id: string }>(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_period, billing_provider)
       values ($1, 'max', 'GBP', 'active', 'yearly', 'dodo')
       returning id`,
      [periodOwner],
    );

    await db.asService(
      `select public.apply_renewal($1, $2, 'dodo', 'sub_renew_3', 'pay_renew_3', 43188, 'GBP', now(), now() + interval '365 days', 'yearly', null)`,
      [periodOwner, sub[0].id],
    );

    const rows = await db.asService<{ currency: string; billing_period: string }>(
      `select currency, billing_period from public.subscriptions where id = $1`,
      [sub[0].id],
    );
    expect(rows[0].currency).toBe("GBP");
    expect(rows[0].billing_period).toBe("yearly");
  });
});

describe("the scheduled plan change", () => {
  it("only applies when the provider has confirmed the plan", async () => {
    const planOwner = await freshUser("plan");
    const sub = await db.asService<{ id: string }>(
      `insert into public.subscriptions (owner_id, plan_id, currency, status, billing_period, billing_provider, pending_plan_id, pending_plan_effective_at)
       values ($1, 'premium', 'USD', 'active', 'monthly', 'dodo', 'free', now() + interval '30 days')
       returning id`,
      [planOwner],
    );

    // The wrong plan does not clear the pending change.
    const wrong = await db.asService<{ apply_scheduled_plan_change: boolean }>(
      `select public.apply_scheduled_plan_change($1, 'basic') as apply_scheduled_plan_change`,
      [sub[0].id],
    );
    expect(wrong[0].apply_scheduled_plan_change).toBe(false);

    const still = await db.asService<{ plan_id: string; pending_plan_id: string }>(
      `select plan_id, pending_plan_id from public.subscriptions where id = $1`,
      [sub[0].id],
    );
    expect(still[0].plan_id).toBe("premium");
    expect(still[0].pending_plan_id).toBe("free");

    // The confirmed plan applies and clears the pending pair.
    const applied = await db.asService<{ apply_scheduled_plan_change: boolean }>(
      `select public.apply_scheduled_plan_change($1, 'free') as apply_scheduled_plan_change`,
      [sub[0].id],
    );
    expect(applied[0].apply_scheduled_plan_change).toBe(true);

    const after = await db.asService<{ plan_id: string; pending_plan_id: string | null }>(
      `select plan_id, pending_plan_id from public.subscriptions where id = $1`,
      [sub[0].id],
    );
    expect(after[0].plan_id).toBe("free");
    expect(after[0].pending_plan_id).toBeNull();
  });
});

describe("the new billing tables", () => {
  it("are invisible to an ordinary authenticated user", async () => {
    // RLS is on and there is no policy, so the read returns nothing at all.
    const reader = await freshUser("reader");
    for (const table of [
      "billing_provider_prices",
      "billing_checkout_sessions",
      "billing_customers",
    ]) {
      const rows = await db
        .asUser(reader, `select * from public.${table} limit 1`)
        .catch((error: Error) => {
          expect(String(error.message)).toMatch(/permission denied/i);
          return [];
        });
      expect(rows, `${table} leaked a row to an authenticated user`).toEqual([]);
    }
  });

  it("keep one customer's checkout record away from another", async () => {
    const checkoutOwner = await freshUser("checkout");
    const checkoutOther = await freshUser("checkout-other");
    await db.asService(
      `insert into public.billing_checkout_sessions (reference, owner_id, plan_id, currency, period, amount_minor, product_id)
       values ('orindle_cs_owner', $1, 'basic', 'USD', 'monthly', 109, 'pdt_1')`,
      [checkoutOwner],
    );

    const rows = await db
      .asUser(checkoutOther, `select * from public.billing_checkout_sessions`)
      .catch((error: Error) => {
        expect(String(error.message)).toMatch(/permission denied/i);
        return [];
      });
    expect(rows).toEqual([]);
  });

  it("hold the approved price so a webhook can be reconciled against it", async () => {
    const rows = await db.asService<{ amount_minor: string; currency: string; period: string }>(
      `select amount_minor, currency, period from public.billing_checkout_sessions where reference = 'orindle_cs_owner'`,
    );
    expect(Number(rows[0].amount_minor)).toBe(109);
    expect(rows[0].currency).toBe("USD");
    expect(rows[0].period).toBe("monthly");
  });

  it("map a provider customer id to exactly one owner", async () => {
    const customerOwner = await freshUser("customer");
    const customerOther = await freshUser("customer-other");
    await db.asService(
      `insert into public.billing_customers (owner_id, provider, customer_id, email)
       values ($1, 'dodo', 'cus_1', 'a@example.com')`,
      [customerOwner],
    );

    // The same customer id cannot be attached to a second Orindle owner.
    await expect(
      db.asService(
        `insert into public.billing_customers (owner_id, provider, customer_id, email)
         values ($1, 'dodo', 'cus_1', 'b@example.com')`,
        [customerOther],
      ),
    ).rejects.toThrow();
  });

  it("refuse a mapping whose interval disagrees with its period", async () => {
    await expect(
      db.asService(
        `insert into public.billing_provider_prices (provider, environment, plan_id, currency, period, product_id, interval, amount_minor)
         values ('dodo', 'test_mode', 'basic', 'USD', 'monthly', 'pdt_x', 'Day', 109)`,
      ),
    ).rejects.toThrow();
  });

  it("refuse a mapping for an unknown plan", async () => {
    await expect(
      db.asService(
        `insert into public.billing_provider_prices (provider, environment, plan_id, currency, period, product_id, interval, amount_minor)
         values ('dodo', 'test_mode', 'platinum', 'USD', 'monthly', 'pdt_x', 'Month', 109)`,
      ),
    ).rejects.toThrow();
  });

  it("keep test and live mappings separate", async () => {
    await db.asService(
      `insert into public.billing_provider_prices (provider, environment, plan_id, currency, period, product_id, interval, amount_minor)
       values ('dodo', 'test_mode', 'basic', 'USD', 'monthly', 'pdt_test', 'Month', 109)`,
    );

    // The same plan/currency/period in the other environment is a different
    // row, with its own product id.
    await db.asService(
      `insert into public.billing_provider_prices (provider, environment, plan_id, currency, period, product_id, interval, amount_minor)
       values ('dodo', 'live_mode', 'basic', 'USD', 'monthly', 'pdt_live', 'Month', 109)`,
    );

    const rows = await db.asService<{ environment: string; product_id: string }>(
      `select environment, product_id from public.billing_provider_prices where plan_id = 'basic' and currency = 'USD' and period = 'monthly' order by environment`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.environment).sort()).toEqual(["live_mode", "test_mode"]);
  });
});

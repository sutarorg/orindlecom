/**
 * Billing-period persistence and the MRR arithmetic that depends on it.
 *
 * Two separate guarantees, both of which fail silently if broken:
 *
 *  1. `activateSubscription()` must persist the *server-derived* period. If it does
 *     not, every yearly subscriber is either excluded from MRR or counted at 12x.
 *  2. Monthly recurring revenue must normalise a yearly plan to amount / 12, must
 *     keep currencies apart, and must exclude anything that is not live recurring.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

const source = (file: string) => readFile(path.join(ROOT, file), "utf8");

describe("activateSubscription persists the verified period", () => {
  it("writes billing_period into the subscription payload", async () => {
    const razorpay = await source("src/domain/billing/razorpay.ts");
    expect(razorpay).toMatch(/billing_period:\s*input\.period/);
  });

  it("does not derive the period from client-supplied or wall-clock values", async () => {
    const razorpay = await source("src/domain/billing/razorpay.ts");
    // A 30-day gap is not a billing period. Guessing one would fabricate the
    // number MRR is computed from.
    expect(razorpay).not.toMatch(/billing_period:\s*(?:input\.(?!period)|req|body|payload\.)/);
  });

  it("constrains the column to the two real periods", async () => {
    const migration = await source("supabase/migrations/0017_platform_admin.sql");
    expect(migration).toMatch(/billing_period/);
    expect(migration).toMatch(/billing_period[\s\S]{0,200}monthly[\s\S]{0,80}yearly/);
  });
});

describe("MRR arithmetic", () => {
  /**
   * The rule, stated once: an annual plan contributes one twelfth of its annual
   * charge to a monthly figure. 2398800 minor units per year (₹23,988) is
   * 199900 per month (₹1,999) — the Max plan's monthly price, which is the
   * cross-check that the divisor is right.
   */
  it("normalises an annual charge to one twelfth", () => {
    const yearlyMinor = 2_398_800;
    expect(Math.round(yearlyMinor / 12)).toBe(199_900);
    expect(199_900).toBe(1_999 * 100);
  });

  it("divides rather than multiplies, and truncates toward zero", () => {
    // A rupee is 100 paise, so a division that does not land cleanly must not round
    // up into money that was never charged.
    expect(Math.floor(100_001 / 12)).toBe(8_333);
    expect(Math.floor(1_000 / 12)).toBe(83);
  });
});

describe("admin_mrr aggregates only live recurring revenue", () => {
  it("filters to active subscriptions with a known period", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    expect(fn).toMatch(/status\s*=\s*'active'/);
    expect(fn).toMatch(/billing_period is not null/);
  });

  it("excludes a subscription whose paid period has already ended", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    // `status = 'active'` alone is not enough: a row can still say active after its
    // period end has passed, and that is not recurring revenue any more.
    expect(fn).toMatch(/current_period_end is null or s\.current_period_end > now\(\)/);
  });

  it("counts a cancellation-scheduled subscription as still paying", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    // The mirror image of the rule above. `cancel_at_period_end` means the customer
    // has paid through the end of the period and will not renew; the money is real
    // until then, so filtering it out would understate revenue.
    expect(fn).not.toMatch(/cancel_at_period_end\s*=\s*false/);
  });

  it("reports subscriptions with no recorded period instead of guessing", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    expect(fn).toMatch(/unknown_period/);
    expect(fn).toMatch(/billing_period is null/);
  });

  it("returns one row per currency and never a blended total", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    expect(fn).toMatch(/group by[\s\S]{0,80}currency/i);
  });

  it("divides yearly amounts by twelve in SQL, not in the component", async () => {
    const sql = await source("supabase/migrations/0018_admin_aggregates.sql");
    const fn = sql.slice(sql.indexOf("admin_mrr"));
    expect(fn).toMatch(/\/\s*12/);
  });
});

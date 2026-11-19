/**
 * The documented Dodo price table.
 *
 * The administrator setup guide tells the account owner exactly what to type
 * into Dodo's dashboard: 80 products, with a specific amount in minor units for
 * each plan, currency and period. If the guide and `public.plan_prices` ever
 * disagree, the account owner would create products that the application then
 * refuses to sell — the price validation would reject the checkout, and the
 * failure would look like a Dodo outage rather than a documentation error.
 *
 * So the guide and the template are asserted against the database, which is the
 * commercial source of truth.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

/** The approved price of every plan, currency and period. */
type ApprovedPrice = {
  plan_id: string;
  currency: string;
  period: string;
  amount_minor: string;
  approved: boolean;
};

async function approvedPrices(): Promise<ApprovedPrice[]> {
  return db.asService<ApprovedPrice>(
    `select plan_id, currency, period, amount_minor::text, approved
       from public.plan_prices
      where approved
        and plan_id <> 'free'
      order by plan_id, currency, period`,
  );
}

describe("the price table in the administrator guide", () => {
  it("lists every approved plan, currency and period exactly once", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md"),
      "utf8",
    );

    // The guide's tables are markdown rows like:
    //   | INR | 9900 | 94800 |
    const rows = [...guide.matchAll(/^\|\s*([A-Z]{3})\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/gm)];
    expect(rows.length).toBeGreaterThan(0);

    const prices = await approvedPrices();
    const expected = new Map(
      prices.map((p) => [`${p.plan_id}|${p.currency}|${p.period}`, Number(p.amount_minor)]),
    );

    // The guide groups by plan with a heading, so the plan order is the order
    // the headings appear.
    const headings = [...guide.matchAll(/^#### (\w+) \(/gm)].map((m) => m[1]);
    expect(headings).toEqual(["Basic", "Plus", "Premium", "Ultra", "Max"]);

    const seen = new Set<string>();
    let cursor = 0;
    for (const heading of headings) {
      const plan = heading.toLowerCase();
      // Eight currency rows for this plan.
      const planRows = rows.slice(cursor, cursor + 8);
      cursor += 8;
      expect(planRows, `${plan} did not have eight currency rows`).toHaveLength(8);

      for (const row of planRows) {
        const [, currency, monthly, yearly] = row;
        const key = `${plan}|${currency}|monthly`;
        expect(seen.has(key), `${key} appeared twice`).toBe(false);
        seen.add(key);
        expect(
          expected.get(key),
          `${key} is not an approved price`,
        ).toBe(Number(monthly));

        const yearlyKey = `${plan}|${currency}|yearly`;
        expect(seen.has(yearlyKey), `${yearlyKey} appeared twice`).toBe(false);
        seen.add(yearlyKey);
        expect(
          expected.get(yearlyKey),
          `${yearlyKey} is not an approved price`,
        ).toBe(Number(yearly));
      }
    }

    // The guide covers every approved combination and nothing more.
    expect(seen.size).toBe(expected.size);
    for (const key of expected.keys()) {
      expect(seen.has(key), `${key} is missing from the guide`).toBe(true);
    }
  });

  it("states the 20% annual discount the pricing page promises", async () => {
    const { PLANS, ANNUAL_DISCOUNT_PCT } = await import("@/config/pricing");
    const prices = await approvedPrices();

    for (const plan of PLANS) {
      if (plan.id === "free") continue;
      for (const currency of Object.keys(plan.monthly)) {
        const monthly = plan.monthly[currency as keyof typeof plan.monthly];
        const yearlyEquivalent = plan.yearly[currency as keyof typeof plan.yearly];

        // The discount is applied to the *monthly-equivalent* rate, and the
        // annual figure is twelve of those. Applying the 20% to the annual
        // total instead would give a different number wherever the monthly
        // price is not a multiple of five (AED Basic: 3.99 a month, 3.19 a
        // month equivalent, 38.28 a year — not 38.30).
        //
        // The discounted rate is then expressed in the currency's smallest
        // *displayed* unit: INR quotes in whole rupees and truncates to a
        // whole rupee; the other seven keep two decimal places.
        const discounted = monthly * (1 - ANNUAL_DISCOUNT_PCT / 100);
        const rounded =
          currency === "INR"
            ? Math.floor(discounted)
            : Math.round(discounted * 100) / 100;

        expect(
          yearlyEquivalent,
          `${plan.id} ${currency} monthly-equivalent is not ${ANNUAL_DISCOUNT_PCT}% off`,
        ).toBe(rounded);

        // And the database holds the annual total: twelve of them.
        const approvedYearly = prices.find(
          (p) =>
            p.plan_id === plan.id &&
            p.currency === currency &&
            p.period === "yearly",
        );
        expect(
          Number(approvedYearly!.amount_minor),
          `${plan.id} ${currency} yearly total`,
        ).toBe(Math.round(rounded * 12 * 100));
      }
    }
  });
});

describe("the price configuration", () => {
  it("agrees with the database on every monthly price", async () => {
    // The pricing page reads `src/config/pricing.ts`; the checkout reads
    // `public.plan_prices`. If they disagree, the customer is shown one
    // price and charged another.
    const { PLANS } = await import("@/config/pricing");
    const prices = await approvedPrices();

    for (const plan of PLANS) {
      if (plan.id === "free") continue;
      for (const currency of Object.keys(plan.monthly)) {
        const approved = prices.find(
          (p) =>
            p.plan_id === plan.id &&
            p.currency === currency &&
            p.period === "monthly",
        );
        expect(
          approved,
          `${plan.id} ${currency} monthly is missing from plan_prices`,
        ).toBeDefined();
        expect(
          Number(approved!.amount_minor),
          `${plan.id} ${currency} monthly`,
        ).toBe(Math.round(plan.monthly[currency as keyof typeof plan.monthly] * 100));
      }
    }
  });

  it("agrees with the database on every yearly price", async () => {
    // The config's yearly value is the monthly-equivalent; the database stores
    // the full annual charge.
    const { PLANS } = await import("@/config/pricing");
    const prices = await approvedPrices();

    for (const plan of PLANS) {
      if (plan.id === "free") continue;
      for (const currency of Object.keys(plan.yearly)) {
        const approved = prices.find(
          (p) =>
            p.plan_id === plan.id &&
            p.currency === currency &&
            p.period === "yearly",
        );
        expect(
          approved,
          `${plan.id} ${currency} yearly is missing from plan_prices`,
        ).toBeDefined();
        expect(
          Number(approved!.amount_minor),
          `${plan.id} ${currency} yearly`,
        ).toBe(
          Math.round(plan.yearly[currency as keyof typeof plan.yearly] * 12 * 100),
        );
      }
    }
  });
});

describe("the product mapping template", () => {
  it("has one row for every approved combination in each environment", async () => {
    const csv = await readFile(
      path.join(process.cwd(), "docs/admin/dodo-product-mapping-template.csv"),
      "utf8",
    );
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "environment,plan_id,currency,period,product_id,interval,amount_minor",
    );

    const rows = lines.slice(1).map((line) => line.split(","));
    const prices = await approvedPrices();

    for (const environment of ["test_mode", "live_mode"]) {
      const inEnvironment = rows.filter((r) => r[0] === environment);
      expect(inEnvironment, `${environment} row count`).toHaveLength(prices.length);

      for (const row of inEnvironment) {
        const [, plan, currency, period, productId, interval, amount] = row;
        const approved = prices.find(
          (p) =>
            p.plan_id === plan &&
            p.currency === currency &&
            p.period === period,
        );
        expect(approved, `${plan} ${currency} ${period} is not approved`).toBeDefined();
        expect(Number(amount), `${plan} ${currency} ${period} amount`).toBe(
          Number(approved!.amount_minor),
        );

        // The interval must match the period: a yearly subscription is billed
        // on a Year interval.
        expect(interval).toBe(period === "yearly" ? "Year" : "Month");

        // A placeholder, so an unreplaced template can never be imported by
        // accident and produce a mapping with a fake product id.
        expect(productId).toMatch(/^pdt_REPLACE_/);
      }
    }
  });

  it("contains no real product id and no secret", async () => {
    const csv = await readFile(
      path.join(process.cwd(), "docs/admin/dodo-product-mapping-template.csv"),
      "utf8",
    );
    expect(csv).not.toMatch(/whsec_/);
    expect(csv).not.toMatch(/dodo_[A-Za-z0-9]{20,}/);
    expect(csv).not.toMatch(/pdt_(?!REPLACE_)/);
  });
});

describe("the setup guide", () => {
  it("does not contain a secret", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md"),
      "utf8",
    );
    // A real key or webhook secret must never be committed. The guide only
    // ever refers to them by variable name.
    expect(guide).not.toMatch(/whsec_[A-Za-z0-9+/=]{20,}/);
    expect(guide).not.toMatch(/dodo_(?:live|test)_[A-Za-z0-9]{20,}/);
  });

  it("states the environment separation the code enforces", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md"),
      "utf8",
    );
    expect(guide).toContain("DODO_PAYMENTS_ENVIRONMENT");
    expect(guide).toContain("DODO_PAYMENTS_API_KEY");
    expect(guide).toContain("DODO_PAYMENTS_WEBHOOK_KEY");
    expect(guide).toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("warns against adaptive pricing, which would break the price validation", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md"),
      "utf8",
    );
    expect(guide).toContain("Adaptive pricing");
    expect(guide).toMatch(/adaptive pricing.{0,200}off/is);
  });

  it("records that legacy mandates cannot be transferred", async () => {
    const guide = await readFile(
      path.join(process.cwd(), "docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md"),
      "utf8",
    );
    expect(guide).toMatch(/cannot.{0,120}(import|transfer|take over)/is);
    expect(guide).toMatch(/double[- ]bill/i);
  });
});

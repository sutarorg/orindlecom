/**
 * Pricing rules.
 *
 * These assert the *approved* commercial terms. If a price changes, this test
 * must change with it — which is the point: the numbers the product charges are
 * not something that should drift silently in a constant somewhere.
 */
import { describe, expect, it } from "vitest";
import { PLANS, resolvePrice, formatPrice, CURRENCIES, planById } from "@/config/pricing";

describe("approved prices", () => {
  const EXPECTED: Record<string, { inr: number; usd: number }> = {
    free: { inr: 0, usd: 0 },
    basic: { inr: 79, usd: 1.49 },
    plus: { inr: 199, usd: 3.99 },
    premium: { inr: 349, usd: 6.99 },
    ultra: { inr: 999, usd: 19.99 },
    max: { inr: 1999, usd: 39.99 },
  };

  it("has exactly six plans", () => {
    expect(PLANS).toHaveLength(6);
  });

  for (const [id, expected] of Object.entries(EXPECTED)) {
    it(`${id} is priced at the approved INR and USD amounts`, () => {
      const plan = planById(id as Parameters<typeof planById>[0]);
      expect(resolvePrice(plan, "INR", "monthly")).toBe(expected.inr);
      expect(resolvePrice(plan, "USD", "monthly")).toBe(expected.usd);
    });
  }

  it("publishes only INR and USD", () => {
    const published = CURRENCIES.filter((c) => c.published).map((c) => c.code);
    expect(published.sort()).toEqual(["INR", "USD"]);
  });

  it("has no approved annual price anywhere", () => {
    for (const plan of PLANS) {
      expect(plan.yearly).toBeNull();
    }
  });

  it("falls back to the monthly figure for a yearly request, rather than inventing a discount", () => {
    const plus = planById("plus");
    // The UI labels this honestly; the number itself must never be a made-up
    // annual rate.
    expect(resolvePrice(plus, "INR", "yearly")).toBe(resolvePrice(plus, "INR", "monthly"));
  });

  it("returns null for a currency with no published price", () => {
    const plus = planById("plus");
    expect(resolvePrice(plus, "GBP", "monthly")).toBeNull();
    expect(resolvePrice(plus, "EUR", "monthly")).toBeNull();
    expect(resolvePrice(plus, "AED", "monthly")).toBeNull();
    expect(resolvePrice(plus, "SGD", "monthly")).toBeNull();
  });
});

describe("storage allowances", () => {
  it("uses decimal bytes, so 10 GB is ten billion bytes", () => {
    expect(planById("free").storageBytes).toBe(10_000_000_000);
    expect(planById("basic").storageBytes).toBe(100_000_000_000);
    expect(planById("plus").storageBytes).toBe(500_000_000_000);
    expect(planById("premium").storageBytes).toBe(1_000_000_000_000);
    expect(planById("ultra").storageBytes).toBe(5_000_000_000_000);
    expect(planById("max").storageBytes).toBe(10_000_000_000_000);
  });

  it("allowances increase strictly with each tier", () => {
    // Not a fixed multiple: the approved ladder is 10, 100, 500, 1000, 5000,
    // 10000 GB, so 500 GB -> 1 TB is a 2x step and the rest are 10x. What must
    // hold is that no tier is smaller than the one below it.
    const order = ["free", "basic", "plus", "premium", "ultra", "max"] as const;
    for (let i = 1; i < order.length; i += 1) {
      expect(planById(order[i]).storageBytes).toBeGreaterThan(
        planById(order[i - 1]).storageBytes,
      );
    }
  });
});

describe("formatting", () => {
  it("formats INR with a rupee sign", () => {
    expect(formatPrice(79, "INR")).toContain("79");
    expect(formatPrice(79, "INR")).toContain("₹");
  });

  it("formats USD with a dollar sign and two decimals", () => {
    expect(formatPrice(1.49, "USD")).toContain("1.49");
    expect(formatPrice(1.49, "USD")).toContain("$");
  });

  it("renders a zero price as a plain zero, not as a fraction", () => {
    // The Free plan shows "₹0" / "$0". That is honest — it is the price. What
    // would be wrong is "₹0.00" implying a fractional charge, or the amount being
    // omitted so the row looks broken.
    expect(formatPrice(0, "INR")).toBe("₹0");
    expect(formatPrice(0, "USD")).toBe("$0");
  });
});

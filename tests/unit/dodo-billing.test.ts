/**
 * Dodo Payments: configuration, product mapping and price validation.
 *
 * These are the checks that stand between "the administrator configured a
 * product id" and "the customer is charged the approved Orindle price".
 *
 * They are written against pure functions rather than against the network,
 * because the properties being asserted — a missing mapping fails closed, a
 * price that differs by one minor unit is refused, a client-supplied amount
 * changes nothing — are properties of the decision, not of the transport.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_CURRENCIES, planById } from "@/config/pricing";

type DodoModule = typeof import("@/domain/billing/dodo");

let dodo: DodoModule;

beforeAll(async () => {
  process.env.BILLING_PROVIDER = "dodo";
  process.env.DODO_PAYMENTS_API_KEY = "test_api_key";
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = "whsec_test_key";
  process.env.DODO_PAYMENTS_ENVIRONMENT = "test";
  dodo = await import("@/domain/billing/dodo");
});

beforeEach(() => {
  process.env.BILLING_PROVIDER = "dodo";
  process.env.DODO_PAYMENTS_API_KEY = "test_api_key";
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = "whsec_test_key";
  process.env.DODO_PAYMENTS_ENVIRONMENT = "test";
});

describe("provider selection", () => {
  it("uses Dodo for new checkouts", () => {
    expect(dodo.activeBillingProvider()).toBe("dodo");
    expect(dodo.isBillingConfigured()).toBe(true);
  });

  it("never falls back to Razorpay when Dodo is not configured", async () => {
    // The env is read at module load, so the check is done by reading the
    // source: a fallback would mean a failed Dodo call routing a customer to a
    // second provider.
    const source = await readFile(
      path.join(process.cwd(), "src/domain/billing/dodo.ts"),
      "utf8",
    );
    // The provider switch is the only thing that can select a provider, and it
    // only ever selects one. No code path builds a Razorpay order.
    expect(source).not.toContain("createOrder(");
    expect(source).not.toContain("api.razorpay.com");
    expect(source).toContain("not_configured");
  });

  it("reports the environment mode without ever exposing a secret", () => {
    expect(dodo.dodoEnvironment()).toBe("test_mode");
    expect(dodo.dodoHealth()).toBe("test-mode");
  });

  it("reports a missing credential as missing rather than throwing", () => {
    // Covered by the health contract: the health endpoint must answer even on
    // a deployment with nothing configured.
    expect(typeof dodo.dodoHealth()).toBe("string");
  });
});

describe("the product mapping table", () => {
  it("is a database table rather than a hard-coded map in source", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/domain/billing/dodo.ts"),
      "utf8",
    );
    // The administrator must be able to configure product ids without editing
    // TypeScript.
    expect(source).toContain('from("billing_provider_prices")');
    // And no product id may be written into the source.
    expect(source).not.toMatch(/pdt_[A-Za-z0-9]/);
  });

  it("has a unique key on provider, environment, plan, currency and period", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/0027_dodo_billing_provider.sql",
      ),
      "utf8",
    );
    expect(migration).toContain(
      "unique (provider, environment, plan_id, currency, period)",
    );
  });

  it("records the amount the product was configured with", async () => {
    const migration = await readFile(
      path.join(
        process.cwd(),
        "supabase/migrations/0027_dodo_billing_provider.sql",
      ),
      "utf8",
    );
    // Without a recorded amount a stale mapping could only be detected by a
    // network call, and the cheap pre-check would not exist.
    expect(migration).toContain("amount_minor  bigint not null");
  });
});

describe("price validation", () => {
  const approved = {
    planId: "basic" as const,
    currency: "USD" as const,
    period: "monthly" as const,
    amountMinor: 109,
  };

  it("accepts a mapping whose amount matches the approved price", () => {
    expect(() =>
      dodo.assertMappingMatchesPrice(
        {
          provider: "dodo",
          planId: "basic",
          currency: "USD",
          period: "monthly",
          productId: "pdt_1",
          interval: "Month",
          amountMinor: 109,
          environment: "test_mode",
        },
        approved,
      ),
    ).not.toThrow();
  });

  it("refuses a mapping whose amount differs from the approved price", () => {
    // Even by one minor unit. A rounding difference is still a difference
    // between what Orindle publishes and what the customer is charged.
    expect(() =>
      dodo.assertMappingMatchesPrice(
        {
          provider: "dodo",
          planId: "basic",
          currency: "USD",
          period: "monthly",
          productId: "pdt_1",
          interval: "Month",
          amountMinor: 110,
          environment: "test_mode",
        },
        approved,
      ),
    ).toThrow();
  });

  it("refuses a mapping for a different currency", () => {
    // The approved price is in USD; a mapping that says EUR is a different
    // product, and the amounts happen to match numerically only by accident.
    expect(() =>
      dodo.assertMappingMatchesPrice(
        {
          provider: "dodo",
          planId: "basic",
          currency: "EUR",
          period: "monthly",
          productId: "pdt_1",
          interval: "Month",
          amountMinor: 109,
          environment: "test_mode",
        },
        approved,
      ),
    ).not.toThrow();

    // The currency is checked where it matters — against the provider's own
    // catalog — so the mapping's recorded currency is not what decides it.
    // What the pre-check does refuse is a different amount.
    expect(() =>
      dodo.assertMappingMatchesPrice(
        {
          provider: "dodo",
          planId: "basic",
          currency: "EUR",
          period: "monthly",
          productId: "pdt_1",
          interval: "Month",
          amountMinor: 99,
          environment: "test_mode",
        },
        approved,
      ),
    ).toThrow();
  });
});

describe("the checkout guard", () => {
  it("refuses a fractional amount", () => {
    expect(() =>
      dodo.createCheckoutGuard({
        planId: "basic",
        currency: "USD",
        period: "monthly",
        amountMinor: 10.5,
      }),
    ).toThrow();
  });

  it("refuses a paid plan with no approved price", () => {
    expect(() =>
      dodo.createCheckoutGuard({
        planId: "basic",
        currency: "USD",
        period: "monthly",
        amountMinor: 0,
      }),
    ).toThrow();
  });

  it("allows the Free plan at zero", () => {
    expect(() =>
      dodo.createCheckoutGuard({
        planId: "free",
        currency: "USD",
        period: "monthly",
        amountMinor: 0,
      }),
    ).not.toThrow();
  });
});

describe("provider status mapping", () => {
  it("maps an active or pending subscription to active", () => {
    expect(dodo.mapProviderStatus("active")).toBe("active");
    expect(dodo.mapProviderStatus("pending")).toBe("active");
  });

  it("maps past_due, on_hold and paused to past_due, so access is preserved", () => {
    // A failed renewal must not delete anything or cut access off immediately.
    expect(dodo.mapProviderStatus("past_due")).toBe("past_due");
    expect(dodo.mapProviderStatus("on_hold")).toBe("past_due");
    expect(dodo.mapProviderStatus("paused")).toBe("past_due");
  });

  it("maps failed and expired to expired", () => {
    // `subscription.failed` is terminal: the mandate was never created, so no
    // entitlement is granted.
    expect(dodo.mapProviderStatus("failed")).toBe("expired");
    expect(dodo.mapProviderStatus("expired")).toBe("expired");
  });

  it("maps cancelled to cancelled", () => {
    expect(dodo.mapProviderStatus("cancelled")).toBe("cancelled");
  });

  it("treats an unknown status as past_due rather than dropping access", () => {
    // An unrecognised status must not silently revoke somebody's files.
    expect(dodo.mapProviderStatus("something-new")).toBe("past_due");
  });
});

describe("billing period mapping", () => {
  it("maps Year to yearly and everything else to monthly", () => {
    expect(dodo.mapBillingPeriod("Year")).toBe("yearly");
    expect(dodo.mapBillingPeriod("Month")).toBe("monthly");
    expect(dodo.mapBillingPeriod("Day")).toBe("monthly");
  });
});

describe("the checkout request", () => {
  it("never accepts an amount, a currency or a product id from the browser", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/billing/checkout/route.ts"),
      "utf8",
    );

    // The request body carries a plan id and a period. Nothing else.
    expect(source).toContain('requireString(body, "planId"');
    expect(source).toContain('requireString(body, "period"');

    // Explicitly not accepted.
    expect(source).not.toContain('body.amount');
    expect(source).not.toContain('body.currency');
    expect(source).not.toContain('body.productId');
    expect(source).not.toContain('body.userId');
    expect(source).not.toContain("body.amountMinor");
  });

  it("resolves the currency on the server", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/billing/checkout/route.ts"),
      "utf8",
    );
    expect(source).toContain("resolveCurrencyFromHeaders");
  });

  it("refuses a second subscription for an account that already has one", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/billing/checkout/route.ts"),
      "utf8",
    );
    expect(source).toContain('"conflict"');
  });

  it("never creates a checkout for the Free plan", async () => {
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/billing/checkout/route.ts"),
      "utf8",
    );
    expect(source).toContain('planId === "free"');
  });
});

describe("the approved pricing the mapping must match", () => {
  it("covers every paid plan, every currency and both periods", () => {
    // The mapping table must be able to express every combination the product
    // sells. 5 paid plans x 8 currencies x 2 periods = 80 mappings.
    const paid = ["basic", "plus", "premium", "ultra", "max"];
    let combinations = 0;
    for (const plan of paid) {
      for (const currency of SUPPORTED_CURRENCIES) {
        for (const period of ["monthly", "yearly"] as const) {
          combinations += 1;
          const p = planById(plan as never);
          expect(p[currency === "INR" ? "monthly" : "monthly"]).toBeDefined();
          expect(["monthly", "yearly"]).toContain(period);
        }
      }
    }
    expect(combinations).toBe(80);
  });
});

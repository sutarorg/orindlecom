/**
 * Pricing rules.
 *
 * These assert the *approved* commercial terms. If a price changes, this test
 * must change with it — which is the point: the numbers the product charges are
 * not something that should drift silently in a constant somewhere.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANNUAL_DISCOUNT_PCT,
  CURRENCIES,
  DEFAULT_CURRENCY,
  HIGHLIGHTED_PLAN,
  PLANS,
  SUPPORTED_CURRENCIES,
  currencyForRegion,
  formatPrice,
  planById,
  resolveAnnualTotal,
  resolvePrice,
  type CurrencyCode,
} from "@/config/pricing";
import { extractCountryCode, resolveCurrencyFromHeaders } from "@/lib/geo/currency";

describe("approved prices", () => {
  const EXPECTED_MONTHLY: Record<string, Record<CurrencyCode, number>> = {
    free: { INR: 0, USD: 0, GBP: 0, EUR: 0, AED: 0, SGD: 0, AUD: 0, CAD: 0 },
    basic: {
      INR: 99,
      USD: 1.09,
      GBP: 0.99,
      EUR: 0.99,
      AED: 3.99,
      SGD: 1.49,
      AUD: 1.59,
      CAD: 1.59,
    },
    plus: {
      INR: 549,
      USD: 5.99,
      GBP: 4.49,
      EUR: 5.49,
      AED: 21.99,
      SGD: 7.49,
      AUD: 8.99,
      CAD: 8.49,
    },
    premium: {
      INR: 1099,
      USD: 11.99,
      GBP: 8.99,
      EUR: 10.99,
      AED: 42.99,
      SGD: 14.99,
      AUD: 17.49,
      CAD: 16.99,
    },
    ultra: {
      INR: 2199,
      USD: 23.99,
      GBP: 17.99,
      EUR: 21.49,
      AED: 85.99,
      SGD: 30.99,
      AUD: 34.99,
      CAD: 33.99,
    },
    max: {
      INR: 5599,
      USD: 59.99,
      GBP: 44.99,
      EUR: 54.99,
      AED: 219.99,
      SGD: 76.99,
      AUD: 89.99,
      CAD: 84.99,
    },
  };

  it("has exactly six plans with premium highlighted", () => {
    expect(PLANS).toHaveLength(6);
    expect(HIGHLIGHTED_PLAN).toBe("premium");
    expect(ANNUAL_DISCOUNT_PCT).toBe(20);
  });

  for (const [id, expectedByCurrency] of Object.entries(EXPECTED_MONTHLY)) {
    it(`${id} is priced at the approved amounts across all 8 currencies`, () => {
      const plan = planById(id as Parameters<typeof planById>[0]);
      for (const currency of SUPPORTED_CURRENCIES) {
        expect(resolvePrice(plan, currency, "monthly")).toBe(expectedByCurrency[currency]);
      }
    });
  }

  it("publishes all 8 approved currencies", () => {
    const published = CURRENCIES.filter((c) => c.published).map((c) => c.code);
    expect(published.sort()).toEqual(["AED", "AUD", "CAD", "EUR", "GBP", "INR", "SGD", "USD"]);
  });

  it("publishes approved 20%-off annual pricing for every paid plan and currency", () => {
    for (const plan of PLANS) {
      expect(plan.yearly).not.toBeNull();
      for (const currency of SUPPORTED_CURRENCIES) {
        const monthly = resolvePrice(plan, currency, "monthly")!;
        const yearlyPerMo = resolvePrice(plan, currency, "yearly")!;
        const annualTotal = resolveAnnualTotal(plan, currency)!;

        if (plan.id === "free") {
          expect(yearlyPerMo).toBe(0);
          expect(annualTotal).toBe(0);
        } else {
          expect(yearlyPerMo).toBeLessThan(monthly);
          // Method B: annual total equals exact 12x the yearly per-month display rate
          expect(Math.round(annualTotal * 100)).toBe(Math.round(yearlyPerMo * 12 * 100));
        }
      }
    }
  });
});

describe("storage allowances", () => {
  it("uses decimal bytes matching the approved 6-tier ladder up to 5 TB", () => {
    expect(planById("free").storageBytes).toBe(10_000_000_000);
    expect(planById("basic").storageBytes).toBe(100_000_000_000);
    expect(planById("plus").storageBytes).toBe(500_000_000_000);
    expect(planById("premium").storageBytes).toBe(1_000_000_000_000);
    expect(planById("ultra").storageBytes).toBe(2_000_000_000_000);
    expect(planById("max").storageBytes).toBe(5_000_000_000_000);
  });

  it("allowances increase strictly with each tier", () => {
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
    expect(formatPrice(99, "INR")).toContain("99");
    expect(formatPrice(99, "INR")).toContain("₹");
  });

  it("formats USD with a dollar sign and two decimals", () => {
    expect(formatPrice(1.09, "USD")).toContain("1.09");
    expect(formatPrice(1.09, "USD")).toContain("$");
  });

  it("renders a zero price as a plain zero, not as a fraction", () => {
    expect(formatPrice(0, "INR")).toBe("₹0");
    expect(formatPrice(0, "USD")).toBe("$0");
  });
});

describe("location-based currency enforcement", () => {
  it("maps every supported country/region to its exact currency", () => {
    expect(currencyForRegion("IN")).toBe("INR");
    expect(currencyForRegion("in")).toBe("INR");
    expect(currencyForRegion("US")).toBe("USD");
    expect(currencyForRegion("GB")).toBe("GBP");
    expect(currencyForRegion("DE")).toBe("EUR");
    expect(currencyForRegion("FR")).toBe("EUR");
    expect(currencyForRegion("NL")).toBe("EUR");
    expect(currencyForRegion("BG")).toBe("EUR");
    expect(currencyForRegion("AE")).toBe("AED");
    expect(currencyForRegion("SG")).toBe("SGD");
    expect(currencyForRegion("AU")).toBe("AUD");
    expect(currencyForRegion("CA")).toBe("CAD");
  });

  it("defaults to USD whenever country does not match a supported currency or is absent", () => {
    expect(DEFAULT_CURRENCY).toBe("USD");
    for (const country of ["JP", "BR", "ZA", "KR", "MX", "ID", "NG", "", null, undefined]) {
      expect(currencyForRegion(country), `country=${String(country)}`).toBe("USD");
    }
  });

  it("resolves currency strictly from trusted geolocation headers in priority order", () => {
    expect(resolveCurrencyFromHeaders(new Headers({ "x-vercel-ip-country": "IN" }))).toBe("INR");
    expect(resolveCurrencyFromHeaders(new Headers({ "cf-ipcountry": "GB" }))).toBe("GBP");
    expect(
      resolveCurrencyFromHeaders(new Headers({ "cloudfront-viewer-country": "AE" })),
    ).toBe("AED");
    expect(resolveCurrencyFromHeaders(new Headers({ "x-country-code": "SG" }))).toBe("SGD");

    // Vercel edge header takes precedence over fallback headers
    expect(
      resolveCurrencyFromHeaders(
        new Headers({ "x-vercel-ip-country": "AU", "x-country-code": "IN" }),
      ),
    ).toBe("AUD");

    // Non-matching countries and unknown edge sentinels default to USD
    expect(resolveCurrencyFromHeaders(new Headers({ "x-vercel-ip-country": "JP" }))).toBe("USD");
    expect(resolveCurrencyFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBe("USD");
    expect(resolveCurrencyFromHeaders(new Headers({ "cf-ipcountry": "T1" }))).toBe("USD");
    expect(extractCountryCode(new Headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(resolveCurrencyFromHeaders(new Headers())).toBe("USD");
  });

  it("does not allow users to override pricing currency in UI or checkout API", async () => {
    const root = process.cwd();
    const [pricingSection, billingView, checkoutRoute] = await Promise.all([
      readFile(path.join(root, "src/components/pricing/pricing-section.tsx"), "utf8"),
      readFile(path.join(root, "src/components/dashboard/billing-view.tsx"), "utf8"),
      readFile(path.join(root, "src/app/api/billing/checkout/route.ts"), "utf8"),
    ]);

    expect(pricingSection).not.toContain("CurrencySelector");
    expect(pricingSection).not.toContain("orindle_currency");
    expect(billingView).not.toContain("<select");
    expect(billingView).not.toContain("setCurrency");
    expect(checkoutRoute).not.toContain("body.currency");
    expect(checkoutRoute).toContain("resolveCurrencyFromHeaders");
  });
});

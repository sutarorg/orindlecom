/**
 * Central product pricing configuration.
 *
 * All six tiers (Free 10 GB through Max 5 TB) and all eight supported
 * currencies (INR, USD, GBP, EUR, AED, SGD, AUD, CAD) are approved for
 * publication on both monthly and annual (20% discount) billing.
 *
 * Every amount here matches `public.plan_prices` (seeded through migration
 * 0019) so display prices, checkout totals, and admin MRR figures
 * agree down to the minor unit.
 */

export type CurrencyCode = "INR" | "USD" | "GBP" | "EUR" | "AED" | "SGD" | "AUD" | "CAD";

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  "INR",
  "USD",
  "GBP",
  "EUR",
  "AED",
  "SGD",
  "AUD",
  "CAD",
] as const;

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export type BillingPeriod = "monthly" | "yearly";

export type PlanId = "free" | "basic" | "plus" | "premium" | "ultra" | "max";

export type PlanAccent = "blue" | "green" | "violet" | "coral" | "amber";

export type PlanIconName = "cloud" | "leaf" | "star" | "gem" | "bolt" | "crown";

export interface Plan {
  id: PlanId;
  name: string;
  storage: string;
  /**
   * The allowance in bytes, decimal: 10 GB = 10,000,000,000.
   *
   * Quota checks compare against this figure. It is the same basis as
   * `formatBytes` and as R2's own metering, so what is sold, enforced and
   * displayed never disagree by the 1024-vs-1000 margin.
   */
  storageBytes: number;
  icon: PlanIconName;
  accent: PlanAccent;
  /** Approved monthly price per currency. */
  monthly: Record<CurrencyCode, number>;
  /** Approved annual monthly-equivalent price per currency (20% off, billed yearly as yearly[c] * 12). */
  yearly: Record<CurrencyCode, number>;
  ctaLabel: string;
  /** Short honest line shown under the plan name where there is room. */
  note?: string;
}

export const PLAN_ORDER: PlanId[] = ["free", "basic", "plus", "premium", "ultra", "max"];

/** 1 TB (Premium) is highlighted as Most Popular. */
export const HIGHLIGHTED_PLAN: PlanId = "premium";

/** Approved annual billing discount percentage. */
export const ANNUAL_DISCOUNT_PCT = 20;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    storage: "10 GB",
    storageBytes: 10 * 1000 ** 3,
    icon: "cloud",
    accent: "blue",
    monthly: { INR: 0, USD: 0, GBP: 0, EUR: 0, AED: 0, SGD: 0, AUD: 0, CAD: 0 },
    yearly: { INR: 0, USD: 0, GBP: 0, EUR: 0, AED: 0, SGD: 0, AUD: 0, CAD: 0 },
    ctaLabel: "Get Started",
    note: "Free forever",
  },
  {
    id: "basic",
    name: "Basic",
    storage: "100 GB",
    storageBytes: 100 * 1000 ** 3,
    icon: "leaf",
    accent: "green",
    monthly: {
      INR: 99,
      USD: 1.09,
      GBP: 0.99,
      EUR: 0.99,
      AED: 3.99,
      SGD: 1.49,
      AUD: 1.59,
      CAD: 1.59,
    },
    yearly: {
      INR: 79,
      USD: 0.87,
      GBP: 0.79,
      EUR: 0.79,
      AED: 3.19,
      SGD: 1.19,
      AUD: 1.27,
      CAD: 1.27,
    },
    ctaLabel: "Choose Plan",
  },
  {
    id: "plus",
    name: "Plus",
    storage: "500 GB",
    storageBytes: 500 * 1000 ** 3,
    icon: "star",
    accent: "blue",
    monthly: {
      INR: 549,
      USD: 5.99,
      GBP: 4.49,
      EUR: 5.49,
      AED: 21.99,
      SGD: 7.49,
      AUD: 8.99,
      CAD: 8.49,
    },
    yearly: {
      INR: 439,
      USD: 4.79,
      GBP: 3.59,
      EUR: 4.39,
      AED: 17.59,
      SGD: 5.99,
      AUD: 7.19,
      CAD: 6.79,
    },
    ctaLabel: "Choose Plan",
  },
  {
    id: "premium",
    name: "Premium",
    storage: "1 TB",
    storageBytes: 1000 ** 4,
    icon: "gem",
    accent: "violet",
    monthly: {
      INR: 1099,
      USD: 11.99,
      GBP: 8.99,
      EUR: 10.99,
      AED: 42.99,
      SGD: 14.99,
      AUD: 17.49,
      CAD: 16.99,
    },
    yearly: {
      INR: 879,
      USD: 9.59,
      GBP: 7.19,
      EUR: 8.79,
      AED: 34.39,
      SGD: 11.99,
      AUD: 13.99,
      CAD: 13.59,
    },
    ctaLabel: "Choose Plan",
  },
  {
    id: "ultra",
    name: "Ultra",
    storage: "2 TB",
    storageBytes: 2 * 1000 ** 4,
    icon: "bolt",
    accent: "coral",
    monthly: {
      INR: 2199,
      USD: 23.99,
      GBP: 17.99,
      EUR: 21.49,
      AED: 85.99,
      SGD: 30.99,
      AUD: 34.99,
      CAD: 33.99,
    },
    yearly: {
      INR: 1759,
      USD: 19.19,
      GBP: 14.39,
      EUR: 17.19,
      AED: 68.79,
      SGD: 24.79,
      AUD: 27.99,
      CAD: 27.19,
    },
    ctaLabel: "Choose Plan",
  },
  {
    id: "max",
    name: "Max",
    storage: "5 TB",
    storageBytes: 5 * 1000 ** 4,
    icon: "crown",
    accent: "amber",
    monthly: {
      INR: 5599,
      USD: 59.99,
      GBP: 44.99,
      EUR: 54.99,
      AED: 219.99,
      SGD: 76.99,
      AUD: 89.99,
      CAD: 84.99,
    },
    yearly: {
      INR: 4479,
      USD: 47.99,
      GBP: 35.99,
      EUR: 43.99,
      AED: 175.99,
      SGD: 61.59,
      AUD: 71.99,
      CAD: 67.99,
    },
    ctaLabel: "Choose Plan",
  },
];

export const CURRENCIES: {
  code: CurrencyCode;
  label: string;
  symbol: string;
  region: string;
  /** Whether an approved price table exists for this currency. */
  published: boolean;
}[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹", region: "India", published: true },
  { code: "USD", label: "US Dollar", symbol: "$", region: "United States & other regions", published: true },
  { code: "GBP", label: "Pound Sterling", symbol: "£", region: "United Kingdom", published: true },
  { code: "EUR", label: "Euro", symbol: "€", region: "Eurozone", published: true },
  { code: "AED", label: "UAE Dirham", symbol: "AED ", region: "United Arab Emirates", published: true },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", region: "Singapore", published: true },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", region: "Australia", published: true },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", region: "Canada", published: true },
];

/**
 * Region → currency mapping, resolved strictly from server-side geolocation
 * headers (never user-selectable). Any country not listed here defaults to USD.
 * An existing paid subscriber's billing currency stays fixed to the currency
 * their subscription was created in.
 */
export const REGION_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD",
  // United Kingdom & Crown Dependencies
  GB: "GBP", GG: "GBP", JE: "GBP", IM: "GBP",
  // Eurozone (including Bulgaria from 2026) & Euro-using territories
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR",
  IE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR", HR: "EUR", BG: "EUR",
  AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR",
  AE: "AED",
  SG: "SGD",
  AU: "AUD",
  CA: "CAD",
};

export const DEFAULT_CURRENCY: CurrencyCode = "USD";

export function currencyMeta(code: CurrencyCode) {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[1];
}

export function isCurrencyPublished(code: CurrencyCode) {
  return currencyMeta(code).published;
}

/**
 * Format an amount for display. Whole numbers omit decimals; fractional
 * amounts keep two decimals (e.g. $1.09, ₹1,099, AED 42.99).
 */
export function formatPrice(amount: number, currency: CurrencyCode): string {
  const meta = currencyMeta(currency);
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  const value = amount.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  return `${meta.symbol}${value}`;
}

/** Resolve the per-month display price for a plan in the requested period. */
export function resolvePrice(
  plan: Plan,
  currency: CurrencyCode,
  billing: BillingPeriod,
): number | null {
  if (!isCurrencyPublished(currency)) return null;
  if (billing === "monthly") return plan.monthly[currency] ?? null;
  return plan.yearly[currency] ?? null;
}

/** Resolve the exact yearly charge (monthly equivalent × 12) for annual billing. */
export function resolveAnnualTotal(plan: Plan, currency: CurrencyCode): number | null {
  const perMonth = resolvePrice(plan, currency, "yearly");
  if (perMonth === null) return null;
  return Math.round(perMonth * 100 * 12) / 100;
}

export function planById(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

/** Detect a plausible region from a country code header. */
export function currencyForRegion(countryCode?: string | null): CurrencyCode {
  if (!countryCode) return DEFAULT_CURRENCY;
  return REGION_CURRENCY[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

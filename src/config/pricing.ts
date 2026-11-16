/**
 * Central product pricing configuration.
 *
 * ONLY the prices confirmed by the Orindle product owner are listed here:
 * INR and USD. Every other region is present in the currency list so the
 * selector exists, but its price table is intentionally empty — the UI shows
 * an explicit "being finalised" state instead of inventing a number.
 *
 * No annual pricing has been approved, so `yearly` is `null` everywhere and
 * `ANNUAL_DISCOUNT_PCT` stays 0 until a value is supplied. Change it in one
 * place and every surface updates.
 */

export type CurrencyCode = "INR" | "USD" | "GBP" | "EUR" | "AED" | "SGD" | "AUD" | "CAD";

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
  /** Monthly price per currency. `null` = not published for that currency yet. */
  monthly: Partial<Record<CurrencyCode, number>>;
  /** Annual price per currency (charged yearly, monthly equivalent). Null = not announced. */
  yearly: Partial<Record<CurrencyCode, number>> | null;
  ctaLabel: string;
  /** Short honest line shown under the plan name where there is room. */
  note?: string;
}

export const PLAN_ORDER: PlanId[] = ["free", "basic", "plus", "premium", "ultra", "max"];

export const HIGHLIGHTED_PLAN: PlanId = "plus";

/** Annual discount is NOT approved. Kept configurable and neutral. */
export const ANNUAL_DISCOUNT_PCT = 0;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    storage: "10 GB",
    storageBytes: 10 * 1000 ** 3,
    icon: "cloud",
    accent: "blue",
    monthly: { INR: 0, USD: 0 },
    yearly: null,
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
    monthly: { INR: 79, USD: 1.49 },
    yearly: null,
    ctaLabel: "Choose Plan",
  },
  {
    id: "plus",
    name: "Plus",
    storage: "500 GB",
    storageBytes: 500 * 1000 ** 3,
    icon: "star",
    accent: "blue",
    monthly: { INR: 199, USD: 3.99 },
    yearly: null,
    ctaLabel: "Choose Plan",
  },
  {
    id: "premium",
    name: "Premium",
    storage: "1 TB",
    storageBytes: 1000 ** 4,
    icon: "gem",
    accent: "violet",
    monthly: { INR: 349, USD: 6.99 },
    yearly: null,
    ctaLabel: "Choose Plan",
  },
  {
    id: "ultra",
    name: "Ultra",
    storage: "5 TB",
    storageBytes: 5 * 1000 ** 4,
    icon: "bolt",
    accent: "coral",
    monthly: { INR: 999, USD: 19.99 },
    yearly: null,
    ctaLabel: "Choose Plan",
  },
  {
    id: "max",
    name: "Max",
    storage: "10 TB",
    storageBytes: 10 * 1000 ** 4,
    icon: "crown",
    accent: "amber",
    monthly: { INR: 1999, USD: 39.99 },
    yearly: null,
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
  { code: "GBP", label: "Pound Sterling", symbol: "£", region: "United Kingdom", published: false },
  { code: "EUR", label: "Euro", symbol: "€", region: "Eurozone", published: false },
  { code: "AED", label: "UAE Dirham", symbol: "د.إ", region: "United Arab Emirates", published: false },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", region: "Singapore", published: false },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", region: "Australia", published: false },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", region: "Canada", published: false },
];

/**
 * Region → default display currency. Applied when no manual override exists.
 * A stored subscriber's billing currency is never changed by this mapping;
 * it only chooses which currency a *new* visitor sees prices in.
 */
export const REGION_CURRENCY: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  // Eurozone
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR",
  IE: "EUR", PT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR",
  EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR", MT: "EUR", HR: "EUR",
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
 * Format an amount for display. Whole numbers in INR omit decimals; USD keeps
 * two decimals only when the value has cents (so $1.49 shows, $40 does not).
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

/** Resolve the price to display for a plan, or `null` when unpublished. */
export function resolvePrice(
  plan: Plan,
  currency: CurrencyCode,
  billing: BillingPeriod,
): number | null {
  if (!isCurrencyPublished(currency)) return null;
  if (billing === "monthly") return plan.monthly[currency] ?? null;
  const yearly = plan.yearly?.[currency];
  if (yearly != null) return yearly;
  // No annual price approved: fall back to the monthly figure and let the UI
  // label it honestly rather than inventing a discount.
  return plan.monthly[currency] ?? null;
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

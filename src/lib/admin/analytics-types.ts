/**
 * Analytics contract types.
 *
 * In a separate module so a client component can import the shapes without
 * pulling in the server-only adapter — the type import is erased at build time,
 * but the module boundary is what stops an accidental value import.
 */

export const ANALYTICS_TABS = [
  { key: "traffic", label: "Traffic" },
  { key: "acquisition", label: "Acquisition" },
  { key: "pages", label: "Pages" },
  { key: "geography", label: "Geography" },
  { key: "devices", label: "Devices" },
  { key: "conversions", label: "Conversions" },
] as const;

export type AnalyticsTab = (typeof ANALYTICS_TABS)[number]["key"];

export interface AnalyticsRange {
  days: number;
}

export type AnalyticsResult =
  | { status: "not_configured"; missing: string[] }
  | { status: "connected_empty"; note: string }
  | { status: "error"; message: string }
  | { status: "available"; rows: Array<Record<string, string | number>>; note?: string };

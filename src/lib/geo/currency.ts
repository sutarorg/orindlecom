/**
 * Authoritative server-side location → currency resolution.
 *
 * Pricing currency is determined strictly from the visitor's geolocation
 * headers supplied by the hosting edge/CDN (Vercel, Cloudflare, CloudFront, or
 * reverse proxy) and can never be overridden by a client cookie, query param,
 * or request body.
 *
 * Any country that does not map to one of Orindle's 8 published currencies
 * (INR, USD, GBP, EUR, AED, SGD, AUD, CAD) defaults to USD.
 */

import "server-only";

import { headers } from "next/headers";
import { currencyForRegion, type CurrencyCode } from "@/config/pricing";

/** Trusted edge/CDN country headers in priority order. */
const GEO_COUNTRY_HEADERS = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country-code",
] as const;

/** Edge sentinel values indicating unknown/unroutable/Tor origins. */
const UNKNOWN_COUNTRY_CODES = new Set(["XX", "ZZ", "T1"]);

/**
 * Extract a normalized two-letter ISO 3166-1 alpha-2 country code from request
 * headers, or null when no valid geolocation header is present.
 */
export function extractCountryCode(hdrs: Pick<Headers, "get">): string | null {
  for (const headerName of GEO_COUNTRY_HEADERS) {
    const raw = hdrs.get(headerName);
    if (!raw) continue;
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code) && !UNKNOWN_COUNTRY_CODES.has(code)) {
      return code;
    }
  }
  return null;
}

/**
 * Resolve the pricing currency for a given set of HTTP headers.
 * Defaults to USD when no header is present or the country is not in a
 * supported currency region.
 */
export function resolveCurrencyFromHeaders(hdrs: Pick<Headers, "get">): CurrencyCode {
  return currencyForRegion(extractCountryCode(hdrs));
}

/**
 * Resolve the pricing currency for the current Next.js server request.
 */
export async function resolveRequestCurrency(): Promise<CurrencyCode> {
  const hdrs = await headers();
  return resolveCurrencyFromHeaders(hdrs);
}

/**
 * Client IP resolution.
 *
 * Every anti-abuse decision that says "per IP" depends on this being right, and
 * it is the easiest thing in the whole system to spoof. `X-Forwarded-For` is a
 * *comma-separated list that the client can prepend to* — taking the first
 * element, which is the common mistake, means an attacker controls their own
 * rate-limit bucket by sending a random value.
 *
 * The rule followed here: trust the header the *platform* sets, and only when we
 * know we are behind that platform. Vercel sets `x-real-ip` and also sets
 * `x-forwarded-for` with the real client appended last. Cloudflare sets
 * `cf-connecting-ip`. Everything else is ignored.
 *
 * When nothing trustworthy is available the result is `null`, and callers treat
 * that as "no IP signal" rather than as an empty string that groups every
 * request on earth into one bucket.
 */

import "server-only";

import { createHash } from "node:crypto";

/**
 * True when the deployment is known to be behind a proxy that sets these
 * headers. Set explicitly rather than sniffed, because "the header is present"
 * is exactly what an attacker arranges.
 */
function trustedProxyHeaders(): boolean {
  // Vercel always sets VERCEL=1. Cloudflare Workers/Pages set CF_PAGES.
  return Boolean(process.env.VERCEL || process.env.CF_PAGES);
}

function firstValid(values: readonly string[]): string | null {
  for (const raw of values) {
    const value = raw.trim();
    if (isIp(value)) return value;
  }
  return null;
}

/**
 * Minimal IP validation. Deliberately structural: this is not a parser, it is a
 * filter that stops an arbitrary string from becoming a bucket key. A hostname,
 * a quoted string or a header injection all fail here.
 */
export function isIp(value: string): boolean {
  if (!value || value.length > 45) return false;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  // IPv6, including IPv4-mapped and compressed forms
  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(":") && !value.includes(":::");
}

export interface ClientIp {
  /** The address, or null when nothing trustworthy was available. */
  ip: string | null;
  /** Which header it came from. Logged alongside the hash so a misconfiguration is diagnosable. */
  source: "cf-connecting-ip" | "x-vercel-forwarded-for" | "x-real-ip" | "none";
}

/**
 * Resolve the client address from request headers.
 *
 * Order matters, and it is not the order most implementations use:
 *   1. `cf-connecting-ip` — set by Cloudflare's edge, cannot be spoofed once
 *      traffic passes through it.
 *   2. `x-vercel-forwarded-for` — Vercel's own copy, distinct from the
 *      client-controlled `x-forwarded-for`.
 *   3. `x-real-ip` — nginx and some proxies.
 *
 * Plain `x-forwarded-for` is only consulted behind a trusted proxy, and then the
 * *last* entry is used, because that is the one the proxy appended. The first
 * entry is the client's own claim and is worthless.
 */
export function resolveClientIp(headers: Headers): ClientIp {
  const cf = headers.get("cf-connecting-ip");
  if (cf) {
    const ip = firstValid([cf]);
    if (ip) return { ip, source: "cf-connecting-ip" };
  }

  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const ip = firstValid(vercel.split(",").reverse());
    if (ip) return { ip, source: "x-vercel-forwarded-for" };
  }

  const real = headers.get("x-real-ip");
  if (real) {
    const ip = firstValid([real]);
    if (ip) return { ip, source: "x-real-ip" };
  }

  if (trustedProxyHeaders()) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      // Last entry: appended by the proxy we trust. First is client-supplied.
      const ip = firstValid(forwarded.split(",").reverse());
      if (ip) return { ip, source: "x-vercel-forwarded-for" };
    }
  }

  return { ip: null, source: "none" };
}

/**
 * Hash an IP before it is stored.
 *
 * The salt is server-side and is not the same as any other secret. Without it a
 * hash of an IPv4 address is trivially reversible by enumerating 2^32 values, so
 * an unsalted "privacy-preserving" hash is not privacy-preserving at all.
 */
export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return hashValue(`ip:${ip}`);
}

/** Hash a first-party device identifier. */
export function hashDevice(deviceId: string | null | undefined): string | null {
  if (!deviceId) return null;
  return hashValue(`device:${deviceId}`);
}

function hashValue(input: string): string {
  const salt = process.env.ABUSE_HASH_SALT?.trim() ?? "";
  if (!salt) {
    // Without a salt the hash is reversible, so this must be loud. Returning a
    // value anyway keeps the site working; the warning is what gets it fixed.
    console.warn(
      "[security] ABUSE_HASH_SALT is not set: IP and device hashes are unsalted and therefore reversible.",
    );
  }
  return createHash("sha256").update(`${salt}|${input}`).digest("hex");
}

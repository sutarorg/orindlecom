/**
 * Redirect-safety helpers.
 *
 * Every `next`, `redirectTo` and `returnTo` parameter is attacker-controlled.
 * An unchecked value turns the login form into an open redirect, so all of them
 * pass through here before being used.
 */

const ALLOWED_PREFIXES = ["/", "/pricing", "/features", "/account"];

/**
 * Returns a safe same-origin path, or the fallback.
 *
 * Rejects protocol-relative (`//evil.com`), absolute URLs, and anything with a
 * scheme. The check is on the parsed value, not a string prefix, because
 * `/\\evil.com` and `/%2F%2Fevil.com` both defeat naive prefix matching.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;

  // Must be root-relative and must not start a protocol-relative URL.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  let parsed: URL;
  try {
    // A throwaway origin makes a relative path parseable so we can inspect the
    // normalised result — `/a/../../evil` and encoded slashes resolve here.
    parsed = new URL(value, "https://orindle.invalid");
  } catch {
    return fallback;
  }

  if (parsed.origin !== "https://orindle.invalid") return fallback;

  // Reject anything that normalised into a protocol-relative path.
  if (parsed.pathname.startsWith("//")) return fallback;

  const candidate = `${parsed.pathname}${parsed.search}${parsed.hash}`;

  // Only destinations we actually serve. An unexpected path is more likely a
  // mistake or an attack than a valid request.
  const isAllowed =
    candidate === "/" || ALLOWED_PREFIXES.some((prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`));

  return isAllowed ? candidate : fallback;
}

/** Builds the absolute URL Supabase should send the visitor back to. */
export function absoluteUrl(path: string, origin: string): string {
  return new URL(path, origin).toString();
}

/**
 * Resolves the request origin, honouring a reverse proxy.
 *
 * When deployed behind Vercel or Cloudflare these headers are set for us; when
 * they are absent the fallback keeps local development working.
 */
export function resolveOrigin(headers: Headers, fallback = "http://localhost:3000"): string {
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }
  const host = headers.get("host");
  if (host) {
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? fallback;
}

/**
 * Site-wide SEO constants.
 *
 * One file for anything a search engine, a social card or a crawler reads. The
 * point is that a canonical host, a default social image or a title suffix should
 * exist in exactly one place — the failure mode this prevents is the one every
 * site eventually ships: the sitemap saying `www.` while the canonical says the
 * apex, and Google picking neither.
 */

/** The one hostname this site is served from. Never depend on the request host. */
export const CANONICAL_ORIGIN = "https://orindle.com";

/** Documented in docs/seo/canonical-url-map.md, enforced by tests/unit/seo.test.ts. */
export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en";

/**
 * Default social image.
 *
 * 1200×630 is the size Facebook, LinkedIn, X and Slack all crop from without
 * letterboxing. Generated once and checked in, not composed per request: a social
 * crawler will not wait for an image pipeline, and a slow OG image is a blank one.
 */
export const DEFAULT_OG_IMAGE = {
  path: "/images/og/orindle-og.png",
  width: 1200,
  height: 630,
  alt: "Orindle — secure cloud storage with 10 GB free",
} as const;

/**
 * Route → indexable status.
 *
 * Private routes are listed here as well as being gated by middleware, because
 * the two defences fail differently: middleware stops the content existing,
 * `noindex` stops a URL that leaked into a sitemap elsewhere from being indexed.
 * Neither is sufficient alone.
 */
export const PRIVATE_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/login",
  "/signup",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth",
] as const;

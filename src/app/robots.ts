import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/config/seo";

/**
 * robots.txt
 *
 * Two rules, kept deliberately small.
 *
 * 1. Nothing that renders the site is blocked. CSS, JavaScript, fonts and images
 *    are all needed to render a page the way a user sees it, and Google renders
 *    pages before indexing. A `Disallow: /_next/` line — a very common template
 *    copy-paste — makes a site look broken to the crawler and is the most frequent
 *    self-inflicted technical SEO wound there is.
 *
 * 2. Private areas are disallowed *and* carry `noindex`. robots.txt alone does not
 *    prevent a known URL from appearing in results; it only prevents discovery.
 *    The combination is what actually works, and the middleware gate is the third
 *    layer, because none of the three is sufficient on its own.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/account",
          // The admin console. Disallowed here AND noindex in its layout, because
          // robots.txt prevents discovery and noindex prevents indexing of a URL
          // that is already known. Neither is sufficient alone.
          "/admin",
          "/admin/",
          "/access-denied",
          "/api/",
          "/login",
          "/signup",
          "/sign-in",
          "/sign-up",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/auth/",
        ],
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    host: CANONICAL_ORIGIN,
  };
}

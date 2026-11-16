import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Account entry points carry no indexable content.
        disallow: ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/auth", "/api/auth"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}

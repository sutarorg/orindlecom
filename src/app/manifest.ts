import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

/**
 * Web app manifest.
 *
 * A manifest is not an SEO signal, but it is what a browser uses for the icon on
 * a home screen or a pinned tab, and a site that looks unmaintained in a tab strip
 * loses trust at the exact moment it is being evaluated. Both icons are square,
 * 512px and high-contrast; the maskable variant keeps the glyph inside the safe
 * zone so an Android launcher does not clip the cloud.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3178fb",
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

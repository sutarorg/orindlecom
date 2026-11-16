import type { Metadata } from "next";
import { CANONICAL_ORIGIN, DEFAULT_OG_IMAGE, SITE_LOCALE } from "@/config/seo";
import { SITE } from "@/config/site";
import type { PageSeo } from "@/config/seo-pages";

/**
 * Builds page metadata: canonical, Open Graph, Twitter card, keywords, robots.
 *
 * Titles go through the root layout's `%s · Orindle` template, so the caller
 * passes the title without the brand — which is what keeps `Orindle` from
 * appearing twice in a `document.title` that a stakeholder wrote by hand.
 *
 * Images are always absolute. A relative `og:image` is silently dropped by most
 * social crawlers, and the failure is invisible: the card renders with no image
 * and nobody notices until someone shares the page.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  image,
  noIndex = false,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[];
  image?: { path: string; width: number; height: number; alt: string };
  noIndex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = canonicalUrl(path);
  const social = image ?? DEFAULT_OG_IMAGE;
  const ogTitle = `${title} · ${SITE.name}`;

  return {
    title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: { canonical: url },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : { index: true, follow: true },
    openGraph: {
      type,
      url,
      siteName: SITE.name,
      title: ogTitle,
      description,
      locale: SITE_LOCALE,
      images: [
        {
          url: `${CANONICAL_ORIGIN}${social.path}`,
          width: social.width,
          height: social.height,
          alt: social.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [`${CANONICAL_ORIGIN}${social.path}`],
    },
  };
}

/**
 * Convenience wrapper for a route whose metadata was approved as data.
 *
 * Used by every marketing page, so a page cannot accidentally ship a hand-typed
 * description that diverges from the approved one in `seo-pages.ts`.
 */
export function approvedMetadata(
  page: PageSeo,
  extra?: { image?: { path: string; width: number; height: number; alt: string } },
): Metadata {
  return pageMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    keywords: page.metaKeywords,
    image: extra?.image,
  });
}

/**
 * Absolute canonical for a path.
 *
 * The root resolves to the bare origin, without a trailing slash. That is not a
 * stylistic preference: Next's metadata resolver normalises a canonical equal to
 * the origin by dropping the slash, so `https://orindle.com/` cannot be emitted
 * from per-page metadata at all. Rather than ship a canonical and a sitemap entry
 * that differ by one character, both use this function and both say
 * `https://orindle.com`. Search engines treat the two forms identically; humans
 * auditing the HTML should not have to.
 */
export function canonicalUrl(path: string): string {
  if (path === "/" || path === "") return CANONICAL_ORIGIN;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${CANONICAL_ORIGIN}${clean.replace(/\/+$/, "")}`;
}

import type { Metadata } from "next";
import { SITE } from "@/config/site";

/**
 * Builds page metadata with a canonical URL, Open Graph and Twitter card.
 * Titles follow the "Page · Orindle" template declared in the root layout.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const url = `${SITE.url}${path === "/" ? "" : path}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: SITE.name,
      title: `${title} · ${SITE.name}`,
      description,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE.name}`,
      description,
    },
  };
}

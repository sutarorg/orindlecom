import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CANONICAL_ORIGIN, DEFAULT_OG_IMAGE, SITE_LANGUAGE, SITE_LOCALE } from "@/config/seo";
import { SITE } from "@/config/site";

/**
 * Root metadata.
 *
 * `metadataBase` is set to the canonical origin rather than left to the request
 * host. Without it, Next resolves relative canonical and Open Graph URLs against
 * whatever host served the page — which on a preview deployment means the social
 * card and the canonical both point at a `*.vercel.app` URL. That is the single
 * most common way a Next site ships the wrong canonical, and it is silent.
 *
 * The title template appends the brand once. Every page supplies its approved title
 * without the suffix, so ` · Orindle` appears exactly once and never doubles.
 */
export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: {
    default: "Secure Cloud Storage with 10 GB Free · Orindle",
    template: "%s · Orindle",
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: CANONICAL_ORIGIN }],
  creator: SITE.name,
  publisher: SITE.name,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE_LOCALE,
    url: `${CANONICAL_ORIGIN}/`,
    title: "Secure Cloud Storage with 10 GB Free · Orindle",
    description: SITE.description,
    images: [
      {
        url: `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE.path}`,
        width: DEFAULT_OG_IMAGE.width,
        height: DEFAULT_OG_IMAGE.height,
        alt: DEFAULT_OG_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Secure Cloud Storage with 10 GB Free · Orindle",
    description: SITE.description,
    images: [`${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE.path}`],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171d3a" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE_LANGUAGE}>
      <body>{children}</body>
    </html>
  );
}

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CtaBand } from "@/components/marketing/cta-band";
import { FeatureTrio } from "@/components/marketing/feature-trio";
import { Hero } from "@/components/marketing/hero";
import { StorageBand } from "@/components/marketing/storage-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { PricingSection } from "@/components/pricing/pricing-section";
import { ProductPreview } from "@/components/marketing/product-preview";
import { HOME_FAQ } from "@/config/faq";
import { PAGE_SEO } from "@/config/seo-pages";
import { CANONICAL_ORIGIN } from "@/config/seo";
import { SITE } from "@/config/site";
import { approvedMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { DEFAULT_CURRENCY, currencyForRegion } from "@/config/pricing";
import { cookies } from "next/headers";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.home);

/**
 * WebSite structured data.
 *
 * Only the site itself is described — name, alternate name, URL, language and the
 * site-wide search action the product genuinely supports. No Organization block
 * with a fabricated registered name or address, and deliberately no `potentialAction`
 * for a search endpoint that does not exist.
 */
const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${CANONICAL_ORIGIN}/#website`,
  name: SITE.name,
  alternateName: "Orindle Cloud",
  url: `${CANONICAL_ORIGIN}/`,
  description: PAGE_SEO.home.description,
  inLanguage: "en",
  publisher: { "@id": `${CANONICAL_ORIGIN}/#organization` },
};

/**
 * Organization structured data.
 *
 * Every property here is verifiable: the name, the URL, the logo that exists at
 * that path, and the support address published on the contact page. Nothing is
 * invented — no registration number, no address, no founding date — because
 * fabricating those is both a trust problem and a manual-action risk.
 */
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${CANONICAL_ORIGIN}/#organization`,
  name: SITE.name,
  url: `${CANONICAL_ORIGIN}/`,
  logo: {
    "@type": "ImageObject",
    url: `${CANONICAL_ORIGIN}/icon.png`,
    width: 512,
    height: 512,
  },
  email: SITE.supportEmail,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: SITE.supportEmail,
    url: `${CANONICAL_ORIGIN}/contact`,
    availableLanguage: ["en"],
  },
};

export default async function HomePage() {
  const store = await cookies();
  const cookieCurrency = store.get("orindle_currency")?.value;
  const currency =
    (cookieCurrency as ReturnType<typeof currencyForRegion> | undefined) ??
    DEFAULT_CURRENCY;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([WEBSITE_SCHEMA, ORGANIZATION_SCHEMA]) }}
      />
      <SiteHeader />
      <main id="main">
        <Hero />
        <FeatureTrio />
        <StorageBand />
        <ProductPreview />
        <PricingSection initialCurrency={currency} />
        <FaqSection items={HOME_FAQ} title="Questions, answered." />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}

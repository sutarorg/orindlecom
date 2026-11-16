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
import { DEFAULT_CURRENCY, currencyForRegion } from "@/config/pricing";
import { cookies } from "next/headers";

export default async function HomePage() {
  const store = await cookies();
  const cookieCurrency = store.get("orindle_currency")?.value;
  const currency =
    (cookieCurrency as ReturnType<typeof currencyForRegion> | undefined) ??
    DEFAULT_CURRENCY;

  return (
    <>
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

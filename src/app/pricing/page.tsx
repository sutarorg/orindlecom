import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { PricingSection } from "@/components/pricing/pricing-section";
import { ComparisonTable } from "@/components/pricing/comparison-table";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { ALL_FAQ } from "@/config/faq";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";
import { resolveRequestCurrency } from "@/lib/geo/currency";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.pricing);

export const dynamic = "force-dynamic";

const PRICING_FAQ = ALL_FAQ.filter((item) =>
  ["Billing", "Storage & plans"].includes(item.category),
);

export default async function PricingPage() {
  const currency = await resolveRequestCurrency();

  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.7),rgba(224,240,246,0.4)_45%,rgba(255,255,255,0)_72%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Plans"
            title="Room for every kind of digital life."
            description="Straightforward storage from 10 GB free up to 5 TB, billed monthly or annually (save 20%) in your local currency."
          />
        </div>
      </section>

      <PricingSection currency={currency} className="pt-6 sm:pt-8 lg:pt-10" />

      <ComparisonTable currency={currency} />

      <FaqSection
        items={PRICING_FAQ}
        title="Pricing questions."
        description="Currency, billing period and what happens when you change plans."
      />

      <CtaBand />
    </SiteShell>
  );
}

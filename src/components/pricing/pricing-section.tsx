"use client";

import * as React from "react";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  PLANS,
  currencyMeta,
  isCurrencyPublished,
  type BillingPeriod,
  type CurrencyCode,
} from "@/config/pricing";
import { PlanCard } from "./plan-card";
import { BillingToggle, CurrencyNotice, CurrencySelector } from "./pricing-controls";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

/**
 * Pricing block.
 *
 * Matches the reference's composition: centred heading, subhead, a small
 * segmented Monthly/Yearly pill, then all six plans in a single row with Plus
 * highlighted in place (3rd position). No 2 TB tier, no invented annual prices.
 */
export function PricingSection({
  initialCurrency = DEFAULT_CURRENCY,
  showCurrencySelector = true,
  className,
}: {
  initialCurrency?: CurrencyCode;
  showCurrencySelector?: boolean;
  className?: string;
}) {
  const [billing, setBilling] = React.useState<BillingPeriod>("monthly");
  const [currency, setCurrency] = React.useState<CurrencyCode>(initialCurrency);

  // Persist the visitor's choice so a reload keeps their region. A stored
  // subscriber's billing currency is never rewritten by this.
  const changeCurrency = (next: CurrencyCode) => {
    setCurrency(next);
    document.cookie = `orindle_currency=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  const yearlyUnapproved = CURRENCIES.length > 0 && PLANS.every((p) => p.yearly === null);

  return (
    <section
      id="plans"
      className={cn("relative overflow-hidden py-12 sm:py-16 lg:py-20", className)}
    >
      <div className="container-or">
        <div className="mx-auto max-w-[560px] text-center">
          <SectionHeading>Room for every kind of digital life.</SectionHeading>
          <p className="mt-2.5 text-[length:var(--brand-body-size)] leading-[1.5] tracking-[-0.02em] text-text-muted">
            Start free. Find the space that feels right.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <BillingToggle value={billing} onChange={setBilling} />
          {showCurrencySelector && (
            <CurrencySelector value={currency} onChange={changeCurrency} />
          )}
        </div>

        {billing === "yearly" && yearlyUnapproved && (
          <p
            role="status"
            className="mx-auto mt-3 max-w-[440px] text-center text-[11.5px] leading-relaxed text-text-muted"
          >
            Annual pricing is not announced yet, so the monthly rate is shown. You will always
            see the exact amount before any payment is taken.
          </p>
        )}

        <CurrencyNotice currency={currency} />

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:mt-10 xl:grid-cols-6 xl:gap-3.5">
          {PLANS.map((plan) => (
            <li key={plan.id} className="flex">
              <PlanCard
                plan={plan}
                billing={billing}
                currency={currency}
                highlighted={plan.id === "plus"}
                className="w-full"
              />
            </li>
          ))}
        </ul>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-text-subtle">
          Storage is shared across every device you sign in on. Prices shown in{" "}
          {currencyMeta(currency).code} for {currencyMeta(currency).region}. No credit card
          required to start.
        </p>
      </div>
    </section>
  );
}

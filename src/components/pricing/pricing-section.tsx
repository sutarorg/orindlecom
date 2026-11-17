"use client";

import * as React from "react";
import {
  DEFAULT_CURRENCY,
  HIGHLIGHTED_PLAN,
  PLANS,
  type BillingPeriod,
  type CurrencyCode,
} from "@/config/pricing";
import { PlanCard } from "./plan-card";
import { BillingToggle, CurrencyBadge, CurrencyNotice } from "./pricing-controls";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

/**
 * Pricing block.
 *
 * Six storage tiers (10 GB Free through 5 TB Max) with Premium (1 TB)
 * highlighted as Most Popular, monthly and annual (20% off) billing, and
 * automatic location-based currency (non-editable; defaults to USD for
 * countries outside the 8 supported currency regions).
 */
export function PricingSection({
  currency = DEFAULT_CURRENCY,
  className,
}: {
  currency?: CurrencyCode;
  className?: string;
}) {
  const [billing, setBilling] = React.useState<BillingPeriod>("monthly");

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
          <CurrencyBadge currency={currency} />
        </div>

        <CurrencyNotice currency={currency} />

        {/*
          Two columns from `sm` upward, which on desktop gives three rows of two
          rather than a single horizontal strip of six. Six cards in one row forced
          every price onto one line at ~150px wide; at two across the card has room
          for the capacity and the annual equivalent to sit on their own baselines.
          Below `sm` it stays one column, because a two-column grid of these cards at
          360px is unreadable, and below `sm` the longest card content ("Premium",
          "$59.99 /mo", a full-width CTA) needs roughly 300px to avoid wrapping.
        */}
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-10 lg:gap-5">
          {PLANS.map((plan) => (
            <li key={plan.id} className="flex">
              <PlanCard
                plan={plan}
                billing={billing}
                currency={currency}
                highlighted={plan.id === HIGHLIGHTED_PLAN}
                className="w-full"
              />
            </li>
          ))}
        </ul>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-text-subtle">
          Storage is shared across every device you sign in on. Prices are shown automatically for
          your location. Save 20% with annual billing. No credit card required to start.
        </p>
      </div>
    </section>
  );
}

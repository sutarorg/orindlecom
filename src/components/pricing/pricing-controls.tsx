"use client";

import * as React from "react";
import {
  ANNUAL_DISCOUNT_PCT,
  isCurrencyPublished,
  type BillingPeriod,
  type CurrencyCode,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Monthly / Yearly segmented control                                 */
/* ------------------------------------------------------------------ */

export function BillingToggle({
  value,
  onChange,
  className,
  size = "default",
}: {
  value: BillingPeriod;
  onChange: (next: BillingPeriod) => void;
  className?: string;
  size?: "default" | "large";
}) {
  const options: { id: BillingPeriod; label: string; badge?: string }[] = [
    { id: "monthly", label: "Monthly" },
    {
      id: "yearly",
      label: "Yearly",
      badge: ANNUAL_DISCOUNT_PCT > 0 ? `Save ${ANNUAL_DISCOUNT_PCT}%` : undefined,
    },
  ];

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onChange(value === "monthly" ? "yearly" : "monthly");
  };

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--brand-border)] bg-white p-[3px]",
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full font-semibold leading-none transition-colors duration-150",
              size === "large" ? "h-8 px-4 text-[12.5px]" : "h-[28px] px-3.5 text-[11px]",
              selected
                ? "bg-primary text-white shadow-[var(--brand-shadow-primary)]"
                : "text-ink hover:bg-[var(--brand-surface-muted)]",
            )}
          >
            <span>{option.label}</span>
            {option.badge && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-[2px] text-[9.5px] font-bold leading-none",
                  selected
                    ? "bg-white/20 text-white"
                    : "bg-[#EAF9F1] text-[#1B7F4B]",
                )}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Read-only location currency badge                                  */
/* ------------------------------------------------------------------ */

/** Honest notice shown whenever a currency has no approved price table. */
export function CurrencyNotice({ currency }: { currency: CurrencyCode }) {
  if (isCurrencyPublished(currency)) return null;
  return (
    <p
      role="status"
      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-surface-muted)] px-3 py-1.5 text-[11.5px] text-text-muted"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9A53B]" />
      Pricing for your region is being finalised. Amounts below are shown for reference only.
    </p>
  );
}

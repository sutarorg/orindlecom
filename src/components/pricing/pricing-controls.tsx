"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  ANNUAL_DISCOUNT_PCT,
  CURRENCIES,
  currencyMeta,
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
/*  Currency selector                                                  */
/* ------------------------------------------------------------------ */

export function CurrencySelector({
  value,
  onChange,
  className,
}: {
  value: CurrencyCode;
  onChange: (next: CurrencyCode) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const meta = currencyMeta(value);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Display currency: ${meta.label}. Change currency`}
        className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[var(--brand-border)] bg-white px-3 text-[11.5px] font-semibold leading-none text-ink transition-colors hover:bg-[var(--brand-surface-muted)]"
      >
        <span className="text-[12px] text-text-muted">{meta.symbol.trim()}</span>
        <span>{meta.code}</span>
        <ChevronDown
          className={cn("h-3 w-3 text-text-subtle transition-transform", open && "rotate-180")}
          strokeWidth={2.4}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Display currency"
          className="absolute right-0 z-40 mt-2 w-[248px] overflow-hidden rounded-[12px] border border-[var(--brand-border)] bg-white p-1 shadow-[var(--brand-shadow-lg)]"
        >
          {CURRENCIES.map((currency) => {
            const selected = currency.code === value;
            const published = isCurrencyPublished(currency.code);
            return (
              <li key={currency.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(currency.code);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors",
                    selected ? "bg-primary-soft" : "hover:bg-[var(--brand-surface-muted)]",
                  )}
                >
                  <span className="w-7 shrink-0 text-center text-[11px] font-medium text-text-muted">
                    {currency.symbol.trim()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold leading-tight text-ink">
                      {currency.code}
                      <span className="ml-1.5 font-normal text-text-subtle">
                        {currency.region}
                      </span>
                    </span>
                    {!published && (
                      <span className="mt-0.5 block text-[10px] leading-tight text-text-subtle">
                        Pricing being finalised
                      </span>
                    )}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Honest notice shown whenever a currency has no approved price table. */
export function CurrencyNotice({ currency }: { currency: CurrencyCode }) {
  if (isCurrencyPublished(currency)) return null;
  const meta = currencyMeta(currency);
  return (
    <p
      role="status"
      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-surface-muted)] px-3 py-1.5 text-[11.5px] text-text-muted"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#F9A53B]" />
      {meta.code} pricing is being finalised. Amounts below are shown for reference only.
    </p>
  );
}

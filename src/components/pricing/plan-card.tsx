import Link from "next/link";
import { PlanIcon } from "@/components/brand/plan-icon";
import {
  currencyMeta,
  formatPrice,
  resolveAnnualTotal,
  resolvePrice,
  type BillingPeriod,
  type CurrencyCode,
  type Plan,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

/**
 * Plan card.
 *
 * Displays icon → name → capacity → price (monthly or annual per-month
 * equivalent with billed-yearly total) → CTA pinned to the bottom. The
 * highlighted card (Premium · 1 TB) carries a 2px primary border, shadow and
 * "Most Popular" pill.
 *
 * Laid out for a two-up grid. The type scale and the 44px CTA here are sized for
 * a ~590px card; the previous scale (9.5px label, 19px icon, 27px CTA) was tuned
 * when six cards shared one row and each was ~150px wide. Widening the grid
 * without rescaling left the cards looking shrunken in the middle of a large
 * empty box, so capacity and price are now set on a shared baseline across the
 * card's width, which is what the extra room is for.
 *
 * Note: plan features are not listed here because the product has not published
 * a per-plan feature matrix — `Plan` carries no features field, and inventing
 * rows to fill space would be fabricating what each plan includes.
 */
export function PlanCard({
  plan,
  billing,
  currency,
  highlighted = false,
  className,
}: {
  plan: Plan;
  billing: BillingPeriod;
  currency: CurrencyCode;
  highlighted?: boolean;
  className?: string;
}) {
  const price = resolvePrice(plan, currency, billing);
  const annualTotal = billing === "yearly" ? resolveAnnualTotal(plan, currency) : null;
  const published = price !== null;
  const isFree = published && price === 0;
  const meta = currencyMeta(currency);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl p-5 sm:p-6 transition-[box-shadow,border-color,transform] duration-200 ease-[var(--brand-ease-out)]",
        highlighted
          ? "border-2 border-primary bg-white shadow-[0_18px_36px_-20px_rgba(49,120,251,0.55)]"
          : "border border-[var(--brand-border)] bg-white/70 hover:border-[var(--brand-border-strong)] hover:shadow-[var(--brand-shadow-sm)]",
        className,
      )}
    >
      {highlighted && (
        <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10.5px] font-semibold leading-none tracking-[0.01em] text-white">
          Most Popular
        </span>
      )}

      <div className="flex items-center gap-2.5">
        <PlanIcon name={plan.icon} accent={plan.accent} className="h-[22px] w-[22px]" />

        <p className="text-[13px] font-semibold leading-none tracking-[-0.01em] text-text-muted">
          {plan.name}
        </p>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">
          {plan.storage}
        </p>

        <div className="text-right">
          {published ? (
            <>
              <p className="flex items-baseline justify-end gap-px text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink [font-variant-numeric:tabular-nums]">
                {formatPrice(price, currency)}
                {!isFree && (
                  <span className="text-[12px] font-medium tracking-[-0.01em] text-text-subtle">
                    /mo
                  </span>
                )}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-text-subtle">
                {isFree
                  ? "Free forever"
                  : billing === "yearly" && annualTotal !== null
                    ? `${formatPrice(annualTotal, currency)}/yr · save 20%`
                    : `${meta.code} · billed monthly`}
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold leading-none text-text-muted">
                Being finalised
              </p>
              <p className="mt-1.5 text-[11.5px] leading-snug text-text-subtle">
                {meta.code} pricing not yet published
              </p>
            </>
          )}
        </div>
      </div>

      <Link
        href={plan.id === "free" ? "/signup" : `/signup?plan=${plan.id}`}
        className={cn(
          "mt-6 inline-flex h-11 items-center justify-center rounded-full text-[13px] font-semibold leading-none tracking-[-0.005em] transition-colors duration-150",
          highlighted
            ? "bg-primary text-white shadow-[var(--brand-shadow-primary)] hover:bg-primary-hover"
            : "border border-[var(--brand-border-strong)] text-ink hover:bg-[var(--brand-surface-muted)]",
        )}
      >
        {plan.ctaLabel}
      </Link>

    </div>
  );
}

import Link from "next/link";
import { PlanIcon } from "@/components/brand/plan-icon";
import {
  currencyMeta,
  formatPrice,
  resolvePrice,
  type BillingPeriod,
  type CurrencyCode,
  type Plan,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

/**
 * Plan card.
 *
 * Measured from the reference at 941px: 134px wide, 156px tall, 14px radius,
 * 14px padding, internal order icon → name → capacity → price → CTA pinned to
 * the bottom. The highlighted card carries a 2px primary border, a shadow and
 * a "Most Popular" pill on its top edge.
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
  const published = price !== null;
  const isFree = published && price === 0;
  const meta = currencyMeta(currency);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[14px] p-4 transition-[box-shadow,border-color,transform] duration-200 ease-[var(--brand-ease-out)]",
        highlighted
          ? "border-2 border-primary bg-white shadow-[0_18px_36px_-20px_rgba(49,120,251,0.55)]"
          : "border border-[var(--brand-border)] bg-white/70 hover:border-[var(--brand-border-strong)] hover:shadow-[var(--brand-shadow-sm)]",
        className,
      )}
    >
      {highlighted && (
        <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-[3px] text-[9.5px] font-semibold leading-none tracking-[0.01em] text-white">
          Most Popular
        </span>
      )}

      <PlanIcon name={plan.icon} accent={plan.accent} className="h-[19px] w-[19px]" />

      <p className="mt-3 text-[11.5px] font-semibold leading-none tracking-[-0.01em] text-text-muted">
        {plan.name}
      </p>

      <p className="mt-2 text-[15px] font-extrabold leading-none tracking-[-0.03em] text-ink">
        {plan.storage}
      </p>

      <div className="mt-2.5 min-h-[38px]">
        {published ? (
          <>
            <p className="flex items-baseline gap-[2px] text-[17px] font-extrabold leading-none tracking-[-0.035em] text-ink [font-variant-numeric:tabular-nums]">
              {formatPrice(price, currency)}
              {!isFree && (
                <span className="text-[10px] font-medium tracking-[-0.01em] text-text-subtle">
                  /mo
                </span>
              )}
            </p>
            <p className="mt-1 text-[10px] leading-none text-text-subtle">
              {isFree ? "Free forever" : `${meta.code} · billed monthly`}
            </p>
          </>
        ) : (
          <>
            <p className="text-[12px] font-semibold leading-none text-text-muted">
              Being finalised
            </p>
            <p className="mt-1 text-[10px] leading-none text-text-subtle">
              {meta.code} pricing not yet published
            </p>
          </>
        )}
      </div>

      <Link
        href={plan.id === "free" ? "/signup" : `/signup?plan=${plan.id}`}
        className={cn(
          "mt-4 inline-flex h-[27px] items-center justify-center rounded-full text-[10.5px] font-semibold leading-none tracking-[-0.005em] transition-colors duration-150",
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

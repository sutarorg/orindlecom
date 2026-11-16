import { Check, Minus } from "lucide-react";
import { PLANS, currencyMeta, formatPrice, resolvePrice, type CurrencyCode } from "@/config/pricing";
import { PlanIcon } from "@/components/brand/plan-icon";
import { cn } from "@/lib/utils";

/**
 * Feature comparison.
 *
 * Every row states something the product genuinely does. Rows that differ by
 * tier are only those that really are tier-dependent (storage volume).
 * Above 768px this is a table; below, each plan becomes its own card so nothing
 * requires horizontal scrolling.
 */

type Support = "yes" | "no" | string;

const ROWS: { feature: string; get: (planId: string) => Support }[] = [
  { feature: "Shared storage pool", get: () => "yes" },
  { feature: "Folders and nested structure", get: () => "yes" },
  { feature: "Share by invitation or link", get: () => "yes" },
  { feature: "View and edit permissions", get: () => "yes" },
  { feature: "Trash with recovery", get: () => "yes" },
  { feature: "Access from any browser", get: () => "yes" },
  { feature: "Encryption in transit and at rest", get: () => "yes" },
  { feature: "Organisation accounts", get: () => "separate plan" },
  { feature: "Priority support", get: () => "not yet available" },
];

export function ComparisonTable({ currency }: { currency: CurrencyCode }) {
  const meta = currencyMeta(currency);

  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <div className="container-or">
        <h2 className="text-[length:var(--brand-h2-size)] font-extrabold tracking-[var(--brand-h2-tracking)] text-ink">
          What changes between plans
        </h2>
        <p className="mt-2 max-w-[54ch] text-[length:var(--brand-body-size)] leading-[1.6] tracking-[var(--brand-body-tracking)] text-text-muted">
          Mostly, the amount of room. Everything below the storage line is part of every plan,
          including the free one.
        </p>

        {/* ---------- desktop table ---------- */}
        <div className="mt-7 hidden overflow-hidden rounded-[16px] border border-[var(--brand-border)] md:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Orindle plan comparison: storage and capabilities by tier
            </caption>
            <thead>
              <tr className="bg-[var(--brand-surface-muted)]">
                <th scope="col" className="w-[30%] px-4 py-3 text-[11.5px] font-semibold text-ink">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      "px-3 py-3 text-center align-bottom",
                      plan.id === "plus" && "bg-primary-soft/60",
                    )}
                  >
                    <span className="flex flex-col items-center gap-1.5">
                      <PlanIcon name={plan.icon} accent={plan.accent} className="h-4 w-4" />
                      <span className="text-[11.5px] font-semibold text-ink">{plan.name}</span>
                      <span className="text-[10.5px] text-text-muted">{plan.storage}</span>
                      <span className="text-[11px] font-bold tabular-nums text-ink">
                        {(() => {
                          const p = resolvePrice(plan, currency, "monthly");
                          return p === null ? "—" : formatPrice(p, currency);
                        })()}
                        <span className="font-normal text-text-subtle">/mo</span>
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, index) => (
                <tr
                  key={row.feature}
                  className={index % 2 === 1 ? "bg-[var(--brand-canvas)]" : "bg-white"}
                >
                  <th
                    scope="row"
                    className="border-t border-[var(--brand-border-soft)] px-4 py-2.5 text-[12px] font-medium text-text"
                  >
                    {row.feature}
                  </th>
                  {PLANS.map((plan) => {
                    const value = row.get(plan.id);
                    return (
                      <td
                        key={plan.id}
                        className={cn(
                          "border-t border-[var(--brand-border-soft)] px-3 py-2.5 text-center",
                          plan.id === "plus" && "bg-primary-soft/40",
                        )}
                      >
                        <CellValue value={value} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---------- mobile cards ---------- */}
        <div className="mt-6 grid gap-4 md:hidden">
          {PLANS.map((plan) => {
            const p = resolvePrice(plan, currency, "monthly");
            return (
              <div
                key={plan.id}
                className="rounded-[14px] border border-[var(--brand-border)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlanIcon name={plan.icon} accent={plan.accent} className="h-4 w-4" />
                    <span className="text-[13px] font-bold text-ink">{plan.name}</span>
                    <span className="text-[11px] text-text-muted">{plan.storage}</span>
                  </div>
                  <span className="text-[12.5px] font-bold tabular-nums text-ink">
                    {p === null ? "—" : formatPrice(p, currency)}
                    <span className="text-[10px] font-normal text-text-subtle">/mo</span>
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {ROWS.map((row) => {
                    const value = row.get(plan.id);
                    if (value === "no") return null;
                    return (
                      <li key={row.feature} className="flex items-start gap-2 text-[12px] text-text">
                        {value === "yes" ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34C77B]" strokeWidth={2.6} />
                        ) : (
                          <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-subtle" strokeWidth={2.6} />
                        )}
                        <span>
                          {row.feature}
                          {value !== "yes" && (
                            <span className="text-text-subtle"> — {value}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[11.5px] text-text-subtle">
          Prices displayed in {meta.code}. {meta.published ? "" : "This currency is not published yet."}
        </p>
      </div>
    </section>
  );
}

function CellValue({ value }: { value: Support }) {
  if (value === "yes") {
    return (
      <>
        <Check className="mx-auto h-4 w-4 text-[#34C77B]" strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === "no") {
    return (
      <>
        <Minus className="mx-auto h-4 w-4 text-[#C7CCDA]" strokeWidth={2.6} aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-[10.5px] leading-tight text-text-muted">{value}</span>;
}

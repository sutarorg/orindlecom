/**
 * Charts.
 *
 * Hand-written SVG rather than a charting dependency. The reasons are practical:
 *
 *   - one bar chart and one line does not justify 40 kB of JavaScript that then
 *     has to hydrate before the numbers appear;
 *   - a library would bring its own colours, and this product has a palette;
 *   - accessibility is easier to get right when the markup is ours.
 *
 * Every chart here carries a text summary in `aria-label` and a visually hidden
 * table of the same data, so the figure is available to a screen reader instead of
 * being a picture of a number.
 *
 * **Gaps are gaps.** A day with no data is rendered as a break, never as a line
 * drawn straight between two distant points — interpolating across missing days
 * invents a trend that was never measured.
 */

import { cn } from "@/lib/utils";
import { formatMoney, formatNumber } from "./admin-ui";

/* ------------------------------------------------------------------ */
/*  Bar chart                                                          */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
}

/**
 * Signups per day.
 *
 * The y-axis is scaled to the maximum value, with a stated axis top rather than a
 * "nice" round number, because guessing a round maximum is a small invention. A
 * zero-maximum series renders an honest flat baseline.
 */
export function SignupBars({
  data,
  caption,
}: {
  data: BarDatum[];
  caption: string;
}) {
  if (data.length === 0) {
    return <p className="text-[12px] text-text-muted">No days in this range.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <figure className="m-0">
      <div
        className="flex h-[132px] items-end gap-[3px]"
        role="img"
        aria-label={`${caption}. Total ${formatNumber(total)} over ${data.length} days, highest day ${formatNumber(max)}.`}
      >
        {data.map((datum) => {
          // A zero day still gets a 2px sliver so the axis reads as continuous
          // time rather than a series of absences.
          const height = max === 0 ? 2 : Math.max(2, Math.round((datum.value / max) * 124));
          return (
            <div
              key={datum.label}
              className="group relative flex-1"
              title={`${datum.label}: ${formatNumber(datum.value)}`}
            >
              <div
                className={cn(
                  "w-full rounded-t-[2px] transition-colors",
                  datum.value === 0 ? "bg-[var(--brand-border-soft)]" : "bg-primary/70 group-hover:bg-primary",
                )}
                style={{ height }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-text-subtle tabular-nums">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <figcaption className="mt-2 text-[11px] text-text-muted">
        {caption} · peak {formatNumber(max)} in a day · {formatNumber(total)} total
      </figcaption>

      {/* The same data, for assistive tech and for anyone who cannot see colour. */}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>{datum.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Proportional bar                                                   */
/* ------------------------------------------------------------------ */

/**
 * A horizontal bar that shows a share of a total.
 *
 * Used for plan distribution and storage by plan. The label carries the absolute
 * value as well, so the bar is a visual aid rather than the only source of the
 * number.
 */
export function ShareBar({
  label,
  value,
  total,
  formatted,
}: {
  label: string;
  value: number;
  total: number;
  formatted: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-semibold capitalize text-ink">{label}</span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-text-muted">
          {formatted} · {pct}%
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--brand-surface-muted)]"
        role="img"
        aria-label={`${label}: ${formatted}, ${pct} percent`}
      >
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Revenue rows                                                       */
/* ------------------------------------------------------------------ */

/**
 * Revenue by currency.
 *
 * One row per currency, never a total. Two amounts in different currencies added
 * together is not a number, it is a mistake with a currency symbol in front of it.
 */
export function CurrencyBreakdown({
  rows,
  label,
}: {
  rows: Array<{ currency: string; minor: number }>;
  label: string;
}) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-text-muted">{label}: nothing recorded yet.</p>;
  }

  return (
    <dl className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.currency} className="flex items-baseline justify-between gap-3">
          <dt className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-text-subtle">
            {row.currency}
          </dt>
          <dd className="text-[14px] font-bold tabular-nums text-ink">
            {formatMoney(row.minor, row.currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

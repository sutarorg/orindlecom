/**
 * Admin presentation primitives.
 *
 * Deliberately plain: white surfaces, 1px borders, 12–14px radii, tabular
 * numerals on anything countable or monetary. No gradients, no glow, no card
 * parade. An operator scanning for one number should not have to decode a design.
 *
 * These are server components — none of them holds state — so a page can render
 * its whole table without shipping a component to the browser.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/drive/format";

/* ------------------------------------------------------------------ */
/*  Page header                                                        */
/* ------------------------------------------------------------------ */

/**
 * Inline administrative link.
 *
 * A bare text link is 15–19px tall, which fails WCAG 2.5.8 (AA) pointer-target
 * sizing and is genuinely awkward to tap. Every small link in the console uses this
 * so the fix lives in one place: `inline-flex` + `min-h-6` (24px) with a little
 * horizontal padding, while the text keeps its 11.5px size so the density of a
 * table or a metric caption does not change.
 */
export const adminLinkClass =
  "inline-flex min-h-6 items-center px-0.5 font-semibold text-primary hover:underline";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[23px]">
          {title}
        </h1>
        <p className="mt-1 max-w-[640px] text-[12.5px] leading-relaxed text-text-muted">
          {description}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cards                                                              */
/* ------------------------------------------------------------------ */

export function AdminCard({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-[var(--brand-border)] bg-white shadow-[0_1px_2px_rgba(23,29,58,0.04)]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function AdminCardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13.5px] font-bold tracking-[-0.015em] text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * A metric card.
 *
 * `value` is a string, already formatted by the server. Formatting in the client
 * would risk a locale-dependent difference between what the API computed and what
 * the browser rendered.
 *
 * `hint` carries the qualifier that stops a number being misread — "INR only",
 * "2 subscriptions have no recorded period", "excludes refunds".
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <div className="rounded-[14px] border border-[var(--brand-border)] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
          tone === "positive" && "text-[#1B7F4B]",
          tone === "warning" && "text-[#96610B]",
          tone === "neutral" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] leading-snug text-text-subtle">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges                                                             */
/* ------------------------------------------------------------------ */

const BADGE_TONES = {
  neutral: "bg-[var(--brand-surface-muted)] text-text",
  blue: "bg-primary-soft text-primary-ink",
  green: "bg-[#EAF7F0] text-[#1B7F4B]",
  amber: "bg-[#FEFBF3] text-[#96610B]",
  red: "bg-[#FDF3F2] text-[#C93B2B]",
  violet: "bg-[#EFE9FD] text-[#5B3BB8]",
} as const;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

/**
 * Table shell.
 *
 * Horizontal scroll is contained to the table's own container, so a wide table
 * never makes the page scroll sideways. The scroll container is focusable
 * (`tabIndex=0` with a label) because a keyboard user cannot otherwise reach
 * content that only scrolls horizontally — a WCAG requirement that is usually
 * missed.
 */
export function TableShell({
  children,
  caption,
  columns,
}: {
  children: React.ReactNode;
  caption: string;
  columns: number;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--brand-border)] bg-white">
      <div
        className="overflow-x-auto"
        tabIndex={0}
        role="region"
        aria-label={`${caption} table, scrollable`}
      >
        <table className="w-full min-w-[var(--admin-table-min,640px)] border-collapse">
          <caption className="sr-only">{caption}</caption>
          {children}
        </table>
      </div>
      <span className="sr-only">{columns}</span>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-[var(--brand-border)] bg-[var(--brand-surface-muted)] px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] text-text-subtle whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
  numeric = false,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--brand-border-soft)] px-3 py-2.5 text-[12.5px] text-text last:border-b-0",
        align === "right" ? "text-right" : "text-left",
        numeric && "tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/**
 * Money, from integer minor units.
 *
 * `Intl.NumberFormat` is given the currency so the symbol and placement are
 * correct per currency, but the *amount* comes from an integer and is divided by
 * 100 exactly once. No float arithmetic is performed on the value itself.
 */
export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    // An unrecognised currency code must not crash a page.
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function formatBytesAdmin(bytes: number): string {
  return formatBytes(bytes);
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

/**
 * A table's empty state.
 *
 * `hint` exists because "no users match these filters" and "nobody has signed up
 * yet" are different situations, and only one of them suggests clearing a filter.
 */
export function TableEmpty({
  title,
  hint,
  colSpan,
  action,
}: {
  title: string;
  hint?: string;
  colSpan: number;
  action?: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <p className="text-[13px] font-bold text-ink">{title}</p>
        {hint && (
          <p className="mx-auto mt-1 max-w-[380px] text-[12px] leading-relaxed text-text-muted">
            {hint}
          </p>
        )}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */

/**
 * Server-driven pagination.
 *
 * Links, not buttons: each page is a URL that can be bookmarked, opened in a new
 * tab and re-fetched by the browser's back button without JavaScript.
 */
export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const linkClass =
    "inline-flex h-8 items-center rounded-lg border border-[var(--brand-border-strong)] px-2.5 text-[12px] font-semibold text-text transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const disabledClass =
    "inline-flex h-8 items-center rounded-lg border border-[var(--brand-border-soft)] px-2.5 text-[12px] font-semibold text-text-subtle opacity-50";

  return (
    <nav
      aria-label="Pagination"
      className="mt-3 flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-[11.5px] text-text-muted tabular-nums" aria-live="polite">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className={linkClass} rel="prev">
            Previous
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Previous
          </span>
        )}
        <span className="px-1 text-[11.5px] text-text-muted tabular-nums">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={buildHref(page + 1)} className={linkClass} rel="next">
            Next
          </Link>
        ) : (
          <span className={disabledClass} aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

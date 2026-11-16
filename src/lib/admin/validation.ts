/**
 * Query-parameter validation for the admin API.
 *
 * Every parameter that reaches SQL is bounded here first. The SQL functions are
 * parameterised and choose their sort column from a closed set, so this is the
 * second layer rather than the only one — but it is the layer that produces a
 * useful error message instead of a database error.
 *
 * The rule that matters: **an unrecognised value is rejected, not defaulted.**
 * A `sort=nonsense` that silently becomes `newest` teaches a client that its
 * parameters do not matter, and hides a bug until someone relies on one.
 */

import { AppError } from "@/domain/auth/errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidParam(value: string | null, name: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new AppError("validation_failed", `That ${name} isn't valid.`);
  }
  return value;
}

export function optionalUuid(value: string | null, name: string): string | null {
  if (!value) return null;
  return uuidParam(value, name);
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function pagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const rawPage = searchParams.get("page");
  const rawSize = searchParams.get("pageSize");

  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isInteger(page) || page < 1 || page > 10_000) {
    throw new AppError("validation_failed", "That page number isn't valid.");
  }

  const pageSize = rawSize === null ? DEFAULT_PAGE_SIZE : Number(rawSize);
  if (!(PAGE_SIZES as readonly number[]).includes(pageSize)) {
    throw new AppError("validation_failed", `Page size must be one of ${PAGE_SIZES.join(", ")}.`);
  }

  return { page, pageSize, offset: (page - 1) * pageSize };
}

/**
 * A closed set of sort orders.
 *
 * Not `string` with a runtime check in SQL: the set is declared once here and the
 * SQL uses CASE over exactly these tokens. A new sort therefore requires a change
 * in both places, which is what stops an ORDER BY from being built out of user
 * input.
 */
export function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T {
  if (value === null || value === "") return fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new AppError("validation_failed", `That ${name} isn't one of the supported values.`);
  }
  return value as T;
}

export function searchTerm(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) {
    throw new AppError("validation_failed", "That search is too long — keep it under 120 characters.");
  }
  return trimmed;
}

/**
 * A date range, bounded and ordered.
 *
 * `from > to` is a mistake worth reporting rather than an empty result that looks
 * like "no data exists".
 */
export function dateRange(
  from: string | null,
  to: string | null,
): { from: string | null; to: string | null } {
  const parse = (value: string | null, name: string) => {
    if (!value) return null;
    // ISO date or full timestamp. Anything else is not a date we wrote.
    if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(value)) {
      throw new AppError("validation_failed", `That ${name} date isn't valid.`);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new AppError("validation_failed", `That ${name} date isn't valid.`);
    }
    return date.toISOString();
  };

  const parsedFrom = parse(from, "start");
  const parsedTo = parse(to, "end");

  if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
    throw new AppError("validation_failed", "The start date is after the end date.");
  }

  return { from: parsedFrom, to: parsedTo };
}

/** Bounded day window for the growth chart. */
export function dayWindow(value: string | null): number {
  if (!value) return 30;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError("validation_failed", "That date range isn't valid.");
  }
  return days;
}

export const USER_SORTS = ["newest", "oldest", "storage"] as const;
export const PLANS = ["free", "basic", "plus", "premium", "ultra", "max"] as const;
export const SUB_STATUSES = ["none", "active", "past_due", "cancelled", "expired"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export const SUPPORT_CATEGORIES = ["sales", "support", "billing", "privacy", "other"] as const;

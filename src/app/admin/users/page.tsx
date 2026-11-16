/**
 * /admin/users — the account directory.
 *
 * Search, filters, sorting and pagination are all server-side. The page reads the
 * same query parameters the API validates, so a bookmarked filtered URL and an API
 * call resolve to the same rows.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdminPageContext } from "@/lib/admin/auth";
import { getUserDirectory } from "@/lib/admin/service";
import {
  PLANS,
  SUB_STATUSES,
  USER_SORTS,
  dateRange,
  oneOf,
  pagination,
  searchTerm,
} from "@/lib/admin/validation";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  AdminCard,
  AdminPageHeader,
  Badge,
  Pagination,
  TableEmpty,
  TableShell,
  Td,
  Th,
  formatBytesAdmin,
  formatDate,
  formatNumber,
} from "@/components/admin/admin-ui";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  ultra: "Ultra",
  max: "Max",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireAdminPageContext("view_operations");
  const params = await searchParams;

  const page = pagination(
    new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
  );

  const planParam = single(params.plan);
  const statusParam = single(params.status);
  const verifiedParam = single(params.verified);
  const range = dateRange(single(params.from), single(params.to));

  const query = {
    search: searchTerm(single(params.q)),
    plan: planParam ? oneOf(planParam, PLANS, "free", "plan") : null,
    verified: verifiedParam === "true" ? true : verifiedParam === "false" ? false : null,
    status: statusParam ? oneOf(statusParam, SUB_STATUSES, "none", "status") : null,
    createdAfter: range.from,
    createdBefore: range.to,
    sort: oneOf(single(params.sort), USER_SORTS, "newest", "sort"),
    ...page,
  };

  const result = await getUserDirectory(ctx, query);

  // The export link carries the same filters. Built from the same validated
  // values, not from the raw query string: an unvalidated passthrough would let a
  // crafted URL reach the export endpoint with parameters the page never accepted.
  const exportParams = new URLSearchParams();
  if (query.search) exportParams.set("q", query.search);
  if (query.plan) exportParams.set("plan", query.plan);
  if (query.status) exportParams.set("status", query.status);
  if (query.verified !== null) exportParams.set("verified", String(query.verified));
  if (range.from) exportParams.set("from", range.from.slice(0, 10));
  if (range.to) exportParams.set("to", range.to.slice(0, 10));
  if (query.sort !== "newest") exportParams.set("sort", query.sort);
  const exportHref = `/api/admin/users/export${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  const buildPageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "plan", "status", "verified", "from", "to", "sort", "pageSize"]) {
      const value = single(params[key]);
      if (value) next.set(key, value);
    }
    if (nextPage > 1) next.set("page", String(nextPage));
    const queryString = next.toString();
    return queryString ? `/admin/users?${queryString}` : "/admin/users";
  };

  const filtered = Boolean(
    query.search || query.plan || query.status || query.verified !== null || range.from || range.to,
  );

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Every registered account on the platform. Search and filters run against the whole table, not the current page."
        actions={
          <Link
            href="/admin/billing"
            className="inline-flex h-9 items-center rounded-lg border border-[var(--brand-border-strong)] px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Billing
          </Link>
        }
      />

      <FilterBar
        searchPlaceholder="Search email, name or user id"
        exportHref={exportHref}
        exportLabel="Export CSV"
        selects={[
          {
            name: "plan",
            label: "Filter by plan",
            allLabel: "All plans",
            options: PLANS.map((id) => ({ value: id, label: PLAN_LABELS[id] ?? id })),
          },
          {
            name: "verified",
            label: "Filter by email verification",
            allLabel: "Any verification",
            options: [
              { value: "true", label: "Verified" },
              { value: "false", label: "Unverified" },
            ],
          },
          {
            name: "status",
            label: "Filter by subscription status",
            allLabel: "Any subscription",
            options: SUB_STATUSES.map((status) => ({ value: status, label: status })),
          },
          {
            name: "sort",
            label: "Sort order",
            allLabel: "Newest first",
            options: [
              { value: "oldest", label: "Oldest first" },
              { value: "storage", label: "Most storage" },
            ],
          },
        ]}
      />

      <TableShell caption="Registered users" columns={7}>
        <thead>
          <tr>
            <Th>Account</Th>
            <Th>Plan</Th>
            <Th>Subscription</Th>
            <Th>Verified</Th>
            <Th align="right">Storage</Th>
            <Th>Joined</Th>
            <Th align="right">Detail</Th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <TableEmpty
              colSpan={7}
              title={filtered ? "No users match these filters" : "No accounts yet"}
              hint={
                filtered
                  ? "Nothing matched the search and filters above. Clearing them will show every account."
                  : "Registered accounts appear here as soon as someone signs up."
              }
            />
          ) : (
            result.rows.map((row) => (
              <tr key={row.userId} className="transition-colors hover:bg-[var(--brand-surface-muted)]">
                <Td>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-ink">
                      {row.fullName || row.email || "Unnamed account"}
                    </span>
                    <span className="truncate text-[11.5px] text-text-muted">{row.email ?? "—"}</span>
                  </span>
                </Td>
                <Td>
                  <Badge tone={row.planId === "free" ? "neutral" : "blue"}>
                    {PLAN_LABELS[row.planId] ?? row.planId}
                  </Badge>
                </Td>
                <Td>
                  {row.subscriptionStatus ? (
                    <span className="capitalize">{row.subscriptionStatus.replace("_", " ")}</span>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Td>
                <Td>
                  {row.emailVerified ? (
                    <Badge tone="green">Yes</Badge>
                  ) : (
                    <Badge tone="amber">No</Badge>
                  )}
                </Td>
                <Td align="right" numeric>
                  {formatBytesAdmin(row.storageCommitted)}
                </Td>
                <Td className="whitespace-nowrap">{formatDate(row.createdAt)}</Td>
                <Td align="right">
                  {/*
                    A row action needs a pointer target, not just a word. `inline-flex`
                    with `min-h-6` and horizontal padding gives 24px+ in both axes,
                    which is the WCAG 2.5.8 (AA) minimum. The text stays "View" because
                    the screen-reader context is the row it sits in.
                  */}
                  <Link
                    href={`/admin/users/${row.userId}`}
                    className="inline-flex min-h-6 items-center px-1.5 font-semibold text-primary hover:underline"
                  >
                    View
                  </Link>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-text-subtle">
          {formatNumber(result.total)} account{result.total === 1 ? "" : "s"}
          {filtered ? " matching" : ""}. Storage figures are Orindle&rsquo;s logical
          accounting, not R2 billing.
        </p>
      </div>

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        buildHref={buildPageHref}
      />

      {result.rows.length === 0 && !filtered && (
        <AdminCard className="mt-3">
          <p className="flex items-center gap-2 text-[12px] text-text-muted">
            <Users className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            Once accounts exist, ticket references and plan changes for each of them appear on
            the detail page.
          </p>
        </AdminCard>
      )}
    </div>
  );
}

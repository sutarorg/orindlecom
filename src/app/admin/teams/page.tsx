/**
 * /admin/teams — the organization directory.
 *
 * An honesty note that belongs in the code as much as the docs: the
 * customer-facing business repository (`src/lib/business/empty-repository.ts`) is
 * still an empty adapter, so the organization APIs a customer would use are not
 * implemented. This page therefore reads the tables directly through a
 * server-side admin layer and **says so in the UI**, rather than presenting itself
 * as a working team-management surface.
 *
 * Read-only, deliberately. Membership operations have their own rules (the
 * `can_administer_org` definer functions); adding an admin-side path to the same
 * rows would create a second set of rules for one table.
 */

import type { Metadata } from "next";
import { requireAdminPageContext } from "@/lib/admin/auth";
import { getTeamDirectory } from "@/lib/admin/service";
import { pagination, searchTerm } from "@/lib/admin/validation";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  AdminPageHeader,
  Badge,
  Pagination,
  TableEmpty,
  TableShell,
  Td,
  Th,
  formatDate,
  formatNumber,
} from "@/components/admin/admin-ui";
import { Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Teams",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AdminTeamsPage({
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

  const search = searchTerm(single(params.q));
  const result = await getTeamDirectory(ctx, { search, ...page });

  const buildPageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (params.pageSize && typeof params.pageSize === "string") {
      next.set("pageSize", params.pageSize);
    }
    if (nextPage > 1) next.set("page", String(nextPage));
    const queryString = next.toString();
    return queryString ? `/admin/teams?${queryString}` : "/admin/teams";
  };

  return (
    <div>
      <AdminPageHeader
        title="Teams"
        description="Business organizations on the platform, their owners, and how many people are in each."
      />

      <div className="mb-3 flex items-start gap-2 rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-surface-muted)] p-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" strokeWidth={2} aria-hidden />
        <p className="text-[11px] leading-relaxed text-text-muted">
          Read-only. The customer-facing team APIs are not implemented yet, so this directory reads
          the organization and membership tables directly through the admin data layer. Inviting,
          removing and changing roles are done by the customer side once it ships — not here.
        </p>
      </div>

      <FilterBar searchPlaceholder="Search by organization, slug or owner email" />

      <TableShell caption="Business organizations" columns={6}>
        <thead>
          <tr>
            <Th>Organization</Th>
            <Th>Owner</Th>
            <Th align="right">Members</Th>
            <Th align="right">Active</Th>
            <Th align="right">Pending</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title={search ? "No organizations match that search" : "No organizations yet"}
              hint={
                search
                  ? "Nothing matched. Clearing the search shows every organization."
                  : "Teams appear here when a customer creates one from their dashboard."
              }
            />
          ) : (
            result.rows.map((row) => (
              <tr key={row.organizationId} className="transition-colors hover:bg-[var(--brand-surface-muted)]">
                <Td>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold text-ink">{row.name}</span>
                    <span className="truncate font-mono text-[11px] text-text-muted">
                      /{row.slug}
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="truncate text-[12px] text-text">{row.ownerEmail ?? "—"}</span>
                </Td>
                <Td align="right" numeric>
                  {formatNumber(row.totalMembers)}
                </Td>
                <Td align="right" numeric>
                  {formatNumber(row.activeMembers)}
                </Td>
                <Td align="right">
                  {row.pendingInvites > 0 ? (
                    <Badge tone="amber">{formatNumber(row.pendingInvites)}</Badge>
                  ) : (
                    <span className="text-text-subtle">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap">{formatDate(row.createdAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <p className="mt-2 text-[11px] text-text-subtle">
        {formatNumber(result.total)} organization{result.total === 1 ? "" : "s"}
        {search ? " matching" : ""}.
      </p>

      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        buildHref={buildPageHref}
      />
    </div>
  );
}

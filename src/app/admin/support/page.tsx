/**
 * /admin/support — the ticket inbox.
 *
 * A list with real state: open, in progress, resolved. Ticket status is separate
 * from the notification's delivery state, and both are on the row, because "we
 * have not answered" and "we could not email ourselves" are different problems
 * with different fixes.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getSupportTickets } from "@/lib/admin/service";
import { SUPPORT_CATEGORIES, TICKET_STATUSES, oneOf, pagination, searchTerm } from "@/lib/admin/validation";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  AdminPageHeader,
  Badge,
  Pagination,
  TableEmpty,
  TableShell,
  Td,
  Th,
  adminLinkClass,
  formatDateTime,
  formatNumber,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Plans and sales",
  support: "Product support",
  billing: "Billing",
  privacy: "Privacy",
  other: "Other",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requirePlatformAdmin("manage_support");
  const params = await searchParams;

  const page = pagination(
    new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
  );

  const search = searchTerm(single(params.q));
  const statusParam = single(params.status);
  const categoryParam = single(params.category);

  const result = await getSupportTickets(ctx, {
    search,
    status: statusParam ? oneOf(statusParam, TICKET_STATUSES, "open", "status") : null,
    category: categoryParam ? oneOf(categoryParam, SUPPORT_CATEGORIES, "support", "category") : null,
    ...page,
  });

  const buildPageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "status", "category", "pageSize"]) {
      const value = single(params[key]);
      if (value) next.set(key, value);
    }
    if (nextPage > 1) next.set("page", String(nextPage));
    const queryString = next.toString();
    return queryString ? `/admin/support?${queryString}` : "/admin/support";
  };

  return (
    <div>
      <AdminPageHeader
        title="Support"
        description="Every message submitted through the contact form. Tickets are stored before the notification email is attempted, so nothing is lost when email fails."
      />

      <FilterBar
        searchPlaceholder="Search email, reference or subject"
        selects={[
          {
            name: "status",
            label: "Filter by ticket status",
            allLabel: "Any status",
            options: TICKET_STATUSES.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            })),
          },
          {
            name: "category",
            label: "Filter by category",
            allLabel: "Any category",
            options: SUPPORT_CATEGORIES.map((category) => ({
              value: category,
              label: CATEGORY_LABELS[category],
            })),
          },
        ]}
      />

      <TableShell caption="Support tickets" columns={6}>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>From</Th>
            <Th>Subject</Th>
            <Th>Status</Th>
            <Th>Notification</Th>
            <Th>Received</Th>
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title={search || statusParam ? "No tickets match these filters" : "No support requests yet"}
              hint={
                search || statusParam
                  ? "Nothing matched. Clearing the filters shows the whole inbox."
                  : "Messages sent through the contact form appear here immediately, whether or not the notification email was delivered."
              }
            />
          ) : (
            result.rows.map((ticket) => (
              <tr key={ticket.id} className="transition-colors hover:bg-[var(--brand-surface-muted)]">
                <Td>
                  <Link
                    href={`/admin/support/${ticket.id}`}
                    className={cn(adminLinkClass, "font-mono")}
                  >
                    {ticket.reference}
                  </Link>
                </Td>
                <Td>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[12px] text-ink">
                      {ticket.submitterName ?? "Anonymous"}
                    </span>
                    <span className="truncate text-[11px] text-text-muted">
                      {ticket.submitterEmail}
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="flex min-w-0 flex-col">
                    <span className="max-w-[260px] truncate text-[12px] text-ink">
                      {ticket.subject}
                    </span>
                    <span className="text-[10.5px] text-text-subtle">
                      {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    </span>
                  </span>
                </Td>
                <Td>
                  <Badge
                    tone={
                      ticket.ticketStatus === "resolved"
                        ? "green"
                        : ticket.ticketStatus === "in_progress"
                          ? "blue"
                          : "amber"
                    }
                  >
                    {STATUS_LABELS[ticket.ticketStatus] ?? ticket.ticketStatus}
                  </Badge>
                </Td>
                <Td>
                  {/* The initial notification's fate, not the ticket's. */}
                  <span
                    className={
                      ticket.deliveryStatus === "delivered"
                        ? "text-[11px] text-[#1B7F4B]"
                        : ticket.deliveryStatus === "failed"
                          ? "text-[11px] text-[#C93B2B]"
                          : "text-[11px] text-text-subtle"
                    }
                  >
                    {ticket.deliveryStatus}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-[11.5px]">
                  {formatDateTime(ticket.createdAt)}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <p className="mt-2 text-[11px] text-text-subtle">
        {formatNumber(result.total)} ticket{result.total === 1 ? "" : "s"}.
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

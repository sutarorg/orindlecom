/**
 * /admin/logs — the operator audit trail, plus operational health.
 *
 * Two sections, kept apart on purpose:
 *
 *   **Audit** — what an operator did, from `platform_admin_audit_logs`. Append-only:
 *   this page has no edit or delete control because no such capability exists in
 *   the database grants.
 *
 *   **Operational** — counts from `email_log` and `webhook_events`. Payloads and
 *   provider error text are not shown: a webhook body contains payment metadata
 *   and a provider error can contain fragments of a request. Counts and statuses
 *   are enough to notice a problem, which is all this page is for.
 *
 * It is not an anti-abuse console. Nothing here reads risk scores, device hashes or
 * restrictions — see docs/security/anti-abuse-system.md on why that surface does
 * not exist.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAuditLogs, getOperationalCounts } from "@/lib/admin/service";
import { dateRange, oneOf, pagination, optionalUuid } from "@/lib/admin/validation";
import { FilterBar } from "@/components/admin/filter-bar";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  MetricCard,
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
  title: "Logs",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ACTIONS = [
  "all",
  "admin.granted",
  "admin.role_changed",
  "admin.revoked",
  "admin.exported",
  "support.status_changed",
  "support.assigned",
  "support.replied",
  "support.note_added",
] as const;

/** Human descriptions, so an operator does not read dotted identifiers. */
const ACTION_LABELS: Record<string, string> = {
  "admin.granted": "Granted platform access",
  "admin.role_changed": "Changed a platform role",
  "admin.revoked": "Revoked platform access",
  "admin.exported": "Exported a data set",
  "support.status_changed": "Changed a ticket status",
  "support.assigned": "Changed ticket assignment",
  "support.replied": "Replied to a customer",
  "support.note_added": "Added an internal note",
};

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requirePlatformAdmin("view_audit_log");
  const params = await searchParams;

  const page = pagination(
    new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
  );

  const range = dateRange(single(params.from), single(params.to));
  const action = oneOf(single(params.action), ACTIONS, "all", "action");

  const [audit, operational] = await Promise.all([
    getAuditLogs(ctx, {
      action: action === "all" ? null : action,
      actorId: optionalUuid(single(params.actor), "actor"),
      targetId: optionalUuid(single(params.target), "target"),
      from: range.from,
      to: range.to,
      ...page,
    }),
    getOperationalCounts(ctx),
  ]);

  const buildPageHref = (nextPage: number) => {
    const next = new URLSearchParams();
    for (const key of ["action", "actor", "target", "from", "to", "pageSize"]) {
      const value = single(params[key]);
      if (value) next.set(key, value);
    }
    if (nextPage > 1) next.set("page", String(nextPage));
    const queryString = next.toString();
    return queryString ? `/admin/logs?${queryString}` : "/admin/logs";
  };

  return (
    <div>
      <AdminPageHeader
        title="Logs"
        description="What operators did, and the health of background work. Audit records are append-only — nothing here can be edited or deleted."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Audit records"
          value={formatNumber(audit.total)}
          hint="Matching the filters below"
        />
        <MetricCard
          label="Emails sent"
          value={formatNumber(operational.email.sent)}
          hint={`${formatNumber(operational.email.failed)} failed, ${formatNumber(operational.email.queued)} queued`}
          tone={operational.email.failed > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Webhooks"
          value={formatNumber(operational.webhooks.total)}
          hint={`${formatNumber(operational.webhooks.unprocessed)} unprocessed`}
          tone={operational.webhooks.unprocessed > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Webhook errors"
          value={formatNumber(operational.webhooks.errored)}
          hint="Recorded and awaiting replay"
          tone={operational.webhooks.errored > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-4">
        <AdminCardHeader
          title="Audit trail"
          description="Every privileged action, with the operator, the target and when it happened."
        />
        <FilterBar
          searchPlaceholder="Search is not available on the audit trail; use the filters"
          selects={[
            {
              name: "action",
              label: "Filter by action",
              allLabel: "All actions",
              options: ACTIONS.filter((entry) => entry !== "all").map((entry) => ({
                value: entry,
                label: ACTION_LABELS[entry] ?? entry,
              })),
            },
          ]}
        />

        <TableShell caption="Operator audit trail" columns={4}>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Operator</Th>
              <Th>Action</Th>
              <Th>Target</Th>
            </tr>
          </thead>
          <tbody>
            {audit.rows.length === 0 ? (
              <TableEmpty
                colSpan={4}
                title={action !== "all" ? "No records for that action" : "No audit records yet"}
                hint="Records appear as soon as an operator grants access, changes a ticket or replies to a customer."
              />
            ) : (
              audit.rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap text-[11.5px]">
                    {formatDateTime(row.createdAt)}
                  </Td>
                  <Td>
                    <span className="truncate text-[12px] text-text">
                      {row.actorEmail ?? (row.actorId ? row.actorId.slice(0, 8) : "system")}
                    </span>
                  </Td>
                  <Td>
                    <span className="flex flex-col">
                      <span className="text-[12px] font-semibold text-ink">
                        {ACTION_LABELS[row.action] ?? row.action}
                      </span>
                      <span className="font-mono text-[10px] text-text-subtle">{row.action}</span>
                    </span>
                  </Td>
                  <Td>
                    {row.targetType === "support_ticket" && row.targetId ? (
                      <Link
                        href={`/admin/support/${row.targetId}`}
                        className={cn(adminLinkClass)}
                      >
                        Ticket
                      </Link>
                    ) : (
                      <Badge tone="neutral">{row.targetType.replace("_", " ")}</Badge>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>

        <Pagination
          page={audit.page}
          pageSize={audit.pageSize}
          total={audit.total}
          buildHref={buildPageHref}
        />
      </div>

      <AdminCard className="mt-4">
        <AdminCardHeader
          title="What is not in this log"
          description="Stated so its absence is not mistaken for completeness."
        />
        <ul className="grid gap-1.5 text-[11.5px] leading-relaxed text-text-muted sm:grid-cols-2">
          <li>No webhook payloads — they contain payment metadata.</li>
          <li>No provider error bodies — they can quote a request.</li>
          <li>No customer message bodies — those live on the ticket.</li>
          <li>No anti-abuse data. This console has no risk or device surface by design.</li>
        </ul>
      </AdminCard>
    </div>
  );
}

/**
 * /admin/storage — platform storage consumption.
 *
 * Three things this page is careful about:
 *
 *   1. **No double counting.** Trash bytes are inside committed bytes, because the
 *      objects are still in the bucket and still cost money. They are shown as a
 *      subset, labelled as such.
 *   2. **No scanning `files`.** Every figure comes from `storage_usage`, which is
 *      the materialised record quota enforcement reads. Aggregating a file table
 *      would be a second source of truth able to disagree with the first.
 *   3. **No claim about R2 billing.** These are Orindle's logical bytes. What
 *      Cloudflare invoices for the bucket is a different number, and this
 *      deployment has no source for it.
 */

import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import {
  getLargestAccounts,
  getOverviewStats,
  getReservationCount,
  getStorageByPlan,
} from "@/lib/admin/service";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  MetricCard,
  TableEmpty,
  TableShell,
  Td,
  Th,
  formatBytesAdmin,
  formatNumber,
} from "@/components/admin/admin-ui";
import { ShareBar } from "@/components/admin/charts";

export const metadata: Metadata = {
  title: "Storage",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  basic: "Basic",
  plus: "Plus",
  premium: "Premium",
  ultra: "Ultra",
  max: "Max",
};

export default async function AdminStoragePage() {
  const ctx = await requirePlatformAdmin("view_operations");

  const [stats, byPlan, largest, openReservations] = await Promise.all([
    getOverviewStats(ctx),
    getStorageByPlan(ctx),
    getLargestAccounts(ctx, 10),
    getReservationCount(ctx),
  ]);

  const totalCommitted = stats.committedBytes;
  const totalAccounts = byPlan.reduce((sum, row) => sum + row.accounts, 0);

  return (
    <div>
      <AdminPageHeader
        title="Storage"
        description="Committed, reserved and trashed bytes across the platform, from the same accounting record quota enforcement reads."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Committed"
          value={formatBytesAdmin(totalCommitted)}
          hint="Stored and accounted for"
        />
        <MetricCard
          label="Reserved"
          value={formatBytesAdmin(stats.reservedBytes)}
          hint={`${formatNumber(openReservations)} open upload reservation${openReservations === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="In trash"
          value={formatBytesAdmin(stats.trashBytes)}
          hint="A subset of committed, not an addition to it"
        />
        <MetricCard
          label="Accounts storing data"
          value={formatNumber(totalAccounts)}
          hint="Accounts with a storage record"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <AdminCard>
          <AdminCardHeader
            title="Distribution by plan"
            description="Accounts and bytes grouped by the plan currently in force."
          />
          {byPlan.length === 0 ? (
            <p className="py-4 text-[12px] text-text-muted">
              No storage accounting records yet. They are created at a customer&rsquo;s first
              upload.
            </p>
          ) : (
            <div>
              {byPlan.map((row) => (
                <ShareBar
                  key={row.planId}
                  label={`${PLAN_LABELS[row.planId] ?? row.planId} · ${formatNumber(row.accounts)} account${row.accounts === 1 ? "" : "s"}`}
                  value={row.committedBytes}
                  total={totalCommitted}
                  formatted={formatBytesAdmin(row.committedBytes)}
                />
              ))}
            </div>
          )}
        </AdminCard>

        <AdminCard>
          <AdminCardHeader
            title="What these numbers are, and are not"
            description="Worth stating plainly, because a storage figure is easy to misread."
          />
          <ul className="space-y-2 text-[11.5px] leading-relaxed text-text-muted">
            <li className="flex gap-2">
              <Badge tone="blue">Logical</Badge>
              <span>
                These are Orindle&rsquo;s own accounted bytes — what a customer&rsquo;s quota is
                measured against.
              </span>
            </li>
            <li className="flex gap-2">
              <Badge tone="neutral">Not R2 billing</Badge>
              <span>
                Cloudflare bills for bucket storage, request volume and egress. No R2 billing source
                is connected to this deployment, so no infrastructure cost is shown or estimated.
              </span>
            </li>
            <li className="flex gap-2">
              <Badge tone="amber">Trash</Badge>
              <span>
                Trashed files still occupy the bucket until purge, so their bytes are counted once,
                inside committed.
              </span>
            </li>
          </ul>
          <p className="mt-3 border-t border-[var(--brand-border-soft)] pt-2.5 text-[11px] leading-relaxed text-text-subtle">
            Adjustments and object deletion are not available here. Storage is changed by customers
            uploading and deleting, and by the reconciliation job — not by an operator.
          </p>
        </AdminCard>
      </div>

      <div className="mt-3">
        <AdminCardHeader
          title="Largest accounts"
          description="The ten accounts using the most committed storage."
        />
        <TableShell caption="Largest storage accounts" columns={5}>
          <thead>
            <tr>
              <Th>Account</Th>
              <Th>Plan</Th>
              <Th align="right">Committed</Th>
              <Th align="right">Reserved</Th>
              <Th align="right">Trash</Th>
            </tr>
          </thead>
          <tbody>
            {largest.length === 0 ? (
              <TableEmpty
                colSpan={5}
                title="No storage recorded yet"
                hint="Accounts appear here once they have stored something."
              />
            ) : (
              largest.map((row) => (
                <tr key={row.ownerId}>
                  <Td>
                    <span className="truncate text-[12.5px] font-semibold text-ink">
                      {row.email ?? row.ownerId}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={row.planId === "free" ? "neutral" : "blue"}>
                      {PLAN_LABELS[row.planId] ?? row.planId}
                    </Badge>
                  </Td>
                  <Td align="right" numeric>
                    {formatBytesAdmin(row.committedBytes)}
                  </Td>
                  <Td align="right" numeric>
                    {formatBytesAdmin(row.reservedBytes)}
                  </Td>
                  <Td align="right" numeric>
                    {formatBytesAdmin(row.trashBytes)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </div>
    </div>
  );
}

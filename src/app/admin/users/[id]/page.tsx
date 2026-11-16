/**
 * /admin/users/:id — one account.
 *
 * Read-only, and deliberately so. There is no suspend, no delete, no plan
 * override and no impersonation: each of those is a destructive capability that
 * needs its own reviewed design, explicit confirmation and a rollback story, and
 * shipping them behind a table row would be how an operator accidentally deletes
 * a customer.
 *
 * What is here is what an operator needs to answer a support question: is the
 * address verified, what are they paying for, how much are they storing, and which
 * teams are they in.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireAdminPageContext } from "@/lib/admin/auth";
import { getUserDetail } from "@/lib/admin/service";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  Td,
  Th,
  formatBytesAdmin,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/components/admin/admin-ui";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAdminPageContext("view_operations");
  const { id } = await params;

  // A malformed id is a 404, not a 500: it is a URL a person typed or a stale
  // bookmark, not a server fault.
  if (!UUID_RE.test(id)) notFound();

  const user = await getUserDetail(ctx, id);
  if (!user) notFound();

  const planLabel = user.planId.charAt(0).toUpperCase() + user.planId.slice(1);

  return (
    <div>
      <Link
        href="/admin/users"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        All users
      </Link>

      <AdminPageHeader
        title={user.fullName || user.email || "Account"}
        description={user.email ?? "This account has no email address recorded."}
        actions={
          <span className="flex items-center gap-2">
            {user.emailVerified ? (
              <Badge tone="green">Email verified</Badge>
            ) : (
              <Badge tone="amber">Email unverified</Badge>
            )}
            <Badge tone={user.planId === "free" ? "neutral" : "blue"}>{planLabel}</Badge>
          </span>
        }
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <AdminCard>
          <AdminCardHeader title="Account" />
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Joined</dt>
              <dd className="font-semibold text-ink">{formatDate(user.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Locale</dt>
              <dd className="font-semibold text-ink">{user.locale}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">User id</dt>
              <dd className="truncate font-mono text-[11px] text-text-muted" title={user.userId}>
                {user.userId}
              </dd>
            </div>
          </dl>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader
            title="Subscription"
            description={
              user.billingPeriod === null
                ? "Billing period is not recorded for this subscription, so it is excluded from MRR."
                : undefined
            }
          />
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Plan</dt>
              <dd className="font-semibold text-ink">{planLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Status</dt>
              <dd className="font-semibold capitalize text-ink">
                {user.subscriptionStatus?.replace("_", " ") ?? "none"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Billing period</dt>
              <dd className="font-semibold text-ink">
                {user.billingPeriod ? (
                  user.billingPeriod
                ) : (
                  <span className="text-[#96610B]">Not recorded</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Renews</dt>
              <dd className="font-semibold text-ink">{formatDate(user.currentPeriodEnd)}</dd>
            </div>
            {user.cancelAtPeriodEnd && (
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Cancellation</dt>
                <dd className="font-semibold text-[#96610B]">Scheduled at period end</dd>
              </div>
            )}
          </dl>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader title="Storage" />
          <dl className="space-y-2 text-[12.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Committed</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatBytesAdmin(user.storage.committed)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Reserved</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatBytesAdmin(user.storage.reserved)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">In trash</dt>
              <dd className="font-semibold tabular-nums text-ink">
                {formatBytesAdmin(user.storage.trash)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[10.5px] leading-relaxed text-text-subtle">
            Trash is already included in committed: those bytes are still stored.
          </p>
        </AdminCard>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <AdminCard padded={false}>
          <div className="p-4 pb-0">
            <AdminCardHeader
              title="Invoices"
              description="Most recent first. Failed and refunded invoices are shown as they are."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">Recent invoices for this account</caption>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th align="right">Amount</Th>
                  <Th>Paid</Th>
                </tr>
              </thead>
              <tbody>
                {user.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[12px] text-text-muted">
                      No invoices. This account has never completed a payment.
                    </td>
                  </tr>
                ) : (
                  user.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <Td>
                        <Badge
                          tone={
                            invoice.status === "paid"
                              ? "green"
                              : invoice.status === "refunded"
                                ? "amber"
                                : "red"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </Td>
                      <Td align="right" numeric>
                        {formatMoney(invoice.amountMinor, invoice.currency)}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(invoice.paidAt)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>

        <div className="space-y-3">
          <AdminCard>
            <AdminCardHeader title="Teams" description="Organizations this account belongs to." />
            {user.teams.length === 0 ? (
              <p className="py-3 text-[12px] text-text-muted">
                Not a member of any organization.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--brand-border-soft)]">
                {user.teams.map((team, index) => (
                  <li
                    key={`${team.organizationName}-${index}`}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[12.5px] text-ink">
                      {team.organizationName}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={team.role === "owner" ? "violet" : "neutral"}>{team.role}</Badge>
                      <span className="text-[11px] text-text-subtle">{team.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title="Recent activity" />
            {user.recentActivity.length === 0 ? (
              <p className="py-3 text-[12px] text-text-muted">No recorded activity.</p>
            ) : (
              <ul className="divide-y divide-[var(--brand-border-soft)]">
                {user.recentActivity.map((event) => (
                  <li key={event.id} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate text-[12px] text-text">
                      {event.description}
                    </span>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-text-subtle">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-[#F1D9A8] bg-[#FEFBF3] p-3.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#96610B]" strokeWidth={1.9} aria-hidden />
        <p className="text-[11.5px] leading-relaxed text-[#96610B]">
          This page is read-only. Account suspension, deletion, plan overrides and impersonation
          are intentionally not implemented — each needs its own reviewed design and audit story
          before it can exist here.
        </p>
      </div>
    </div>
  );
}

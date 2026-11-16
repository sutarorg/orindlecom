/**
 * /admin/support/:id — one ticket.
 *
 * The full original message, the reply history, and the controls. Internal notes
 * are visually distinct from replies so an operator cannot mistake one for the
 * other in a hurry — which is precisely the moment the mistake would be made.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getSupportTicket } from "@/lib/admin/service";
import { ReplyBox, TicketActions } from "@/components/admin/support-ticket";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  formatDateTime,
} from "@/components/admin/admin-ui";

export const metadata: Metadata = {
  title: "Ticket",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePlatformAdmin("manage_support");
  const { id } = await params;

  if (!UUID_RE.test(id)) notFound();

  const ticket = await getSupportTicket(ctx, id);
  if (!ticket) notFound();

  const assigned = ticket.assignedTo === ctx.admin.userId;

  return (
    <div>
      <Link
        href="/admin/support"
        className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
        All tickets
      </Link>

      <AdminPageHeader
        title={ticket.subject}
        description={`${ticket.reference} · from ${ticket.submitterName ?? "an anonymous sender"} (${ticket.submitterEmail})`}
        actions={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge
              tone={
                ticket.ticketStatus === "resolved"
                  ? "green"
                  : ticket.ticketStatus === "in_progress"
                    ? "blue"
                    : "amber"
              }
            >
              {ticket.ticketStatus.replace("_", " ")}
            </Badge>
            <Badge
              tone={
                ticket.deliveryStatus === "delivered"
                  ? "green"
                  : ticket.deliveryStatus === "failed"
                    ? "red"
                    : "neutral"
              }
            >
              email {ticket.deliveryStatus}
            </Badge>
          </span>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <AdminCard>
            <AdminCardHeader
              title="Original message"
              description={`Received ${formatDateTime(ticket.createdAt)} · ${ticket.category}`}
            />
            {/* whitespace-pre-wrap preserves the customer's paragraphs without
                rendering their text as markup. */}
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
              {ticket.message}
            </p>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="History"
              description="Replies and internal notes, oldest first."
            />
            {ticket.messages.length === 0 ? (
              <p className="py-3 text-[12px] text-text-muted">
                No replies yet. Nothing has been sent to this customer from here.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {ticket.messages.map((message) => (
                  <li
                    key={message.id}
                    className={
                      message.visibility === "internal"
                        ? "rounded-lg border border-[#F1D9A8] bg-[#FEFBF3] p-2.5"
                        : "rounded-lg border border-[var(--brand-border)] bg-white p-2.5"
                    }
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={message.visibility === "internal" ? "amber" : "blue"}>
                        {message.visibility === "internal" ? "Internal note" : "Sent to customer"}
                      </Badge>
                      <span className="text-[10.5px] text-text-subtle">
                        {formatDateTime(message.createdAt)}
                      </span>
                      {message.visibility === "public" && (
                        <span
                          className={
                            message.deliveryStatus === "delivered"
                              ? "text-[10.5px] font-semibold text-[#1B7F4B]"
                              : message.deliveryStatus === "failed"
                                ? "text-[10.5px] font-semibold text-[#C93B2B]"
                                : "text-[10.5px] text-text-subtle"
                          }
                        >
                          {message.deliveryStatus === "delivered"
                            ? "delivered"
                            : message.deliveryStatus === "failed"
                              ? "not delivered"
                              : "sending"}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text">
                      {message.body}
                    </p>
                    {message.deliveryError && (
                      <p className="mt-1 font-mono text-[10px] leading-relaxed text-[#C93B2B]">
                        {message.deliveryError}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Reply"
              description="A reply is emailed to the customer and recorded here. An internal note is recorded only."
            />
            <ReplyBox ticketId={ticket.id} />
          </AdminCard>
        </div>

        <div className="space-y-3">
          <AdminCard>
            <AdminCardHeader title="Ticket state" />
            <TicketActions
              ticketId={ticket.id}
              status={ticket.ticketStatus}
              assigned={assigned}
              selfId={ctx.admin.userId}
            />
          </AdminCard>

          <AdminCard>
            <AdminCardHeader title="Details" />
            <dl className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Reference</dt>
                <dd className="font-mono text-[11px] font-semibold text-ink">{ticket.reference}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Category</dt>
                <dd className="font-semibold capitalize text-ink">{ticket.category}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Received</dt>
                <dd className="text-right font-semibold text-ink">
                  {formatDateTime(ticket.createdAt)}
                </dd>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Resolved</dt>
                  <dd className="text-right font-semibold text-ink">
                    {formatDateTime(ticket.resolvedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}

/**
 * POST /api/admin/support/:id/reply — reply to a customer, or add an internal note.
 *
 * The ordering that matters, and why:
 *
 *   1. Validate and authorise.
 *   2. **Insert the message row with delivery_status = 'pending'.**
 *   3. Send the email.
 *   4. Update that row with the true outcome.
 *
 * If step 3 or 4 fails, step 2 has already preserved what was written. The
 * operator sees "not sent, retry" instead of watching their reply disappear —
 * which is the behaviour the requirement asks for in the contact form, applied
 * here for the same reason.
 *
 * **An internal note never reaches step 3.** It is stored with
 * delivery_status = 'not_applicable', enforced by a CHECK constraint, so a future
 * refactor cannot email one by accident.
 */

import { AppError } from "@/domain/auth/errors";
import { readJson, requireString } from "@/lib/api";
import { writeAudit } from "@/lib/admin/audit";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { uuidParam } from "@/lib/admin/validation";
import { getEmailState, sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(
    async (ctx) => {
      const { id } = await context.params;
      const ticketId = uuidParam(id, "ticket");

      const body = await readJson(request);
      const visibility = body.visibility === "internal" ? "internal" : "public";
      const text = requireString(body, "body", { min: 1, max: 4000 });

      const { data: ticket, error: ticketError } = await ctx.db
        .from("support_requests")
        .select("id, reference, subject, submitter_email, submitter_name, ticket_status")
        .eq("id", ticketId)
        .maybeSingle();

      if (ticketError) throw new AppError("unknown", "We couldn't load that ticket.");
      if (!ticket) throw new AppError("not_found", "That ticket doesn't exist.");

      // 1. Persist first, with an honest initial state.
      const { data: created, error: insertError } = await ctx.db
        .from("support_messages")
        .insert({
          request_id: ticketId,
          author_id: ctx.admin.userId,
          visibility,
          body: text,
          delivery_status: visibility === "internal" ? "not_applicable" : "pending",
        })
        .select("id, created_at")
        .single();

      if (insertError || !created) {
        throw new AppError("unknown", "We couldn't save that reply. Nothing was sent.");
      }

      if (visibility === "internal") {
        await writeAudit(ctx, {
          action: "support.note_added",
          targetType: "support_ticket",
          targetId: ticketId,
          metadata: { messageId: created.id },
        });
        return adminOk({
          id: created.id,
          visibility,
          deliveryStatus: "not_applicable",
          message: "Note saved. Internal notes are never emailed to the customer.",
        });
      }

      // 2. Send. A failure here does not lose the reply.
      const emailState = getEmailState();
      if (emailState === "missing") {
        await ctx.db
          .from("support_messages")
          .update({
            delivery_status: "failed",
            delivery_error: "Email is not configured on this deployment.",
          })
          .eq("id", created.id);

        await writeAudit(ctx, {
          action: "support.replied",
          targetType: "support_ticket",
          targetId: ticketId,
          metadata: { messageId: created.id, delivered: false, reason: "not_configured" },
        });

        return adminOk({
          id: created.id,
          visibility,
          deliveryStatus: "failed",
          message:
            "Your reply is saved, but email isn't connected on this deployment, so it was not sent.",
        });
      }

      const result = await sendEmail({
        to: String(ticket.submitter_email),
        template: "support-reply",
        data: {
          name: String(ticket.submitter_name ?? ""),
          reference: String(ticket.reference),
          subject: String(ticket.subject),
          body: text,
        },
      });

      if (!result.ok) {
        await ctx.db
          .from("support_messages")
          .update({ delivery_status: "failed", delivery_error: result.error.slice(0, 500) })
          .eq("id", created.id);

        await writeAudit(ctx, {
          action: "support.replied",
          targetType: "support_ticket",
          targetId: ticketId,
          metadata: { messageId: created.id, delivered: false, retryable: result.retryable },
        });

        return adminOk({
          id: created.id,
          visibility,
          deliveryStatus: "failed",
          retryable: result.retryable,
          message: "Your reply is saved, but the mail service refused it. You can retry the send.",
        });
      }

      await ctx.db
        .from("support_messages")
        .update({ delivery_status: "delivered", provider_message_id: result.id })
        .eq("id", created.id);

      // A reply moves an open ticket to in progress. Not silent: it is recorded.
      if (ticket.ticket_status === "open") {
        await ctx.db
          .from("support_requests")
          .update({ ticket_status: "in_progress" })
          .eq("id", ticketId);
        await writeAudit(ctx, {
          action: "support.status_changed",
          targetType: "support_ticket",
          targetId: ticketId,
          metadata: { from: "open", to: "in_progress", reason: "reply_sent" },
        });
      }

      await writeAudit(ctx, {
        action: "support.replied",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: { messageId: created.id, delivered: true },
      });

      return adminOk({
        id: created.id,
        visibility,
        deliveryStatus: "delivered",
        message: "Reply sent.",
      });
    },
    { permission: "manage_support", limit: "adminMutation" },
  );
}

/**
 * POST /api/admin/support/:id/status — move a ticket between open, in progress
 * and resolved.
 *
 * Transitions are validated rather than accepted verbatim: resolved tickets can be
 * reopened, and anything may be resolved, but "resolved → in_progress" is a state
 * an operator reaches by reopening first. Rejecting the shortcut keeps the
 * resolved_at timestamp meaningful.
 */

import { AppError } from "@/domain/auth/errors";
import { readJson, requireString } from "@/lib/api";
import { writeAudit } from "@/lib/admin/audit";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { TICKET_STATUSES, oneOf, uuidParam } from "@/lib/admin/validation";

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
      const next = oneOf(requireString(body, "status", { max: 20 }), TICKET_STATUSES, "open", "status");

      const { data: current, error: readError } = await ctx.db
        .from("support_requests")
        .select("ticket_status")
        .eq("id", ticketId)
        .maybeSingle();

      if (readError) throw new AppError("unknown", "We couldn't load that ticket.");
      if (!current) throw new AppError("not_found", "That ticket doesn't exist.");

      const previous = String(current.ticket_status);
      if (previous === next) {
        // Idempotent: setting the same status twice is not an error, but it is
        // also not a change, so it gets no audit entry claiming one happened.
        return adminOk({ status: next, changed: false });
      }

      if (previous === "resolved" && next === "in_progress") {
        throw new AppError(
          "conflict",
          "That ticket is resolved. Reopen it before marking it in progress.",
        );
      }

      const { error } = await ctx.db
        .from("support_requests")
        .update({
          ticket_status: next,
          resolved_at: next === "resolved" ? new Date().toISOString() : null,
        })
        .eq("id", ticketId);

      if (error) throw new AppError("unknown", "We couldn't update that ticket.");

      await writeAudit(ctx, {
        action: "support.status_changed",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: { from: previous, to: next },
      });

      return adminOk({ status: next, changed: true });
    },
    { permission: "manage_support", limit: "adminMutation" },
  );
}

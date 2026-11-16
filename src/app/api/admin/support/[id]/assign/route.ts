/**
 * POST /api/admin/support/:id/assign — take ownership of a ticket, or release it.
 *
 * The assignee is always the caller. An operator cannot assign a ticket to another
 * person, which removes the whole class of "assigned to someone who never saw it".
 * Passing `{ assign: false }` clears it.
 */

import { AppError } from "@/domain/auth/errors";
import { readJson } from "@/lib/api";
import { writeAudit } from "@/lib/admin/audit";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { uuidParam } from "@/lib/admin/validation";

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
      const assign = body.assign !== false;

      const { data: current, error: readError } = await ctx.db
        .from("support_requests")
        .select("assigned_to")
        .eq("id", ticketId)
        .maybeSingle();

      if (readError) throw new AppError("unknown", "We couldn't load that ticket.");
      if (!current) throw new AppError("not_found", "That ticket doesn't exist.");

      const { error } = await ctx.db
        .from("support_requests")
        .update({ assigned_to: assign ? ctx.admin.userId : null })
        .eq("id", ticketId);

      if (error) throw new AppError("unknown", "We couldn't update that ticket.");

      await writeAudit(ctx, {
        action: "support.assigned",
        targetType: "support_ticket",
        targetId: ticketId,
        metadata: { assignee: assign ? ctx.admin.userId : null },
      });

      return adminOk({ assignedTo: assign ? ctx.admin.userId : null });
    },
    { permission: "manage_support", limit: "adminMutation" },
  );
}

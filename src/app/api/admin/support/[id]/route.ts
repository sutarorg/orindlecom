/**
 * GET /api/admin/support/:id — one ticket, its original message, and the history.
 *
 * Internal notes are returned in the same payload as public replies, discriminated
 * by `visibility`. The UI renders them differently and the reply action refuses to
 * email them; the alternative — two endpoints — would let a caller infer the
 * existence of notes from a 403.
 */

import { AppError } from "@/domain/auth/errors";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { getSupportTicket } from "@/lib/admin/service";
import { uuidParam } from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return adminRoute(
    async (ctx) => {
      const { id } = await context.params;
      const ticket = await getSupportTicket(ctx, uuidParam(id, "ticket"));
      if (!ticket) throw new AppError("not_found", "That ticket doesn't exist.");
      return adminOk(ticket);
    },
    { permission: "manage_support", limit: "adminRead" },
  );
}

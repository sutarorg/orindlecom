/**
 * GET /api/admin/audit — the operator audit trail.
 *
 * Append-only: this route has no POST, PATCH or DELETE sibling, and the database
 * grants the service role SELECT and INSERT only (0017). There is no code path,
 * anywhere, that edits or removes a historic record.
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getAuditLogs } from "@/lib/admin/service";
import { dateRange, oneOf, pagination, optionalUuid } from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = [
  "all",
  "admin.granted",
  "admin.role_changed",
  "admin.revoked",
  "support.status_changed",
  "support.assigned",
  "support.replied",
  "support.note_added",
] as const;

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const params = queryOf(request);
      const range = dateRange(params.get("from"), params.get("to"));
      const action = oneOf(params.get("action"), ACTIONS, "all", "action");

      return adminOk(
        await getAuditLogs(ctx, {
          action: action === "all" ? null : action,
          actorId: optionalUuid(params.get("actor"), "actor"),
          targetId: optionalUuid(params.get("target"), "target"),
          from: range.from,
          to: range.to,
          ...pagination(params),
        }),
      );
    },
    { permission: "view_audit_log", limit: "adminRead" },
  );
}

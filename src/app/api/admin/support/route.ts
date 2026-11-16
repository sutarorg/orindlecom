/**
 * GET /api/admin/support — the ticket list.
 *
 * Existed in the documentation before it existed in the code, which the
 * docs-fidelity test caught immediately. That is the failure mode the test was
 * written for: a reference that describes an endpoint nobody built is a claim that
 * was never true.
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getSupportTickets } from "@/lib/admin/service";
import {
  SUPPORT_CATEGORIES,
  TICKET_STATUSES,
  oneOf,
  pagination,
  searchTerm,
} from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const params = queryOf(request);
      const statusParam = params.get("status");
      const categoryParam = params.get("category");

      return adminOk(
        await getSupportTickets(ctx, {
          search: searchTerm(params.get("q")),
          status: statusParam ? oneOf(statusParam, TICKET_STATUSES, "open", "status") : null,
          category: categoryParam
            ? oneOf(categoryParam, SUPPORT_CATEGORIES, "support", "category")
            : null,
          ...pagination(params),
        }),
      );
    },
    { permission: "manage_support", limit: "adminSearch" },
  );
}

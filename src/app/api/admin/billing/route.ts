/**
 * GET /api/admin/billing — MRR by currency, subscription counts, invoice totals.
 *
 * Two different measurements, kept apart everywhere:
 *   - **MRR** comes from current recurring subscriptions and approved prices.
 *   - **Revenue** comes from invoices with status = 'paid' inside the range.
 *
 * They are never summed together, and no figure is ever added across currencies.
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getBillingSummary } from "@/lib/admin/service";
import { dateRange } from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      // Validated even though the aggregate is currently all-time: an invalid
      // range is a client bug and should be reported, not ignored.
      const range = dateRange(queryOf(request).get("from"), queryOf(request).get("to"));
      const summary = await getBillingSummary(ctx);
      return adminOk({ ...summary, range });
    },
    { permission: "view_operations", limit: "adminRead" },
  );
}

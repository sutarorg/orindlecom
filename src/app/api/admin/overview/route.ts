/**
 * GET /api/admin/overview — platform totals and the growth series.
 *
 * Platform-scale counters only. No customer content is in this payload, so a
 * leaked response would reveal scale, not people.
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { dayWindow } from "@/lib/admin/validation";
import { getGrowthSeries, getMrr, getOverviewStats, getRecentActivity } from "@/lib/admin/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const days = dayWindow(queryOf(request).get("days"));

      const [stats, mrr, growth, activity] = await Promise.all([
        getOverviewStats(ctx),
        getMrr(ctx),
        getGrowthSeries(ctx, days),
        getRecentActivity(ctx, 8),
      ]);

      return adminOk({ stats, mrr, growth, activity, days });
    },
    { permission: "view_operations", limit: "adminRead" },
  );
}

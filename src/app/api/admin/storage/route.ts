/**
 * GET /api/admin/storage — distributed storage truth.
 *
 * Every figure comes from `storage_usage`, the same materialised record quota
 * enforcement uses. Nothing is summed from `files`, which would be a second source
 * of truth able to disagree with the first.
 *
 * Trash is reported separately and is NOT added to committed: the customer-side
 * implementation already counts trashed bytes inside `committed_bytes`, because
 * those bytes are still in the bucket and still cost money.
 */

import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { getLargestAccounts, getOverviewStats, getReservationCount, getStorageByPlan } from "@/lib/admin/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return adminRoute(
    async (ctx) => {
      const [stats, byPlan, largest, openReservations] = await Promise.all([
        getOverviewStats(ctx),
        getStorageByPlan(ctx),
        getLargestAccounts(ctx, 10),
        getReservationCount(ctx),
      ]);

      return adminOk({
        committedBytes: stats.committedBytes,
        reservedBytes: stats.reservedBytes,
        trashBytes: stats.trashBytes,
        byPlan,
        largest,
        openReservations,
        // Stated in the payload so the UI cannot accidentally present these as
        // R2's billed infrastructure usage. They are Orindle's logical accounting.
        source: "logical" as const,
      });
    },
    { permission: "view_operations", limit: "adminRead" },
  );
}

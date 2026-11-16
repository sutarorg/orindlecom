/**
 * GET /api/admin/teams — the organization directory.
 *
 * Read-only. Membership operations stay in the customer-facing business layer,
 * which is not implemented yet; building a second, admin-side path to the same
 * rows would create two sets of rules for one table.
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getTeamDirectory } from "@/lib/admin/service";
import { pagination, searchTerm } from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const params = queryOf(request);
      const page = pagination(params);

      return adminOk(
        await getTeamDirectory(ctx, {
          search: searchTerm(params.get("q")),
          ...page,
        }),
      );
    },
    { permission: "view_operations", limit: "adminSearch" },
  );
}

/**
 * GET /api/admin/users — the user directory.
 *
 * Search, filter, sort and paginate all execute in SQL (`admin_user_directory`).
 * Nothing here fetches a page of users and filters it in JavaScript, because that
 * would silently mean "search the 25 rows you can see".
 */

import { adminOk, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getUserDirectory } from "@/lib/admin/service";
import {
  PLANS,
  SUB_STATUSES,
  USER_SORTS,
  dateRange,
  oneOf,
  pagination,
  searchTerm,
} from "@/lib/admin/validation";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const params = queryOf(request);
      const page = pagination(params);

      const verifiedParam = params.get("verified");
      if (verifiedParam !== null && verifiedParam !== "true" && verifiedParam !== "false") {
        throw new AppError("validation_failed", "The verified filter must be true or false.");
      }

      const planParam = params.get("plan");
      const statusParam = params.get("status");
      const range = dateRange(params.get("from"), params.get("to"));

      const query = {
        search: searchTerm(params.get("q")),
        plan: planParam ? oneOf(planParam, PLANS, "free", "plan") : null,
        verified: verifiedParam === null ? null : verifiedParam === "true",
        status: statusParam ? oneOf(statusParam, SUB_STATUSES, "none", "status") : null,
        // dateRange names these from/to; the SQL function calls them
        // created_after/created_before. Mapped explicitly rather than spread,
        // because a spread would silently carry the wrong key names.
        createdAfter: range.from,
        createdBefore: range.to,
        sort: oneOf(params.get("sort"), USER_SORTS, "newest", "sort"),
        ...page,
      };

      return adminOk(await getUserDirectory(ctx, query));
    },
    { permission: "view_operations", limit: "adminSearch" },
  );
}

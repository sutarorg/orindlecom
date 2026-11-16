/**
 * GET /api/admin/users/export — the current filtered result set as CSV.
 *
 * Notes on the choices:
 *
 *   - **Bounded.** 5,000 rows maximum, stated in the response header
 *     `X-Export-Truncated` when hit, so the file cannot silently claim to be
 *     complete.
 *   - **The same filters as the list.** An export that ignores the filters on
 *     screen produces a file nobody expects.
 *   - **Audited.** The download is recorded (who exported how many accounts),
 *     because "an operator pulled a list of every customer" is exactly the kind of
 *     event an audit trail exists for.
 *   - **No privileged data.** No ids, no hashes, no tokens — an email address and
 *     an operator-visible status only.
 */

import { AppError } from "@/domain/auth/errors";
import { writeAudit } from "@/lib/admin/audit";
import { ADMIN_HEADERS, adminRoute, queryOf } from "@/lib/admin/route-helpers";
import { getUserDirectory } from "@/lib/admin/service";
import { toCsv } from "@/lib/admin/csv";
import {
  PLANS,
  SUB_STATUSES,
  USER_SORTS,
  dateRange,
  oneOf,
  searchTerm,
} from "@/lib/admin/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 5_000;

export async function GET(request: Request) {
  return adminRoute(
    async (ctx) => {
      const params = queryOf(request);
      const verifiedParam = params.get("verified");
      if (verifiedParam !== null && verifiedParam !== "true" && verifiedParam !== "false") {
        throw new AppError("validation_failed", "The verified filter must be true or false.");
      }

      const planParam = params.get("plan");
      const statusParam = params.get("status");
      const range = dateRange(params.get("from"), params.get("to"));

      const base = {
        search: searchTerm(params.get("q")),
        plan: planParam ? oneOf(planParam, PLANS, "free", "plan") : null,
        verified: verifiedParam === null ? null : verifiedParam === "true",
        status: statusParam ? oneOf(statusParam, SUB_STATUSES, "none", "status") : null,
        createdAfter: range.from,
        createdBefore: range.to,
        sort: oneOf(params.get("sort"), USER_SORTS, "newest", "sort"),
      };

      // Fetch in pages of 200 (the SQL cap) until the bound is reached. Loop rather
      // than asking for 5000 at once, because the function clamps the page size —
      // and a comment explaining that is cheaper than a mystery later.
      const rows: Awaited<ReturnType<typeof getUserDirectory>>["rows"] = [];
      let offset = 0;
      let total = 0;

      while (offset < MAX_ROWS) {
        const page = await getUserDirectory(ctx, {
          ...base,
          page: Math.floor(offset / 200) + 1,
          pageSize: 200,
          offset,
        });
        total = page.total;
        rows.push(...page.rows);
        if (page.rows.length < 200) break;
        offset += 200;
      }

      const truncated = total > rows.length;

      const csv = toCsv(
        ["name", "email", "plan", "subscription_status", "email_verified", "created_at", "storage_committed_bytes"],
        rows.slice(0, MAX_ROWS).map((row) => [
          row.fullName ?? "",
          row.email ?? "",
          row.planId,
          row.subscriptionStatus ?? "none",
          row.emailVerified ? "yes" : "no",
          row.createdAt,
          row.storageCommitted,
        ]),
      );

      // Recorded before the download is returned. If this write fails, `writeAudit`
      // throws and the operator gets an error rather than an unaudited copy of the
      // customer list — which is the correct trade for this particular export.
      await writeAudit(ctx, {
        action: "admin.exported",
        targetType: "platform_admin",
        targetId: ctx.admin.userId,
        metadata: { rows: rows.length, truncated, filters: { plan: base.plan, status: base.status } },
      });

      return new Response(csv, {
        status: 200,
        headers: {
          ...ADMIN_HEADERS,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="orindle-users-${new Date().toISOString().slice(0, 10)}.csv"`,
          "X-Export-Rows": String(rows.length),
          "X-Export-Truncated": truncated ? "true" : "false",
        },
      });
    },
    { permission: "view_operations", limit: "adminExport" },
  );
}

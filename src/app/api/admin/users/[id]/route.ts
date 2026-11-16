/**
 * GET /api/admin/users/:id — one account.
 *
 * What is deliberately absent:
 *   - password hashes, MFA secrets, tokens, raw auth metadata
 *   - file names, object keys, signed URLs
 *   - device or IP hashes (anti-abuse internals, see docs/security/anti-abuse-system.md)
 *
 * There is no write verb on this route at all. Account suspension and deletion
 * are not implemented, by design; see docs/admin/ADMIN-ARCHITECTURE.md §7.
 */

import { AppError } from "@/domain/auth/errors";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { getUserDetail } from "@/lib/admin/service";
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
      const userId = uuidParam(id, "account");

      const user = await getUserDetail(ctx, userId);
      if (!user) throw new AppError("not_found", "That account doesn't exist.");

      return adminOk(user);
    },
    { permission: "view_operations", limit: "adminRead" },
  );
}

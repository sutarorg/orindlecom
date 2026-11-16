/**
 * GET /api/billing/subscription
 *
 * Returns the authenticated user's current subscription state (or Free plan
 * when no paid subscription is active).
 */

import "server-only";

import { handle, ok, withActor } from "@/lib/api";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const repo = getDriveRepository();
    const result = await repo.subscription();

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

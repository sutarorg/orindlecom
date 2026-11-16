/**
 * GET  /api/files/:id/grants — who has access.
 * POST /api/files/:id/grants — grant access to an email address.
 *
 * The caller names an *email*, never a user id. The server resolves it, so a
 * request cannot name an arbitrary account. When no account exists for the address
 * the response says so rather than creating a grant against nobody.
 */

import "server-only";

import {
  enforceRateLimit,
  handle,
  ok,
  readJson,
  requireString,
  withActor,
} from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import type { PermissionLevel } from "@/lib/drive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function readPermission(value: unknown): PermissionLevel {
  if (value === "viewer" || value === "editor") return value;
  throw new AppError("validation_failed", "Choose whether they can view or edit.");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.listGrants(id);

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok({ grants: result.data });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("share.grant", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    const email = requireString(body, "email", { max: 254 }).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AppError("validation_failed", "That doesn't look like an email address.");
    }

    const permission = readPermission(body.permission);

    const repo = getDriveRepository();
    const result = await repo.addGrant({ itemId: id, email, permission });

    if (!result.ok) {
      if (result.code === "not_found") {
        // The address has no account. Saying that plainly is better than a grant
        // that appears to exist and grants nothing.
        throw new AppError(
          "not_found",
          "That person doesn't have an Orindle account yet. Share a link instead.",
        );
      }
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok(result.data);
  });
}

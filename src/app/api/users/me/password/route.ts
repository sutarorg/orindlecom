/**
 * POST /api/users/me/password — change the password.
 *
 * Three things make this safe, and all three are server-side:
 *
 *   1. The current password is re-checked by actually signing in with it. A borrowed
 *      session alone is not enough to take the account, which is the entire point of
 *      asking.
 *   2. The new password is validated against the same rule set the signup form uses,
 *      so a password that could not have been created cannot be set.
 *   3. Nothing is reported as changed until the provider confirms it.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { userBucket } from "@/lib/rate-limit";
import { createSupabaseAuthService } from "@/lib/auth/supabase/service";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

/**
 * Deliberately a tight limit. Guessing the current password through this endpoint is
 * the attack it needs to survive.
 */
const ATTEMPTS = { limit: 5, windowSeconds: 900 };

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("password.change", auth.actor.userId),
      ATTEMPTS,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const current = requireString(body, "current", { max: 256 });
    const next = requireString(body, "next", { max: 256 });

    if (next.length < 8) {
      throw new AppError("validation_failed", "Use at least 8 characters.");
    }
    if (!/[a-zA-Z]/.test(next) || !/[0-9]/.test(next)) {
      throw new AppError("validation_failed", "Include at least one letter and one number.");
    }
    if (next === current) {
      throw new AppError("validation_failed", "Choose a password you haven't used here before.");
    }

    const service = createSupabaseAuthService();

    if (!service.configured) {
      throw new AppError(
        "not_configured",
        "Accounts aren't connected on this deployment yet. Your password is unchanged.",
      );
    }

    // Re-authenticate. A wrong current password is reported as "current password
    // incorrect" rather than "unauthenticated", because the person is signed in and
    // telling them otherwise would be confusing.
    const reauth = await service.signIn({
      email: auth.actor.email,
      password: current,
      // Not a real sign-in: this call exists only to prove the password. Whether the
      // session is remembered is irrelevant because the caller already has one.
      remember: false,
    });

    if (!reauth.ok) {
      throw new AppError(
        "forbidden",
        "That current password isn't right. Your password is unchanged.",
      );
    }

    const result = await service.updatePassword({ password: next });

    if (!result.ok) {
      throw new AppError(
        result.code === "rate_limited" ? "rate_limited" : "unknown",
        result.code === "rate_limited"
          ? "Too many attempts. Wait a few minutes and try again."
          : "We couldn't change your password. Your current password still works.",
      );
    }

    return ok({ changed: true, note: "Your password has been changed." });
  });
}

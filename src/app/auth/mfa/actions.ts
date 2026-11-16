"use server";

/**
 * The second-factor challenge.
 *
 * Two rules govern this file, both from the requirements:
 *
 *   1. **A failed or absent challenge never reaches the dashboard.** The success
 *      path returns a redirect only after Supabase confirms the code, which is
 *      also what upgrades the session to AAL2. There is no branch that "assumes"
 *      success.
 *   2. **No factor, no challenge.** If the account has no verified TOTP factor the
 *      action sends the visitor onward, because showing a code prompt to someone
 *      who never enrolled would be a lockout dressed as security.
 */

import { redirect } from "next/navigation";
import { getAuthService } from "@/lib/auth/service";
import type { AuthFormState } from "@/lib/auth/form-state";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { LIMITS, consume, userBucket } from "@/lib/rate-limit";

export async function verifyMfaAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeRedirectPath(formData.get("next")?.toString() ?? null, "/dashboard");

  if (!/^\d{6}$/.test(code)) {
    return {
      status: "error",
      message: "Enter the six-digit code from your authenticator app.",
      code: "mfa_invalid",
      fieldErrors: { token: "Six digits." },
    };
  }

  const service = getAuthService();
  const session = await service.getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const limit = await consume(userBucket("mfa.challenge", session.user.id), LIMITS.mfaChallenge);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Too many codes tried. Wait a few minutes and try again.",
      code: "rate_limited",
      retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
    };
  }

  const state = await service.mfaState();
  if (!state.ok) {
    return { status: "error", message: state.message, code: state.code };
  }

  // Nothing enrolled: this session is already as strong as the account allows.
  if (state.data.factors.length === 0) {
    redirect(next);
  }

  const factor = state.data.factors[0];
  const result = await service.verifyTotp(factor.id, code);
  if (!result.ok) {
    return { status: "error", message: result.message, code: result.code };
  }

  // verify() upgraded the session to AAL2. Confirm it did rather than assuming:
  // this is the one assertion that stands between a correct code and a bypassed
  // second factor.
  const after = await service.mfaState();
  if (!after.ok || after.data.currentLevel !== "aal2") {
    return {
      status: "error",
      message: "That code was accepted, but the session didn't upgrade. Sign out and try again.",
      code: "mfa_required",
    };
  }

  redirect(next);
}

/**
 * Sign out from the challenge screen.
 *
 * A person who has lost their authenticator needs a way out that is not "email
 * support". Signing out is it: the account is not locked, and the recovery
 * procedure documented in docs/security/authentication.md picks up from there.
 */
export async function abandonMfaAction(): Promise<void> {
  await getAuthService().signOut();
  redirect("/login");
}

"use server";

/**
 * Password setup for Google-created accounts.
 *
 * The requirement is that this step is mandatory for a new Google account, is not
 * re-shown once completed, and never overwrites the password of an existing
 * email/password account that later links Google.
 *
 * Those three properties come from three separate guards, and all three are
 * needed:
 *
 *   1. A session must exist. `updateUser` would fail anyway, but the failure
 *      message would be about the provider rather than about the situation.
 *   2. `account_security.signup_provider` must be `google`, and the row must say
 *      setup is still required. An email/password account reaching this action is
 *      a bug or an attack, and is refused rather than silently allowed to change
 *      its password without knowing its current one.
 *   3. The database is updated only after Supabase confirms the password change.
 */

import { redirect } from "next/navigation";
import { getAuthService } from "@/lib/auth/service";
import { toFormState, type AuthFormState } from "@/lib/auth/form-state";
import { safeRedirectPath } from "@/lib/auth/redirect";
import {
  validateConfirmPassword,
  validateNewPassword,
  type FieldErrors,
} from "@/lib/auth/validation";
import { markPasswordSet, readOwnSecurity } from "@/lib/security/account-security";
import { LIMITS, consume, userBucket } from "@/lib/rate-limit";

export async function setPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const next = safeRedirectPath(formData.get("next")?.toString() ?? null, "/dashboard");

  const fieldErrors: FieldErrors = {};
  const passwordError = validateNewPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  const confirmError = validateConfirmPassword(password, confirmPassword);
  if (confirmError) fieldErrors.confirmPassword = confirmError;

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the fields below and try again.",
      code: "invalid_input",
      fieldErrors,
    };
  }

  const session = await getAuthService().getCurrentSession();
  if (!session) {
    return {
      status: "error",
      message: "Your session expired. Sign in again to finish setting your password.",
      code: "session_missing",
    };
  }

  // Rate limit on the account, not the IP: this endpoint is only reachable with a
  // session, so the account is the meaningful unit.
  const limit = await consume(userBucket("set-password", session.user.id), LIMITS.setPassword);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Too many attempts just now. Wait a few minutes and try again.",
      code: "rate_limited",
      retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
    };
  }

  // Guard 2: the account must be a Google account that still owes a password.
  const security = await readOwnSecurity();
  if (security.signupProvider !== "google") {
    return {
      status: "error",
      message: "This account signs in with a password already. Use Change password in Settings.",
      code: "invalid_input",
    };
  }
  if (!security.passwordSetupRequired) {
    // Already done — most likely a stale tab. Sending them onward is kinder than
    // an error, and it cannot re-arm the step because the flag is server-owned.
    redirect(next);
  }

  const result = await getAuthService().updatePassword({ password });
  if (!result.ok) return toFormState(result);

  // Guard 3: only now is the requirement discharged. If this write fails the
  // step remains required, which is the safe direction — the person is asked
  // again rather than being let through on an unrecorded change.
  const recorded = await markPasswordSet(session.user.id);
  if (!recorded) {
    console.error("[set-password] password updated but account_security was not marked", {
      userId: session.user.id,
    });
    return {
      status: "error",
      message:
        "Your password was set, but we couldn't record it. Refresh this page and it should clear itself.",
      code: "unknown",
    };
  }

  await logCompletion(session.user.id);
  redirect(next);
}

async function logCompletion(userId: string): Promise<void> {
  try {
    const { getServiceClient, isServiceConfigured } = await import("@/lib/supabase/service");
    if (!isServiceConfigured()) return;
    await getServiceClient()
      .from("risk_events")
      .insert({ user_id: userId, kind: "password_setup_completed", level: "low" });
  } catch {
    // Logging never blocks a completed onboarding.
  }
}

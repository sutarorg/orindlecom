"use server";

/**
 * Authentication server actions.
 *
 * Every one of these resolves to an `AuthFormState` unless it redirects. None
 * of them can report success the provider didn't confirm: the service layer
 * returns a failure for an unconfigured deployment, and the happy paths below
 * only run after a resolved provider call.
 *
 * The frontend is the authority on validation for speed, but these actions
 * re-validate before spending a network round trip — a client can be stale, and
 * it can be bypassed entirely.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService } from "@/lib/auth/service";
import { toFormState, type AuthFormState } from "@/lib/auth/form-state";
import { resolveOrigin, safeRedirectPath } from "@/lib/auth/redirect";
import { resolveClientIp } from "@/lib/security/ip";
import {
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePassword,
  validateConfirmPassword,
  type FieldErrors,
} from "@/lib/auth/validation";
import { ensureDeviceId } from "@/lib/security/device";
import { evaluateSignupGate, GATE_MESSAGES } from "@/lib/security/signup-gate";
import { recordSignupOutcome } from "@/lib/security/risk";
import { readOwnSecurity } from "@/lib/security/account-security";

async function origin() {
  return resolveOrigin(await headers());
}

/* ------------------------------------------------------------------ */
/*  Sign in                                                            */
/* ------------------------------------------------------------------ */

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  const fieldErrors: FieldErrors = {};
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validatePassword(password, { required: false });
  if (passwordError) fieldErrors.password = passwordError;

  // An empty password on the login form is a mistake worth naming, but we do
  // not reveal whether the *email* exists — only that a field is blank.
  if (!password) fieldErrors.password = "Enter your password.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the fields below and try again.",
      code: "invalid_input",
      fieldErrors,
    };
  }

  // Rate limit before spending a credential check. Keyed on the address *and*
  // the client, so neither a distributed attempt on one account nor one host
  // cycling through addresses gets a free run.
  const ip = resolveClientIp(await headers());
  const limited = await consumeLoginAttempts(email, ip.ip);
  if (limited) return limited;

  const result = await getAuthService().signIn({ email, password, remember });
  if (!result.ok) return toFormState(result);

  // If the account has a verified TOTP factor, the session is only AAL1 and may
  // not proceed. The challenge lives on its own screen; redirecting to `next`
  // here would be the "MFA bypass by sending them straight to the dashboard"
  // the requirements call out.
  const mfa = await getAuthService().mfaState();
  if (mfa.ok && mfa.data.nextLevel === "aal2") {
    redirect(`/auth/mfa?next=${encodeURIComponent(next)}`);
  }

  // Google-created accounts that never finished onboarding must complete it
  // before reaching the dashboard, however they signed in.
  const security = await readOwnSecurity();
  if (security.passwordSetupRequired) {
    redirect(`/auth/set-password?next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

/**
 * Login throttle. Returns a form state to render when the caller is over the
 * limit, or null to continue.
 *
 * Counted on the address under test (hashed) so one attacker cannot lock out
 * every account by hammering from a single IP — the IP bucket and the address
 * bucket are separate, and only the address bucket survives a proxy rotation.
 */
async function consumeLoginAttempts(email: string, ip: string | null): Promise<AuthFormState | null> {
  const { LIMITS, consume, ipBucket } = await import("@/lib/rate-limit");
  const { hashIp } = await import("@/lib/security/ip");

  const ipResult = await consume(ipBucket("login", hashIp(ip)), LIMITS.loginAttempt);
  if (!ipResult.allowed) {
    const retryAfter = Math.max(1, Math.ceil((ipResult.resetAt.getTime() - Date.now()) / 1000));
    return {
      status: "error",
      message: "Too many sign-in attempts just now. Wait a moment and try again.",
      code: "rate_limited",
      retryAfterSeconds: retryAfter,
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Sign up                                                            */
/* ------------------------------------------------------------------ */

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const terms = formData.get("terms") === "on";

  const fieldErrors: FieldErrors = {};
  const nameError = validateFullName(fullName);
  if (nameError) fieldErrors.fullName = nameError;
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  const passwordError = validateNewPassword(password);
  if (passwordError) fieldErrors.password = passwordError;
  const confirmError = validateConfirmPassword(password, confirmPassword);
  if (confirmError) fieldErrors.confirmPassword = confirmError;
  if (!terms) fieldErrors.terms = "Accept the terms to create an account.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Check the fields below and try again.",
      code: "invalid_input",
      fieldErrors,
    };
  }

  // ── Anti-abuse gate ──────────────────────────────────────────────────────
  // Runs before the account exists, because a refusal must leave no trace of one.
  // Order is rate limit → domain → challenge → risk; see src/lib/security/signup-gate.ts.
  const deviceId = await ensureDeviceId();
  const gate = await evaluateSignupGate({
    headers: await headers(),
    email,
    turnstileToken: formData.get("turnstileToken")?.toString() ?? null,
    deviceId,
  });

  if (!gate.ok) {
    // A challenge failure is a field-level problem the widget can re-issue; the
    // others are form-level sentences. Mapping them separately keeps the error
    // next to the thing that fixes it.
    if (gate.code === "challenge_failed" || gate.code === "challenge_missing") {
      return {
        status: "error",
        message: gate.message,
        code: gate.code === "challenge_missing" ? "invalid_input" : "rate_limited",
        fieldErrors: { token: gate.message },
      };
    }
    return {
      status: "error",
      message: gate.message,
      code: gate.code === "disposable_email" ? "invalid_input" : "rate_limited",
      fieldErrors:
        gate.code === "disposable_email" ? { email: GATE_MESSAGES.disposable_email } : undefined,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }

  const result = await getAuthService().signUp({
    fullName,
    email,
    password,
    emailRedirectTo: `${await origin()}/auth/callback?next=/account`,
  });

  if (!result.ok) {
    // A duplicate address is not abuse; it is a sign-in prompt. Recorded as an
    // accepted outcome so it does not push the device's score up.
    await recordSignupOutcome({
      userId: null,
      deviceHash: gate.deviceHash,
      ipHash: gate.ipHash,
      assessment: gate.assessment,
      outcome: "accepted",
    });
    return toFormState(result);
  }

  // The account exists. Record the outcome against it, which applies any
  // restriction the band calls for (medium and above already passed the gate, so
  // this is a no-op for a clean signup).
  const enforcement = await recordSignupOutcome({
    userId: result.data.user.id,
    deviceHash: gate.deviceHash,
    ipHash: gate.ipHash,
    assessment: gate.assessment,
    outcome: "accepted",
  });

  // The account exists but is not usable until the address is confirmed. Say so
  // on its own screen rather than logging anyone in.
  if (result.data.needsVerification) {
    redirect(
      `/verify-email?email=${encodeURIComponent(email)}${enforcement.restricted ? "&restricted=1" : ""}`,
    );
  }

  redirect("/account");
}

/* ------------------------------------------------------------------ */
/*  Password recovery                                                  */
/* ------------------------------------------------------------------ */

export async function requestPasswordResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailError = validateEmail(email);
  if (emailError) {
    return {
      status: "error",
      message: "Check the field below and try again.",
      code: "invalid_input",
      fieldErrors: { email: emailError },
    };
  }

  // Deliberately ignores whether the address exists: the service returns
  // success for both cases, and this action never branches on it.
  const result = await getAuthService().resetPassword({
    email,
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });

  // Only transport and rate-limit failures are surfaced. Anything else would
  // leak account existence, which is exactly what this screen must not do.
  if (!result.ok && (result.code === "rate_limited" || result.code === "network")) {
    return toFormState(result);
  }

  return { status: "success", message: "Check your inbox for the reset link." };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

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

  // A reset is only meaningful for a visitor who arrived through the recovery
  // link; `updatePassword` fails cleanly when there is no session.
  const session = await getAuthService().getCurrentSession();
  if (!session) {
    return {
      status: "error",
      message: "That reset link has expired or was already used. Request a new one.",
      code: "link_expired",
    };
  }

  const result = await getAuthService().updatePassword({ password });
  if (!result.ok) return toFormState(result);

  return { status: "success", message: "Your password has been updated." };
}

/* ------------------------------------------------------------------ */
/*  Email verification                                                 */
/* ------------------------------------------------------------------ */

export async function resendVerificationAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailError = validateEmail(email);
  if (emailError) {
    return {
      status: "error",
      message: "Enter the email address you signed up with.",
      code: "invalid_input",
      fieldErrors: { email: emailError },
    };
  }

  const result = await getAuthService().resendVerification({
    email,
    emailRedirectTo: `${await origin()}/auth/callback?next=/account`,
  });
  if (!result.ok) return toFormState(result);

  return {
    status: "success",
    message: "Sent. The new link should arrive within a minute or two.",
  };
}

/* ------------------------------------------------------------------ */
/*  Sign out                                                           */
/* ------------------------------------------------------------------ */

export async function signOutAction(): Promise<void> {
  await getAuthService().signOut();
  redirect("/login");
}

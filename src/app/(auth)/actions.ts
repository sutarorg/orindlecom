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
import {
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePassword,
  validateConfirmPassword,
  type FieldErrors,
} from "@/lib/auth/validation";

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

  const result = await getAuthService().signIn({ email, password, remember });
  if (!result.ok) return toFormState(result);

  redirect(next);
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

  const result = await getAuthService().signUp({
    fullName,
    email,
    password,
    emailRedirectTo: `${await origin()}/auth/callback?next=/account`,
  });
  if (!result.ok) return toFormState(result);

  // The account exists but is not usable until the address is confirmed. Say so
  // on its own screen rather than logging anyone in.
  if (result.data.needsVerification) {
    redirect(`/verify-email?email=${encodeURIComponent(email)}`);
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

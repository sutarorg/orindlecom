/**
 * Mapping from provider errors to the UI's stable error codes.
 *
 * Provider messages change without notice, so nothing here surfaces raw
 * provider text. The mapped message is written for a person who is trying to
 * get into their account, not for a developer reading a log.
 */

import type { AuthErrorCode, AuthFailure } from "../types";

export function failure(
  code: AuthErrorCode,
  message: string,
  extra?: Omit<AuthFailure, "ok" | "code" | "message">,
): AuthFailure {
  return { ok: false, code, message, ...extra };
}

/** Supabase returns `{ message, status, code }`; we only trust `code`/`status`. */
interface ProviderErrorLike {
  message?: string;
  status?: number;
  code?: string;
}

/**
 * Maps a Supabase auth error to a stable code and a human message.
 *
 * Order matters: `status` is checked before `message` because Supabase's free
 * tier returns status 429 for email-rate limits, which is the single most
 * common real-world failure on a signup form.
 */
export function mapProviderError(error: ProviderErrorLike | null | undefined): AuthFailure {
  const status = error?.status;
  const raw = (error?.code ?? error?.message ?? "").toLowerCase();

  if (status === 429 || raw.includes("rate limit") || raw.includes("over_email_send_rate_limit")) {
    return failure(
      "rate_limited",
      "Too many attempts just now. Wait a minute and try again.",
      { retryAfterSeconds: 60 },
    );
  }

  if (raw.includes("invalid_credentials") || raw.includes("invalid login credentials")) {
    return failure("invalid_credentials", "That email and password don't match an account.");
  }

  if (raw.includes("email_not_confirmed") || raw.includes("email not confirmed")) {
    return failure(
      "email_not_confirmed",
      "Confirm your email address first — we sent you a link when you signed up.",
    );
  }

  if (raw.includes("user_already_exists") || raw.includes("already registered")) {
    return failure("user_already_exists", "An account already exists for that email address.");
  }

  if (raw.includes("weak_password") || raw.includes("password should be")) {
    return failure("weak_password", "Choose a stronger password.", {
      fieldErrors: { password: "Choose a stronger password." },
    });
  }

  if (raw.includes("same_password")) {
    return failure("same_password", "Choose a password you haven't used before.", {
      fieldErrors: { password: "This is your current password." },
    });
  }

  if (raw.includes("flow_state") || raw.includes("code verifier") || raw.includes("expired")) {
    return failure(
      "link_expired",
      "That link has expired or was already used. Request a new one below.",
    );
  }

  if (raw.includes("provider") && raw.includes("not enabled")) {
    return failure("provider_disabled", "That sign-in method isn't enabled for this deployment.");
  }

  if (raw.includes("fetch") || raw.includes("network") || raw.includes("timeout")) {
    return failure("network", "We couldn't reach the server. Check your connection and try again.");
  }

  return failure("unknown", "Something went wrong on our side. Please try again.");
}

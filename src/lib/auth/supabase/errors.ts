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
  /*
   * Both fields are joined rather than picking one. Supabase sets a machine code
   * and a human message on the same error, and the pair does not always carry the
   * same information: "Error sending confirmation email" arrives with the generic
   * code `unexpected_failure`, so matching on the code alone can never identify
   * it, and matching on the message alone would stop working the day a more
   * specific code is introduced. Checking both means a mapping keyed on either
   * still fires.
   */
  const raw = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

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

  /*
   * The stock `{{ .ConfirmationURL }}` produces a `token=pkce_…` link. Supabase's
   * `/auth/v1/verify` confirms the address, then redirects here with `?code=…`
   * and expects it to be exchanged against the code-verifier cookie written when
   * signup started. Two things make that exchange fail, and neither is a 24-hour
   * expiry:
   *
   *   `flow_state_expired` — GoTrue keeps the PKCE flow state for 300 seconds
   *      (`GOTRUE_EXTERNAL_FLOW_STATE_EXPIRY_DURATION`, default `300s`), counted
   *      from *signup*, not from the click. A link opened more than five minutes
   *      after signing up cannot be exchanged even though the emailed token is
   *      still inside its 24-hour window. This is the "expired before 24 hours"
   *      report: the address is usually already confirmed at this point, because
   *      `/auth/v1/verify` completed before handing back the code.
   *
   *   `pkce_code_verifier_not_found` / "code verifier" — the link was opened in a
   *      browser that never held the cookie: another device, a mail app's in-app
   *      browser, a private window, or a different origin from the one that signed
   *      up.
   *
   * Both are reported as `session_missing`, never `link_expired`. Saying "expired"
   * sends people to request a replacement for a link that was not the problem,
   * and in the flow-state case the account is already confirmed — what they need
   * is to sign in. `verifyEmailLink` (token_hash) never reaches this branch; it is
   * reachable only from the `?code=` shape.
   */
  if (raw.includes("flow_state") || raw.includes("code verifier")) {
    return failure(
      "session_missing",
      "That link was already confirmed or has to be opened in the same browser you signed up in. Sign in below — your address is most likely confirmed already.",
    );
  }

  if (raw.includes("expired") || raw.includes("otp_expired") || raw.includes("token has expired")) {
    return failure(
      "link_expired",
      "That link has expired or was already used. Request a new one below.",
    );
  }

  if (raw.includes("provider") && raw.includes("not enabled")) {
    return failure("provider_disabled", "That sign-in method isn't enabled for this deployment.");
  }

  /*
   * The account was created but the confirmation email could not be sent —
   * typically the project has no SMTP provider configured, or the SMTP provider
   * rejected the message. GoTrue reports this as a 500 with an
   * "Error sending confirmation email" message and `unexpected_failure` code.
   *
   * This must not fall through to the generic `unknown` message, for two reasons:
   * it is not a bug in this app, so retrying the same form will fail the same way;
   * and it leaves a real account behind that the visitor cannot reach, which they
   * need to know about. Ordered before the generic checks below because the
   * message also contains "email", which `email_not_confirmed` matches on — and
   * that would send someone to a confirmation link that was never delivered.
   */
  if (raw.includes("error sending confirmation email") || raw.includes("error sending email")) {
    return failure(
      "email_delivery_failed",
      "We created your account, but couldn't send the confirmation email. Please contact support so we can activate it — signing up again won't help.",
    );
  }

  if (raw.includes("fetch") || raw.includes("network") || raw.includes("timeout")) {
    return failure("network", "We couldn't reach the server. Check your connection and try again.");
  }

  /*
   * Nothing matched. Log the provider's own code and status before returning the
   * generic sentence: without this, `unknown` is a dead end in production, because
   * the response the visitor sees carries no detail and the mapped failure carries
   * none either. Logging the code and status (never the message body) is enough to
   * identify a new failure mode from server logs without exposing provider
   * internals to the browser.
   */
  console.error(
    "[auth] unmapped provider error:",
    JSON.stringify({ code: error?.code, status: error?.status, message: error?.message }),
  );
  return failure("unknown", "Something went wrong on our side. Please try again.");
}

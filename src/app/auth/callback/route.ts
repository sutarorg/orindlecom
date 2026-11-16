import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { ensureSecurityRow, readSecurityFor } from "@/lib/security/account-security";
import { hashDevice } from "@/lib/security/ip";
import { readDeviceId } from "@/lib/security/device";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

/**
 * OAuth / email-link callback.
 *
 * Supabase sends two shapes here:
 *   - `?code=...`                     — PKCE (OAuth, magic link)
 *   - `?token_hash=...&type=signup`   — email confirmation
 * plus `?error=access_denied` when the visitor cancels at the provider.
 *
 * This route never renders. Every outcome is a redirect, because a callback URL
 * sitting in browser history must not be re-openable into a live session error
 * page, and because the visitor's next action is always "go somewhere useful".
 *
 * Failure destinations carry a code, never provider text — those strings leak
 * internals and change without notice.
 *
 * ── First sign-in vs returning ───────────────────────────────────────────────
 *
 * After a successful exchange the account's onboarding state is read from
 * `account_security`, which is written by a database trigger and is not
 * client-writable. That is the authority. It is deliberately NOT:
 *
 *   - a `?isNewUser=true` query parameter (client-supplied),
 *   - `created_at` on its own (a returning Google user on a new browser looks
 *     identical to a new one by timing alone),
 *   - whether a session existed before (always false after a fresh OAuth).
 *
 * The provider's own email-verification claim is also recorded here, read from
 * the auth server's user record rather than from anything in the request.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const next = safeRedirectPath(searchParams.get("next"));

  // Recovery links must land on the password form, not the account page.
  const successPath = type === "recovery" ? "/reset-password" : next;

  const fail = (reason: string, path = "/login") => {
    const url = new URL(path, request.nextUrl.origin);
    url.searchParams.set("error", reason);
    const response = NextResponse.redirect(url);
    // A callback response must never be cached: the URL carries a one-time code.
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  if (!code && !tokenHash) {
    if (error) {
      // `access_denied` is the visitor pressing Cancel, not a failure to report
      // as an error — send them back to the form with a quiet note.
      return fail(error === "access_denied" ? "oauth_denied" : "callback_failed");
    }
    return fail("callback_failed");
  }

  const outcome = await getAuthService().handleOAuthCallback({
    code,
    tokenHash,
    tokenType: type,
    error,
  });

  if (!outcome.ok) {
    switch (outcome.code) {
      case "not_configured":
        return fail("not_configured");
      case "link_expired":
        // Expired confirmation links need somewhere to re-request from.
        return fail("link_expired", "/verify-email");
      case "oauth_denied":
        return fail("oauth_denied");
      case "rate_limited":
        return fail("rate_limited");
      case "network":
        return fail("network");
      case "session_missing":
      default:
        // A broken recovery session should offer a fresh link rather than a
        // login form the visitor just failed to use.
        return type === "recovery" ? fail("link_expired", "/forgot-password") : fail("callback_failed");
    }
  }

  const user = outcome.session.user;

  // ── Provider verification, read from the auth server's record ──────────────
  // `emailConfirmed` comes from `user.email_confirmed_at`, which Supabase sets
  // from the provider's assertion. Nothing in the request can influence it.
  const providerVerified = user.emailConfirmed;

  // ── Onboarding state ──────────────────────────────────────────────────────
  // A row exists for every auth user (0014's trigger). Creating it here is a
  // belt-and-braces pass for accounts that predate the migration.
  let security = await readSecurityFor(user.id);
  if (!security) {
    await ensureSecurityRow({
      userId: user.id,
      provider: "google",
      emailVerified: providerVerified,
    });
    security = await readSecurityFor(user.id);
  }

  // ── Signup accounting ─────────────────────────────────────────────────────
  // A first-time Google signup is an account creation like any other and is
  // recorded once, keyed on the user id so a returning login cannot inflate the
  // device's count. `ignoreDuplicates` on the unique pair is what makes "once"
  // true rather than "usually once".
  if (security?.signupProvider === "google" && security.passwordSetupRequired) {
    await recordOAuthSignup(user.id);
  }

  // An account that has not finished onboarding goes to Set Password, whichever
  // way it signed in. This is what makes an interrupted setup resumable: the
  // flag is in the database, so the next sign-in lands here again.
  if (security?.passwordSetupRequired) {
    const target = new URL("/auth/set-password", request.nextUrl.origin);
    target.searchParams.set("next", next);
    return noStore(NextResponse.redirect(target));
  }

  return noStore(NextResponse.redirect(new URL(successPath, request.nextUrl.origin)));
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Record a first-time Google account against its device.
 *
 * Failures are logged and swallowed: a missing device row weakens one signal, and
 * turning that into a failed sign-in would be worse than the weakened signal.
 */
async function recordOAuthSignup(userId: string): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    const deviceId = await readDeviceId();
    const supabase = getServiceClient();
    await supabase.from("risk_events").insert({
      user_id: userId,
      device_hash: hashDevice(deviceId),
      kind: "signup_oauth",
      level: "low",
      metadata: { provider: "google" },
    });
    await supabase.from("device_signups").insert({
      device_hash: hashDevice(deviceId) ?? "unknown",
      user_id: userId,
      outcome: "accepted",
      risk_level: "low",
    });
  } catch {
    // See the note above: best effort by design.
  }
}

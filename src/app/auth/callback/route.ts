import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";

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

  const response = NextResponse.redirect(new URL(successPath, request.nextUrl.origin));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

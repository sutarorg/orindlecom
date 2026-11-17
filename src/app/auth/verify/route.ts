/**
 * Server-side verification of Supabase email links.
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 * GoTrue's default confirmation link is `{{ .ConfirmationURL }}`, which is
 * `<site>/auth/v1/verify?token=<token>&type=signup&redirect_to=<our callback>`.
 * The auth server verifies the token *there*, then redirects to
 * `<our callback>?code=<pkce code>`, and `/auth/callback` exchanges that code —
 * which requires the PKCE code verifier cookie the browser set when the flow
 * began. That cookie is not there when the link is opened in a different browser,
 * a different device, or after the cookie has been cleared, which is the normal
 * way people open a link from their inbox.
 *
 * The exchange then fails with a `flow_state` / "code verifier" error, and
 * `mapProviderError` maps that to `link_expired` — the exact wrong diagnosis. The
 * token was valid; the *code exchange* could not complete. That is why the
 * message said "expired or already used" within seconds of the email arriving.
 *
 * ── What this does instead ──────────────────────────────────────────────────
 * Supabase's own recommended pattern for server-side confirmation is
 * `verifyOtp({ token_hash, type })`, which needs no verifier cookie because there
 * is no PKCE step. This route accepts the token hash and does that, writing the
 * resulting session into the same cookie jar `/auth/callback` uses.
 *
 * It also accepts the bare `token` that `{{ .ConfirmationURL }}` carries, so the
 * stock template works without the project admin hunting for `{{ .TokenHash }}`
 * in the dashboard.
 *
 * Every outcome redirects — a verification URL must not stay in history as a page
 * that can be re-opened into an error.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supabase calls it `token_hash`; `token` is what the link's own query uses. */
const HASH_PARAM = "token_hash";
const TOKEN_PARAM = "token";

/**
 * The `type` values GoTrue accepts for `verifyOtp`, mapped to the ones this app
 * treats as a signed-in-but-not-a-recovery outcome.
 *
 * `email` is GoTrue's umbrella type for signup and email-change confirmations, and
 * is what a link generated without an explicit `type` will carry. Anything not
 * listed is refused rather than guessed at — verifying a recovery link as a
 * signup would hand out the wrong session shape.
 */
const ACCEPTED_TYPES = new Set(["signup", "email", "magiclink", "recovery", "invite", "email_change"]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const tokenHash = searchParams.get(HASH_PARAM);
  const token = searchParams.get(TOKEN_PARAM);
  const rawType = searchParams.get("type") ?? "signup";
  const type = ACCEPTED_TYPES.has(rawType) ? rawType : "signup";
  const next = safeRedirectPath(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  const handoff = tokenHash ?? token;

  const fail = (reason: string, path = "/login") => {
    const url = new URL(path, request.nextUrl.origin);
    url.searchParams.set("error", reason);
    return noStore(NextResponse.redirect(url));
  };

  if (!handoff) {
    // An error_description here means the auth server already rejected the link
    // (expired, already used, deleted user). That is a genuine expiry, unlike the
    // code-exchange failures this route exists to avoid.
    if (errorDescription) return fail("link_expired", "/verify-email");
    return fail("callback_failed");
  }

  const outcome = await getAuthService().verifyEmailLink({
    tokenHash: handoff,
    // `email` is the umbrella GoTrue uses for signup + email-change confirmations.
    type: type as "signup" | "recovery" | "invite" | "magiclink" | "email_change",
  });

  if (!outcome.ok) {
    switch (outcome.code) {
      case "not_configured":
        return fail("not_configured");
      case "network":
        return fail("network");
      case "rate_limited":
        return fail("rate_limited");
      case "link_expired":
        // Only now is "expired or already used" the true diagnosis: the token
        // itself was rejected by the auth server. Send them somewhere that can
        // issue a new one.
        return fail("link_expired", "/verify-email");
      default:
        return fail("callback_failed");
    }
  }

  /*
   * A recovery link lands on the password form, not the dashboard — the same rule
   * `/auth/callback` applies. Everything else uses `next`, which defaults to the
   * dashboard and is validated as a same-origin path.
   */
  const destination = type === "recovery" ? "/reset-password" : next;

  /*
   * The onboarding gate is re-checked downstream: `/auth/set-password` reads the
   * flag itself and the dashboard layout runs middleware, so this redirect cannot
   * be used to skip it.
   */
  return noStore(NextResponse.redirect(new URL(destination, request.nextUrl.origin)));
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

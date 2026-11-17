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
 * There is a second, shorter clock behind that failure. GoTrue keeps the PKCE flow
 * state for 300 seconds (`GOTRUE_EXTERNAL_FLOW_STATE_EXPIRY_DURATION`, default
 * `300s`), counted from signup rather than from the click. So a link opened more
 * than five minutes after signing up returns `flow_state_expired` even though the
 * emailed token is still inside its own 24-hour window — which is how a brand-new
 * link came to be reported as "expired or already used".
 *
 * ── What this does instead ──────────────────────────────────────────────────
 * Supabase's own recommended pattern for server-side confirmation is
 * `verifyOtp({ token_hash, type })`, which needs no verifier cookie because there
 * is no PKCE step and no flow state. This route accepts the token hash and does
 * that, writing the resulting session into the same cookie jar `/auth/callback`
 * uses.
 *
 * That shape is only produced by a template built from `{{ .TokenHash }}`; the
 * stock `{{ .ConfirmationURL }}` never carries one. `docs/deployment/email-templates.md`
 * carries the templates to paste into the dashboard, and swapping them is what
 * makes a confirmation link work on a different device.
 *
 * The `?token=` and `?code=` shapes are still accepted so links already sitting in
 * inboxes keep working, but they are the fallback, not the intended path.
 *
 * Every outcome redirects — a verification URL must not stay in history as a page
 * that can be re-opened into an error.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Three shapes arrive here, and all three have to work.
 *
 *   `token_hash`  — GoTrue's newer email template variable (`{{ .TokenHash }}`),
 *                   and what `verifyOtp` consumes directly.
 *   `token`       — the bare token carried inside the stock `{{ .ConfirmationURL }}`.
 *   `code`        — what the auth server redirects with after it has already
 *                   verified the token itself. This was the missing one: Supabase
 *                   verifies `<site>/auth/v1/verify?token=...&redirect_to=<here>`
 *                   and then sends the browser here with `?code=...`, so a link
 *                   built from `{{ .ConfirmationURL }}` never carried a token at
 *                   all. The route fell through to "no handoff" and returned
 *                   `callback_failed` — the exact error reported.
 *
 * A PKCE `code` normally needs the code-verifier cookie set when the flow began.
 * When it is absent, `exchangeCodeForSession` fails with `flow_state`; when it is
 * present but older than 300 seconds, with `flow_state_expired`. Either way the
 * address has already been confirmed by the time we see the code, so a code is a
 * last resort: it produces a session only for the visitor who started the flow in
 * this browser, minutes ago. Everyone else is told to sign in, which needs no
 * link at all.
 */
const HASH_PARAM = "token_hash";
const TOKEN_PARAM = "token";
const CODE_PARAM = "code";

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

  const code = searchParams.get(CODE_PARAM);
  const rawType = searchParams.get("type") ?? "signup";
  const type = ACCEPTED_TYPES.has(rawType) ? rawType : "signup";
  const next = safeRedirectPath(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  const fail = (reason: string, path = "/login") => {
    const url = new URL(path, request.nextUrl.origin);
    url.searchParams.set("error", reason);
    return noStore(NextResponse.redirect(url));
  };

  /*
   * An `error`/`error_description` first. The auth server sends these when it has
   * already rejected the token itself (expired, already used, deleted user), which
   * is the one case where "expired" is the true diagnosis.
   */
  if (errorDescription || searchParams.get("error")) {
    return fail("link_expired", "/verify-email");
  }

  const handoff = searchParams.get(HASH_PARAM) ?? searchParams.get(TOKEN_PARAM);

  if (!handoff && !code) {
    return fail("callback_failed");
  }

  /*
   * Token shapes go through `verifyOtp`, which needs no cookie and works on any
   * device. The `code` fallback is the older PKCE exchange, kept because the auth
   * server may hand one back on the same-browser path.
   */
  const outcome = handoff
    ? await getAuthService().verifyEmailLink({
        tokenHash: handoff,
        // `email` is the umbrella GoTrue uses for signup + email-change confirmations.
        type: type as "signup" | "recovery" | "invite" | "magiclink" | "email_change",
      })
    : await getAuthService().handleOAuthCallback({
        code,
        tokenHash: null,
        tokenType: null,
        error: null,
      });

  if (!outcome.ok) {
    /*
     * Record the provider's own reason before mapping it.
     *
     * The previous version only rendered a generic "that link didn't work", which
     * is indistinguishable between a rejected token, a missing PKCE verifier and a
     * transient network failure — three problems with three different fixes. The
     * code and message go to the log; the customer still gets a plain sentence.
     */
    console.error("[auth/verify] link verification failed", {
      shape: handoff ? "token" : "code",
      type,
      code: outcome.code,
      message: outcome.message,
    });

    switch (outcome.code) {
      case "not_configured":
        return fail("not_configured");
      case "network":
        return fail("network", "/verify-email");
      case "rate_limited":
        return fail("rate_limited");
      /*
       * Only a token the auth server actually rejected may be called expired.
       * `mapProviderError` produces `link_expired` from `otp_expired` / "token has
       * expired" and nothing else, so this branch is the one honest use of the
       * word. It goes to `/verify-email`, the only screen that can issue a
       * replacement.
       */
      case "link_expired":
        return fail("link_expired", "/verify-email");
      /*
       * `session_missing` covers the PKCE `?code=` shape: the address was
       * confirmed but the code could not be exchanged — a browser without the
       * verifier cookie, or a flow state that passed its 300-second window. It
       * must not borrow the expiry wording. Signing in is the next step, and the
       * destination says exactly that.
       */
      case "session_missing":
        return fail("session_missing", "/login");
      default:
        /*
         * Anything unmapped is an unexplained failure. It is not evidence of
         * expiry, so it does not claim to be: `/verify-email` still offers a
         * replacement, which is the only useful action either way.
         */
        return fail("callback_failed", "/verify-email");
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

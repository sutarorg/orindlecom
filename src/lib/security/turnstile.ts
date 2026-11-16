/**
 * Cloudflare Turnstile — server-side verification.
 *
 * The single rule this file exists to enforce: a token is verified here, against
 * Cloudflare, or it is not verified at all. The widget telling the browser "I
 * passed" is a UI event. The Siteverify response is the fact.
 *
 * Three failure modes that are easy to get wrong and are handled explicitly:
 *
 *   1. **Token reuse.** Turnstile tokens are single-use. Cloudflare returns
 *      `timeout-or-duplicate` for a replayed token, which is indistinguishable
 *      from an expired one — correctly, because both mean "not valid now".
 *      Tokens are additionally tracked in Postgres for the short time a retry
 *      could realistically replay one, so a duplicate is rejected even if the
 *      network response is lost.
 *   2. **Not configured.** With no secret key the site must still work. The
 *      verification returns `skipped` — and every caller is required to treat
 *      `skipped` as "no challenge available", never as "challenge passed". A
 *      deployment without Turnstile is protected by the other five layers and
 *      says so in its health output rather than pretending.
 *   3. **Cloudflare unreachable.** Failing open here would mean an attacker can
 *      disable CAPTCHA by cutting our egress. It fails *closed* with a distinct
 *      code so the UI can offer a retry, and the risk engine records a
 *      verification error rather than a pass.
 */

import "server-only";

import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const SECRET = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";

export type TurnstileOutcome =
  | { status: "passed" }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; code: TurnstileErrorCode; message: string };

export type TurnstileErrorCode =
  | "missing_token"
  | "duplicate_token"
  | "expired_token"
  | "invalid_token"
  | "verification_error";

const MESSAGES: Record<TurnstileErrorCode, string> = {
  missing_token: "Complete the verification challenge and try again.",
  duplicate_token: "That challenge has already been used. Reload the page and try again.",
  expired_token: "That challenge expired. Reload the page and try again.",
  invalid_token: "That challenge didn't pass. Please try again.",
  verification_error: "We couldn't complete the verification challenge. Please try again.",
};

export function isTurnstileConfigured(): boolean {
  return Boolean(SECRET && TURNSTILE_SITE_KEY);
}

/**
 * Verify a token with Cloudflare.
 *
 * `remoteIp` is sent so Cloudflare can apply IP reputation. It is optional
 * because a null IP is a legitimate state (see resolveClientIp).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp: string | null,
): Promise<TurnstileOutcome> {
  if (!isTurnstileConfigured()) {
    return { status: "skipped", reason: "not_configured" };
  }

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { status: "failed", code: "missing_token", message: MESSAGES.missing_token };
  }

  // Single-use enforcement that survives a lost response. A failed insert is not
  // fatal — the Siteverify call below is still authoritative — but a *successful*
  // insert of an existing token means we have seen it before.
  const alreadyUsed = await claimToken(token);
  if (alreadyUsed === "duplicate") {
    return { status: "failed", code: "duplicate_token", message: MESSAGES.duplicate_token };
  }

  const form = new URLSearchParams();
  form.set("secret", SECRET);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  let payload: TurnstileResponse;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      // A hung verification must not hold a signup request open indefinitely.
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    payload = (await response.json()) as TurnstileResponse;
  } catch {
    return {
      status: "failed",
      code: "verification_error",
      message: MESSAGES.verification_error,
    };
  }

  if (payload.success) {
    await markTokenPassed(token);
    return { status: "passed" };
  }

  // Cloudflare reports the reason in `error-codes`. Only two of them need
  // distinct copy; everything else is "didn't pass", which is both true and
  // tells the visitor nothing they can exploit.
  const codes = payload["error-codes"] ?? [];
  if (codes.includes("timeout-or-duplicate")) {
    // Token was valid but is no longer. Expired and replayed are deliberately
    // the same code from Cloudflare; the copy covers both.
    return { status: "failed", code: "expired_token", message: MESSAGES.expired_token };
  }
  if (codes.includes("invalid-input-response") || codes.includes("invalid-input-secret")) {
    return { status: "failed", code: "invalid_token", message: MESSAGES.invalid_token };
  }
  return { status: "failed", code: "invalid_token", message: MESSAGES.invalid_token };
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

/**
 * Records a token so a replay inside its validity window is refused.
 *
 * Returns "duplicate" when the token was already recorded. Uses the service
 * client because the table is deny-all to every other role — a client that could
 * write here could pre-claim tokens.
 */
async function claimToken(token: string): Promise<"ok" | "duplicate" | "unavailable"> {
  if (!isServiceConfigured()) return "unavailable";
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("turnstile_tokens").insert({ token_hash: await hashToken(token) });
    if (!error) return "ok";
    // 23505 = unique violation, which is exactly the duplicate case.
    if (error.code === "23505") return "duplicate";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

async function markTokenPassed(token: string): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    const supabase = getServiceClient();
    await supabase
      .from("turnstile_tokens")
      .update({ verified: true })
      .eq("token_hash", await hashToken(token));
  } catch {
    // Non-fatal: the token is already recorded, which is the part that prevents
    // replay. The outcome flag is for later inspection only.
  }
}

async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(`turnstile:${token}`).digest("hex");
}

export const TURNSTILE_ERROR_COPY = MESSAGES;

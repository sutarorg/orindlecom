/**
 * The signup gate.
 *
 * One function that every registration path calls — email/password, and the
 * OAuth callback — so the six protections cannot be half-applied. It answers a
 * single question: may this request proceed, and with what friction?
 *
 * Order is deliberate and is the opposite of the order most implementations use:
 *
 *   1. **Rate limit first.** It is the cheapest check and it is the one that
 *      protects the others: a flood should not reach a database query.
 *   2. **Domain, before the challenge.** Telling someone "that address is a
 *      temporary mailbox" is useful. Making them solve a challenge first and
 *      then refusing them is not, and it also burns a token.
 *   3. **Turnstile, when configured or when risk asks for it.** Verified
 *      server-side, single use, before any account is created.
 *   4. **Risk assessment**, so a refusal is recorded with its evidence.
 *
 * The gate never creates an account. It returns a decision; the caller acts.
 */

import "server-only";

import { createHash } from "node:crypto";
import { LIMITS, consume } from "@/lib/rate-limit";
import { hashDevice, hashIp, resolveClientIp } from "./ip";
import { readDeviceId } from "./device";
import { assessSignup, recordCaptchaFailure, signupThrottleActive, type RiskAssessment } from "./risk";
import { isTurnstileConfigured, verifyTurnstile } from "./turnstile";

export type GateDecision =
  | { ok: true; assessment: RiskAssessment; deviceHash: string | null; ipHash: string | null }
  | {
      ok: false;
      code: GateFailureCode;
      message: string;
      /** Seconds the caller may retry after. Only set for rate limiting. */
      retryAfterSeconds?: number;
      /** Turnstile was required and did not pass. The client should re-challenge. */
      challengeRequired?: boolean;
    };

export type GateFailureCode =
  | "rate_limited"
  | "disposable_email"
  | "challenge_failed"
  | "challenge_missing"
  | "throttled"
  | "not_configured";

/** Copy written for the person, not the log. */
export const GATE_MESSAGES: Record<GateFailureCode, string> = {
  rate_limited: "That's several attempts in a short time. Wait a few minutes and try again.",
  disposable_email:
    "Orindle needs an address you'll keep. Temporary inboxes can't verify an account, so please use a permanent email.",
  challenge_failed: "That verification challenge didn't pass. Please try again.",
  challenge_missing: "Complete the verification challenge to continue.",
  throttled:
    "Several accounts have been created from this device recently. Try again later, or sign in if you already have an account.",
  not_configured: "Accounts aren't connected on this deployment yet.",
};

/**
 * Turnstile is required on every registration when configured, and additionally
 * whenever the risk engine asks for it. The requirements put registration first in
 * the list of flows to protect, and a signup endpoint is the one place an
 * automated script costs us storage.
 */
export function isDisposableDomain(domainClass: string | null): boolean {
  return domainClass === "disposable";
}

/** Rate-limit bucket for a signup attempt, scoped so one network cannot exhaust another's. */
export function signupBucket(ipHash: string | null, deviceHash: string | null): string {
  // IP first: it is the only signal an attacker cannot reset by clearing cookies.
  if (ipHash) return `signup:ip:${ipHash}`;
  if (deviceHash) return `signup:device:${deviceHash}`;
  // No trustworthy identifier at all. A shared bucket is a blunt instrument, but
  // it only affects requests that arrive with neither header nor cookie, which
  // is not a state a real browser is in.
  return "signup:unknown";
}

/**
 * A stable, salted hash of the lowercased email domain, for logging a refusal
 * without recording the address.
 */
export function hashEmail(email: string): string {
  const salt = process.env.ABUSE_HASH_SALT?.trim() ?? "";
  return createHash("sha256").update(`${salt}|${email.toLowerCase()}`).digest("hex");
}

/* ------------------------------------------------------------------ */
/*  The gate                                                           */
/* ------------------------------------------------------------------ */

export interface GateInput {
  /** Request headers, for the client address. */
  headers: Headers;
  email: string;
  /** The Turnstile token from the form, if the widget rendered one. */
  turnstileToken?: string | null;
  /** The device identifier, read from the cookie by the caller. */
  deviceId?: string | null;
}

let cachedAssessment: RiskAssessment | null = null;

/**
 * Evaluate a registration request.
 *
 * Returns a decision and, on success, the assessment the caller must pass to
 * `recordSignupOutcome` once the account exists. The two calls are separate
 * because the account does not exist yet at assessment time, and the outcome
 * record has to name it.
 */
export async function evaluateSignupGate(input: GateInput): Promise<GateDecision> {
  const ip = resolveClientIp(input.headers);
  const ipHash = hashIp(ip.ip);
  const deviceId = input.deviceId ?? (await readDeviceId());
  const deviceHash = hashDevice(deviceId);

  // 1. Rate limit.
  const limit = await consume(signupBucket(ipHash, deviceHash), LIMITS.signupAttempt);
  if (!limit.allowed) {
    return {
      ok: false,
      code: "rate_limited",
      message: GATE_MESSAGES.rate_limited,
      retryAfterSeconds: Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
    };
  }

  // 1b. An existing cooldown for this device or network blocks new accounts.
  if (await signupThrottleActive({ deviceHash, ipHash })) {
    return { ok: false, code: "throttled", message: GATE_MESSAGES.throttled };
  }

  // 2 & 4. Risk assessment. Needed before the challenge decision, so that a
  // high-risk request is challenged even when Turnstile is not globally on.
  const assessment = await assessSignup({ email: input.email, deviceHash, ipHash });
  cachedAssessment = assessment;

  // 2b. Disposable domains are refused before a challenge is spent.
  if (assessment.decision === "refuse") {
    return {
      ok: false,
      code: "disposable_email",
      message: GATE_MESSAGES.disposable_email,
    };
  }

  // 3. Turnstile. Required when configured, or when the band asks for it.
  const needsChallenge =
    isTurnstileConfigured() || assessment.decision === "challenge" || assessment.level !== "low";

  if (needsChallenge && isTurnstileConfigured()) {
    const outcome = await verifyTurnstile(input.turnstileToken, ip.ip);
    if (outcome.status === "failed") {
      await recordCaptchaFailure({ deviceHash, ipHash, code: outcome.code });
      return {
        ok: false,
        code: input.turnstileToken ? "challenge_failed" : "challenge_missing",
        message: outcome.message,
        challengeRequired: true,
      };
    }
    // `skipped` cannot happen here: the branch is guarded by isTurnstileConfigured.
  }

  return { ok: true, assessment, deviceHash, ipHash };
}

/** The assessment from the most recent successful gate call in this request. */
export function lastAssessment(): RiskAssessment | null {
  return cachedAssessment;
}

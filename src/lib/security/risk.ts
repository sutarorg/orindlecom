/**
 * The risk engine.
 *
 * Assesses a signup and applies a proportionate, expiring outcome. Everything
 * here is automatic: there is no queue, no approval step and no screen anyone
 * has to watch. The four bands and their consequences:
 *
 *   low        approve, grant the 10 GB, allow uploads
 *   medium     approve, but restrict *signup* for a short cooldown and raise the
 *              challenge for the next attempt
 *   high       restrict *uploads* for a while; the account keeps its data
 *   confirmed  refuse the entitlement and restrict uploads for longer
 *
 * Two design commitments worth stating, because they are what make unattended
 * enforcement defensible:
 *
 *   1. **Nothing is deleted.** No branch in this file can remove a file. A wrong
 *      answer costs an inconvenience, never data.
 *   2. **Every restriction expires.** The worst automatic outcome is a bounded
 *      cooldown, so a false positive heals itself with no human involvement.
 *
 * The scoring itself lives in the database (0014) rather than here, so the
 * numbers, the thresholds and the enforcement record are one atomic thing. This
 * module collects the signals, calls the function, and turns the result into
 * something the UI can act on.
 */

import "server-only";

import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export type RiskLevel = "low" | "medium" | "high" | "confirmed";

export interface RiskSignals {
  device_accounts_week: number;
  device_accounts_hour: number;
  device_accounts_day: number;
  ip_accounts_hour: number;
  ip_accounts_day: number;
  captcha_failures_hour: number;
  prior_rejections_day: number;
  device_has_rejection: boolean;
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
  signals: RiskSignals;
  /**
   * What the caller must do. `refuse` means no account and no entitlement;
   * `challenge` means require a Turnstile pass before proceeding.
   */
  decision: "allow" | "challenge" | "throttle" | "refuse";
}

/** The state a request carries into the assessment. */
export interface SignupContext {
  email: string;
  deviceHash: string | null;
  ipHash: string | null;
}

/**
 * The decision table, expressed once.
 *
 * Kept separate from the database's band naming so the two can be read together:
 * the database says *how bad*, this says *what changes*. A durable restriction is
 * applied by the database; the request-time decision is this function.
 */
export function decisionFor(level: RiskLevel, domainClass: string | null): RiskAssessment["decision"] {
  // A disposable domain cannot receive the verification mail, so the account
  // could never become entitled anyway. Refusing at signup is kinder than
  // creating an account that cannot work.
  if (domainClass === "disposable") return "refuse";
  switch (level) {
    case "confirmed":
      return "refuse";
    case "high":
      return "throttle";
    case "medium":
      return "challenge";
    case "low":
    default:
      return "allow";
  }
}

/**
 * Assess a signup.
 *
 * Fails *open* with a low score when the database is unreachable, for the same
 * reason the rate limiter does: a blip in the anti-abuse layer must not become a
 * total signup outage. The trade is stated rather than hidden — an attacker who
 * can take the database down has a much bigger problem available to them than
 * creating free accounts.
 */
export async function assessSignup(context: SignupContext): Promise<RiskAssessment> {
  const fallback: RiskAssessment = {
    score: 0,
    level: "low",
    reasons: [],
    signals: EMPTY_SIGNALS,
    decision: "allow",
  };

  if (!isServiceConfigured()) return fallback;

  const supabase = getServiceClient();

  const { data: domainClass } = await supabase.rpc("classify_email_domain", {
    p_email: context.email,
  });

  const { data: signalData, error: signalError } = await supabase.rpc("signup_signals", {
    p_device_hash: context.deviceHash,
    p_ip_hash: context.ipHash,
  });

  if (signalError || !signalData) {
    console.error("[risk] signup_signals failed", { message: signalError?.message });
    return fallback;
  }

  const signals = normaliseSignals(signalData as Record<string, unknown>);

  const { data: scoreData, error: scoreError } = await supabase.rpc("score_signup", {
    p_domain_class: (domainClass as string | null) ?? null,
    p_signals: signals,
  });

  if (scoreError || !scoreData) {
    console.error("[risk] score_signup failed", { message: scoreError?.message });
    return fallback;
  }

  // A table-returning function hands back an array.
  const row = (Array.isArray(scoreData) ? scoreData[0] : scoreData) as {
    score: number;
    level: RiskLevel;
    reasons: unknown;
  };

  const reasons = Array.isArray(row.reasons) ? (row.reasons as string[]) : [];

  return {
    score: Number(row.score ?? 0),
    level: (row.level as RiskLevel) ?? "low",
    reasons,
    signals,
    decision: decisionFor((row.level as RiskLevel) ?? "low", (domainClass as string | null) ?? null),
  };
}

const EMPTY_SIGNALS: RiskSignals = {
  device_accounts_week: 0,
  device_accounts_hour: 0,
  device_accounts_day: 0,
  ip_accounts_hour: 0,
  ip_accounts_day: 0,
  captcha_failures_hour: 0,
  prior_rejections_day: 0,
  device_has_rejection: false,
};

function normaliseSignals(raw: Record<string, unknown>): RiskSignals {
  const num = (key: string) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    device_accounts_week: num("device_accounts_week"),
    device_accounts_hour: num("device_accounts_hour"),
    device_accounts_day: num("device_accounts_day"),
    ip_accounts_hour: num("ip_accounts_hour"),
    ip_accounts_day: num("ip_accounts_day"),
    captcha_failures_hour: num("captcha_failures_hour"),
    prior_rejections_day: num("prior_rejections_day"),
    device_has_rejection: Boolean(raw.device_has_rejection),
  };
}

/**
 * Record the outcome and apply whatever enforcement the band calls for.
 *
 * Called once per signup attempt that reached an auth user. `userId` is null when
 * the attempt was refused before an account existed — the device-level record
 * still matters, because it is what makes the *next* attempt from that browser
 * score higher.
 */
export async function recordSignupOutcome(input: {
  userId: string | null;
  deviceHash: string | null;
  ipHash: string | null;
  assessment: RiskAssessment;
  outcome: "accepted" | "throttled" | "rejected";
}): Promise<{ restricted: boolean; expiresAt: string | null; kind: string | null }> {
  if (!isServiceConfigured()) {
    return { restricted: false, expiresAt: null, kind: null };
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("apply_signup_outcome", {
    p_user_id: input.userId,
    p_device_hash: input.deviceHash,
    p_ip_hash: input.ipHash,
    p_score: input.assessment.score,
    p_level: input.assessment.level,
    p_reasons: input.assessment.reasons,
    p_outcome: input.outcome,
  });

  if (error) {
    // An enforcement record that failed to write is worth a loud log: the signup
    // still resolves, but a pattern may go uncounted.
    console.error("[risk] apply_signup_outcome failed", { message: error.message });
    return { restricted: false, expiresAt: null, kind: null };
  }

  const result = (data ?? {}) as { restricted?: boolean; expires_at?: string; kind?: string };
  return {
    restricted: Boolean(result.restricted),
    expiresAt: result.expires_at ?? null,
    kind: result.kind ?? null,
  };
}

/** Record a CAPTCHA failure. Repeated failures raise the next assessment. */
export async function recordCaptchaFailure(input: {
  deviceHash: string | null;
  ipHash: string | null;
  code: string;
}): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    const supabase = getServiceClient();
    await supabase.from("risk_events").insert({
      device_hash: input.deviceHash,
      ip_hash: input.ipHash,
      kind: "captcha_failed",
      level: "low",
      metadata: { code: input.code },
    });
  } catch {
    // Logging is best-effort; never let it fail the request it is describing.
  }
}

/**
 * Whether an account is currently barred from consuming storage.
 *
 * Read before an upload so the UI can explain the cooldown instead of the user
 * discovering it as a failed upload. The database enforces the same rule inside
 * reserve_storage, so this is the courtesy check, not the security boundary.
 */
export async function activeUploadRestriction(userId: string): Promise<{
  restricted: boolean;
  expiresAt: string | null;
  reason: string | null;
}> {
  if (!isServiceConfigured()) return { restricted: false, expiresAt: null, reason: null };
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("account_restrictions")
      .select("expires_at, reason")
      .eq("user_id", userId)
      .eq("kind", "upload_block")
      .is("released_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!data) return { restricted: false, expiresAt: null, reason: null };
    return { restricted: true, expiresAt: data.expires_at, reason: data.reason };
  } catch {
    return { restricted: false, expiresAt: null, reason: null };
  }
}

/**
 * Signup-level throttle for a device or address.
 *
 * Distinct from the upload restriction: this one is about *creating accounts*,
 * and applies even before an account exists. A medium band creates one, which is
 * how "several signups from one device" turns into friction rather than a block.
 */
export async function signupThrottleActive(input: {
  deviceHash: string | null;
  ipHash: string | null;
}): Promise<boolean> {
  if (!isServiceConfigured()) return false;
  try {
    const supabase = getServiceClient();

    if (input.deviceHash) {
      const { data } = await supabase
        .from("account_restrictions")
        .select("id")
        .eq("device_hash", input.deviceHash)
        .eq("kind", "signup_block")
        .is("released_at", null)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (data && data.length > 0) return true;
    }

    if (input.ipHash) {
      const { data } = await supabase
        .from("account_restrictions")
        .select("id")
        .eq("kind", "signup_block")
        .is("released_at", null)
        .gt("expires_at", new Date().toISOString())
        .eq("evidence->>ip_hash", input.ipHash)
        .limit(1);
      if (data && data.length > 0) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/** Named so the UI can log a reason code without inventing one. */
export const RISK_REASON_LABELS: Record<string, string> = {
  disposable_email_domain: "temporary email provider",
  risky_email_domain: "low-trust email domain",
  ip_burst_severe: "many signups from one network",
  device_burst: "another account was created here recently",
  prior_rejections: "earlier refused attempts",
};

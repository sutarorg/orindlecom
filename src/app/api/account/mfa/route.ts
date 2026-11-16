/**
 * Two-factor authentication management.
 *
 * One resource, four operations, all POST or DELETE because every one of them
 * changes account security and must not be reachable by a link or prefetch:
 *
 *   POST   { action: "enroll" }            → factor id, QR, secret
 *   POST   { action: "verify", code }      → activates the factor
 *   POST   { action: "challenge" }         → a fresh challenge id
 *   DELETE { factorId }                    → removes a factor
 *
 * The secret is returned exactly once, in the enroll response, and is never
 * stored. It is not logged and does not appear in any error path.
 */

import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shape the UI branches on. Codes, not provider strings. */
type MfaError = { ok: false; code: string; message: string };

function fail(code: string, message: string, status = 400): NextResponse<MfaError> {
  return NextResponse.json({ ok: false as const, code, message }, { status });
}

export async function GET() {
  const state = await getAuthService().mfaState();
  if (!state.ok) return fail(state.code, state.message, state.code === "not_configured" ? 503 : 401);

  return NextResponse.json(
    {
      ok: true,
      data: {
        enabled: state.data.factors.length > 0,
        currentLevel: state.data.currentLevel,
        nextLevel: state.data.nextLevel,
        factors: state.data.factors,
        // Stated explicitly because it is the honest limitation: Supabase's MFA
        // API does not issue recovery codes, so the UI must not imply it does.
        recoveryCodes: false,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const service = getAuthService();
  const session = await service.getCurrentSession();
  if (!session) return fail("unauthenticated", "Sign in again to manage two-factor authentication.", 401);

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    code?: string;
    factorId?: string;
  };

  const limited = await enforceMfaRateLimit(session.user.id);
  if (limited) return limited;

  switch (body.action) {
    case "enroll": {
      const result = await service.enrollTotp();
      if (!result.ok) return fail(result.code, result.message, 400);
      await logEvent(session.user.id, "mfa_enrollment_started");
      return NextResponse.json(
        {
          ok: true,
          data: {
            factorId: result.data.factorId,
            qrCode: result.data.qrCode,
            secret: result.data.secret,
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    case "verify": {
      if (!body.factorId || !body.code) {
        return fail("mfa_invalid", "That code is missing. Try again.");
      }
      const result = await service.verifyTotp(body.factorId, body.code);
      if (!result.ok) {
        await logEvent(session.user.id, "mfa_verification_failed", { factorId: body.factorId });
        return fail(result.code, result.message, 400);
      }

      // The factor is only "activated" once Supabase confirmed it. Report that
      // from the provider's own state rather than from the fact that verify()
      // returned without an error.
      const after = await service.mfaState();
      const active = after.ok && after.data.factors.some((f) => f.id === body.factorId);

      await logEvent(session.user.id, active ? "mfa_enabled" : "mfa_verification_failed", {
        factorId: body.factorId,
      });

      return NextResponse.json(
        {
          ok: true,
          data: {
            enabled: Boolean(active),
            currentLevel: after.ok ? after.data.currentLevel : "aal1",
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    case "challenge": {
      if (!body.factorId) return fail("mfa_invalid", "Missing factor.");
      const result = await service.pendingChallenge(body.factorId);
      if (!result.ok) return fail(result.code, result.message, 400);
      return NextResponse.json({ ok: true, data: result.data });
    }

    default:
      return fail("validation_failed", "Unknown action.");
  }
}

export async function DELETE(request: Request) {
  const service = getAuthService();
  const session = await service.getCurrentSession();
  if (!session) return fail("unauthenticated", "Sign in again to manage two-factor authentication.", 401);

  const body = (await request.json().catch(() => ({}))) as { factorId?: string; password?: string };
  if (!body.factorId) return fail("validation_failed", "Missing factor.");

  const limited = await enforceMfaRateLimit(session.user.id);
  if (limited) return limited;

  /**
   * Reauthentication before removal.
   *
   * Disabling a second factor is the highest-privilege action on this page: it
   * removes the very thing it is protecting. Supabase's `unenroll` does not
   * require a password, so this route does — a stolen session cannot turn off
   * the factor that would otherwise limit it.
   *
   * An account with no password (a Google account that skipped onboarding) is
   * handled by the AAL check instead: if it has a factor, it is at AAL2, which is
   * a stronger proof than a password.
   */
  const state = await service.mfaState();
  if (!state.ok) return fail(state.code, state.message, 400);

  const { readOwnSecurity } = await import("@/lib/security/account-security");
  const security = await readOwnSecurity();
  const passwordless = security.signupProvider === "google" && !security.passwordSetupAt;

  // A passwordless account proves itself with AAL2 instead; an account with a
  // password must supply it. Neither path can be satisfied by the session alone.
  if (!passwordless && body.password === undefined) {
    return fail("mfa_required", "Confirm your password before turning off two-factor authentication.", 403);
  }
  if (passwordless && state.data.currentLevel !== "aal2") {
    return fail(
      "mfa_required",
      "Complete the second-factor challenge before turning it off.",
      403,
    );
  }

  if (!passwordless && body.password !== undefined) {
    // Verify the password by attempting a sign-in with the session's own address.
    // This is a real check, not a formality: Supabase validates the credential.
    const email = session.user.email;
    const verified = await getAuthService().signIn({
      email,
      password: body.password,
      remember: true,
    });
    if (!verified.ok) {
      await logEvent(session.user.id, "mfa_disable_reauth_failed");
      return fail("invalid_credentials", "That password didn't match.", 403);
    }

    /**
     * A password sign-in *replaces* the session with a fresh AAL1 one. Removing
     * a factor while at AAL1 would be a downgrade path: a stolen password alone
     * could strip the second factor. So removal happens only after the caller
     * completes a challenge in the new session — this response says so, and the
     * client sends them through /auth/mfa.
     */
    return NextResponse.json(
      {
        ok: true,
        data: {
          enabled: true,
          reauthRequired: true,
          message: "Password confirmed. Verify your authenticator code to finish removing it.",
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await service.unenrollFactor(body.factorId);
  if (!result.ok) return fail(result.code, result.message, 400);

  await logEvent(session.user.id, "mfa_disabled", { factorId: body.factorId });

  return NextResponse.json(
    { ok: true, data: { enabled: false, reauthRequired: body.password !== undefined } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function enforceMfaRateLimit(userId: string): Promise<NextResponse<MfaError> | null> {
  const { LIMITS, consume, userBucket } = await import("@/lib/rate-limit");
  const result = await consume(userBucket("mfa.manage", userId), LIMITS.mfaChallenge);
  if (result.allowed) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  return NextResponse.json(
    { ok: false as const, code: "rate_limited", message: "Too many attempts. Wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

async function logEvent(userId: string, kind: string, metadata: Record<string, unknown> = {}) {
  if (!isServiceConfigured()) return;
  try {
    await getServiceClient().from("risk_events").insert({
      user_id: userId,
      kind,
      level: "low",
      metadata,
    });
  } catch {
    // Logging is best effort and must never fail the operation it describes.
  }
}

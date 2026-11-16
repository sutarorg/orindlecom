/**
 * POST /api/users/me/email
 *
 * Starts an email address change through Supabase Auth, which sends a
 * verification link to the new address before the change takes effect. Also
 * notifies the current email address via Resend when configured.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, requireString, withActor } from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { AppError } from "@/domain/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { sendEmail } from "@/lib/resend/client";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("account.email", auth.actor.userId),
      LIMITS.verificationResend,
    );
    if (limited) return limited;

    const body = await readJson(request);
    const nextEmail = requireString(body, "email", { max: 254 }).toLowerCase();

    if (!EMAIL_RE.test(nextEmail)) {
      throw new AppError("validation_failed", "Enter a valid email address.");
    }

    if (nextEmail === auth.actor.email.toLowerCase()) {
      throw new AppError("validation_failed", "That is already your current email address.");
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ email: nextEmail });

    if (error) {
      throw new AppError(
        "validation_failed",
        error.message || "We couldn't start the email change right now.",
      );
    }

    await supabase.from("activity_events").insert({
      actor_id: auth.actor.userId,
      subject_type: "user",
      subject_id: auth.actor.userId,
      kind: "account.email_change_requested",
      metadata: { newEmail: nextEmail },
    });

    // Notify the current address so an unauthorized request is caught early.
    await sendEmail({
      to: auth.actor.email,
      template: "email-changed",
      data: {
        name: auth.actor.fullName || "there",
        oldEmail: auth.actor.email,
        newEmail: nextEmail,
      },
    }).catch(() => {});

    return ok({
      requested: true,
      pendingEmail: nextEmail,
      note: "Check your new email address for a confirmation link. Your email changes once you confirm it.",
    });
  });
}

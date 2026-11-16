/**
 * POST   /api/users/me/delete — request deletion.
 * DELETE /api/users/me/delete — cancel a pending deletion.
 *
 * Two-stage by design, because this is the only irreversible action in the product:
 *
 *   - Requesting sets `deletion_requested_at`. Nothing is removed. Access becomes
 *     read-only, the account appears in the purge job's queue after the grace
 *     period, and the response says exactly when that is.
 *   - Cancelling clears the timestamp. One call, and nothing was ever lost.
 *
 * Nothing here deletes a row or an object. The purge job does that, after the grace
 * period, and it deletes the storage object before the row so a crash leaves
 * recoverable bytes rather than a broken download.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { userBucket } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend/client";
import { AppError } from "@/domain/auth/errors";

export const runtime = "nodejs";

/** Days between the request and the purge. Stated in the response, not just the docs. */
const GRACE_DAYS = 7;

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("account.delete", auth.actor.userId),
      { limit: 3, windowSeconds: 3600 },
    );
    if (limited) return limited;

    const body = await readJson(request);

    // Typed confirmation, checked against the session's own address. A borrowed
    // session cannot delete the account without knowing the address it belongs to.
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
    // Case-insensitive because the address in the session may be normalised
    // differently from what the person typed; anything looser than that would let a
    // near-miss through on the one action that cannot be undone.
    if (confirmation.toLowerCase() !== auth.actor.email.toLowerCase()) {
      throw new AppError(
        "validation_failed",
        "Type your email address exactly to confirm. Nothing was changed.",
      );
    }

    const supabase = getServiceClient();
    const requestedAt = new Date();
    const purgeOn = new Date(requestedAt.getTime() + GRACE_DAYS * 86_400_000);

    const { error } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: requestedAt.toISOString() })
      .eq("id", auth.actor.userId);

    if (error) {
      throw new AppError(
        "unknown",
        "We couldn't record that request. Nothing was deleted.",
      );
    }

    // A deletion request nobody can undo needs to be visible to the person who made
    // it, in a channel that survives their session ending.
    await sendEmail({
      to: auth.actor.email,
      template: "account-deletion-requested",
      data: { purgeOn: purgeOn.toISOString().slice(0, 10) },
    }).catch(() => {
      // Logged by sendEmail; the request stands regardless. The response tells the
      // person what happens and how to cancel, so the email is a reminder rather
      // than the only record.
    });

    return ok({
      requested: true,
      graceDays: GRACE_DAYS,
      purgeOn: purgeOn.toISOString(),
      // Said plainly, because "deleted" that means "in a week" must not surprise.
      note: `Nothing has been deleted. Your account becomes read-only now and is permanently deleted on ${purgeOn.toISOString().slice(0, 10)}. Signing in before then cancels it.`,
    });
  });
}

export async function DELETE() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: null })
      .eq("id", auth.actor.userId);

    if (error) {
      throw new AppError("unknown", "We couldn't cancel that. Your account is still scheduled.");
    }

    return ok({ cancelled: true, note: "Your account is back to normal. Nothing was deleted." });
  });
}

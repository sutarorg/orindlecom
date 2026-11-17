/**
 * POST   /api/users/me/delete — request deletion.
 * DELETE /api/users/me/delete — cancel a pending deletion.
 *
 * Two-stage by design, because this is the only irreversible action in the product:
 *
 *   - Requesting marks the profile. Nothing is removed. The account is purged after
 *     the grace period, and the response says exactly when that is. Requesting
 *     twice does not restart the clock.
 *   - Every session is then revoked, and the current browser is signed out. This is
 *     the part the previous version only claimed: it left the person signed in, on
 *     every device, with a live refresh token.
 *   - Cancelling clears the request. Signing in during the grace period also
 *     cancels it — see `signInAction` in `src/app/(auth)/actions.ts`.
 *
 * Nothing here deletes a row or an object. The purge job does that, after the grace
 * period, and it deletes the storage object before the row so a crash leaves
 * recoverable bytes rather than a broken download.
 *
 * ── About "read-only" ───────────────────────────────────────────────────────
 * The old copy said the account "becomes read-only". Nothing enforced that, in any
 * layer, so it was a promise with no mechanism behind it. It is not implemented
 * here either, deliberately: a half-enforced read-only state is worse than none,
 * because the screens that forget to enforce it are the ones that let a departing
 * account change data. The account instead stays fully usable until it is purged,
 * and the customer is told that plainly in their settings and in the email.
 */

import "server-only";

import { enforceRateLimit, handle, ok, readJson, withActor } from "@/lib/api";
import { userBucket } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
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

    // The database decides when the purge is due, so the date in the response and
    // the date the purge job acts on cannot drift apart.
    const { data, error } = await supabase.rpc("request_account_deletion");

    if (error) {
      console.error("[account] deletion request failed", {
        userId: auth.actor.userId,
        pgCode: error.code,
        pgMessage: error.message,
      });
      throw new AppError(
        "unknown",
        "We couldn't record that request. Nothing was deleted.",
      );
    }

    const requested = Array.isArray(data) ? data[0] : data;
    const purgeOn = requested?.purge_on as string | undefined;

    // A deletion request nobody can undo needs to be visible to the person who made
    // it, in a channel that survives their session ending.
    await sendEmail({
      to: auth.actor.email,
      template: "account-deletion-requested",
      data: { purgeOn: (purgeOn ?? "").slice(0, 10) },
    }).catch(() => {
      // Logged by sendEmail; the request stands regardless. The response tells the
      // person what happens and how to cancel, so the email is a reminder rather
      // than the only record.
    });

    /*
     * Sign out everywhere, including this browser.
     *
     * The refresh token is what makes a session live, so revoking at the auth server
     * is the only thing that actually ends it — clearing the local cookie alone
     * leaves every other device signed in. Done after the request is recorded, so a
     * failure here cannot lose the deletion itself.
     *
     * Ordered deliberately: `admin.signOut` first (revoke by user id), then the
     * local cookie jar is cleared by signing this client out. If the admin call
     * fails we still clear the local session — the person asked to leave.
     */
    const signOutErrors: string[] = [];

    const { error: revokeError } = await supabase.auth.admin.signOut(
      auth.actor.userId,
      "global",
    );
    if (revokeError) {
      signOutErrors.push(`global: ${revokeError.message}`);
    }

    try {
      const local = await createSupabaseServerClient();
      await local.auth.signOut({ scope: "local" });
    } catch (error) {
      signOutErrors.push(`local: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (signOutErrors.length > 0) {
      // Not fatal: the deletion is recorded and the purge will run. Recorded so the
      // case where a token stayed alive is visible rather than assumed away.
      console.error("[account] deletion recorded but sign-out was incomplete", {
        userId: auth.actor.userId,
        signOutErrors,
      });
    }

    return ok({
      requested: true,
      signedOut: signOutErrors.length === 0,
      graceDays: GRACE_DAYS,
      purgeOn: purgeOn ?? null,
      // Said plainly, because "deleted" that means "in a week" must not surprise.
      note: `Nothing has been deleted. You have been signed out. Your account and files are permanently deleted on ${
        purgeOn ? purgeOn.slice(0, 10) : "the date shown in your settings"
      }, and signing in before then cancels it.`,
    });
  });
}

export async function DELETE() {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const supabase = getServiceClient();
    const { error } = await supabase.rpc("cancel_account_deletion");

    if (error) {
      console.error("[account] deletion cancel failed", {
        userId: auth.actor.userId,
        pgCode: error.code,
        pgMessage: error.message,
      });
      throw new AppError("unknown", "We couldn't cancel that. Your account is still scheduled.");
    }

    return ok({ cancelled: true, note: "Your account is back to normal. Nothing was deleted." });
  });
}

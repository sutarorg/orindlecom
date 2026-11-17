/**
 * GET  /api/files/:id/grants — who has access.
 * POST /api/files/:id/grants — grant access to an email address.
 *
 * The caller names an *email*, never a user id. The server resolves it, so a
 * request cannot name an arbitrary account.
 *
 * When no account exists for the address, the item is still shared: an invitation is
 * recorded and emailed, and the grant is created when that person signs up and
 * confirms the address. Refusing here — which is what this route used to do — meant
 * that sharing with anybody who was not already a customer simply did not work, and
 * that is most of the people you would want to send a file to.
 */

import "server-only";

import {
  enforceRateLimit,
  handle,
  ok,
  readJson,
  requireString,
  withActor,
} from "@/lib/api";
import { LIMITS, userBucket } from "@/lib/rate-limit";
import { getDriveRepository } from "@/lib/drive/service";
import { AppError } from "@/domain/auth/errors";
import type { PermissionLevel } from "@/lib/drive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function readPermission(value: unknown): PermissionLevel {
  // Two levels. Anything else — including the retired `editor` — is refused here,
  // so an old client cannot write a value the database no longer accepts.
  if (value === "viewer" || value === "commenter") return value;
  throw new AppError("validation_failed", "Choose whether they can view or comment.");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const repo = getDriveRepository();
    const result = await repo.listGrants(id);

    if (!result.ok) {
      throw new AppError(
        result.code === "not_configured" ? "not_configured" : "unknown",
        result.message,
      );
    }

    return ok({ grants: result.data });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const limited = await enforceRateLimit(
      userBucket("share.grant", auth.actor.userId),
      LIMITS.shareCreate,
    );
    if (limited) return limited;

    const { id } = await params;
    const body = await readJson(request);

    const email = requireString(body, "email", { max: 254 }).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AppError("validation_failed", "That doesn't look like an email address.");
    }

    const permission = readPermission(body.permission);

    const repo = getDriveRepository();
    const result = await repo.addGrant({ itemId: id, email, permission });

    if (result.ok) {
      return ok({ ...result.data, invited: false });
    }

    if (result.code === "not_found") {
      /*
       * No account for that address — which is a normal thing to want to do, not an
       * error. Record the intent and email a link.
       *
       * `addGrant` resolved the address and found nobody, so the item has already
       * been authorised by the repository read that preceded it. The invitation is
       * written with the service client because `share_invitations` deliberately has
       * no INSERT grant for customers: creating one requires resolving an address
       * the inviter must not be able to enumerate.
       */
      const meta = await repo.get(id);
      if (!meta.ok) throw new AppError("not_found", meta.message);

      const { createInvitation } = await import("@/lib/share/invitations");
      const invitation = await createInvitation({
        email,
        fileId: meta.data.kind === "folder" ? null : id,
        folderId: meta.data.kind === "folder" ? id : null,
        permission,
        invitedBy: auth.actor.userId,
        itemName: meta.data.name,
        ownerName: "You",
      });

      /*
       * `delivered` is reported, not assumed. If the mail provider is not configured
       * the caller shows the link for the owner to pass on themselves — claiming an
       * email was sent when it was not is how a file silently fails to arrive.
       */
      return ok({
        invited: true,
        email,
        permission,
        delivered: invitation.delivered,
        /*
         * The link is returned whenever the mail did not go out, and the reason is
         * returned with it. The reason is what the dialog shows, because the honest
         * description of a failed send is the failure — not a guess at its cause.
         */
        inviteUrl: invitation.delivered ? null : invitation.url,
        deliveryError: invitation.deliveryError,
        expiresAt: invitation.expiresAt,
      });
    }

    throw new AppError(
      result.code === "not_configured" ? "not_configured" : "unknown",
      result.message,
    );
  });
}

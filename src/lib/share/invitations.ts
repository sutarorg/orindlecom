import "server-only";

/**
 * Sharing with somebody who has no account yet.
 *
 * The previous behaviour was to refuse: resolving the address to a user id failed,
 * so the request failed, and the dialog said "that person doesn't have an Orindle
 * account yet". That is an accurate sentence describing a broken feature — most of
 * the people you want to send a file to are not customers.
 *
 * The mechanism now is an invitation, not a grant. A grant needs a `grantee_id`, and
 * inventing one would be attributing access to a person who never agreed to it. An
 * invitation records the intent — this address, this file, this permission, this
 * sender, expiring on this date — and the grant is created when that address signs
 * up and confirms it (`claim_share_invitations`, migration 0024).
 *
 * Confirmation matters. An unconfirmed address may belong to somebody else, and
 * claiming on it would hand a stranger access meant for the real owner of the
 * address. So the claim is gated on `email_confirmed_at`, not on signup alone.
 */

import { randomBytes } from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/resend/client";
import { PERMISSION_LABEL, type PermissionLevel } from "@/lib/drive/types";

export interface InvitationInput {
  email: string;
  fileId: string | null;
  folderId: string | null;
  permission: PermissionLevel;
  invitedBy: string;
  itemName: string;
  ownerName: string;
}

export interface InvitationResult {
  id: string;
  token: string;
  url: string;
  /** True when the mail was handed to the provider. Never claimed otherwise. */
  delivered: boolean;
  expiresAt: string;
}

const TTL_DAYS = 14;

/**
 * Create an invitation and email it.
 *
 * Idempotent per (address, item): re-inviting the same person about the same file
 * revokes the earlier token and issues a new one, so the link in the newest email is
 * the only one that works. Without that, every re-send would leave another live key
 * to the same file.
 */
export async function createInvitation(input: InvitationInput): Promise<InvitationResult> {
  const supabase = getServiceClient();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString();

  await supabase
    .from("share_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", input.email)
    .eq(input.fileId ? "file_id" : "folder_id", input.fileId ?? input.folderId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  const { data, error } = await supabase
    .from("share_invitations")
    .insert({
      email: input.email,
      file_id: input.fileId,
      folder_id: input.folderId,
      permission: input.permission,
      token,
      invited_by: input.invitedBy,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("invitation_not_created");
  }

  /*
   * The email links to the item's public page, which is the same page a public share
   * link opens. Opening it is what proves control of the address — the token is
   * unguessable and single-purpose — and once they sign up with that address the
   * grant appears in their own drive.
   *
   * `SITE.url` rather than a request-derived origin: a share email must never point
   * at a preview deployment.
   */
  const { SITE } = await import("@/config/site");
  const url = `${SITE.url}/s/${token}`;

  const sent = await sendEmail({
    to: input.email,
    template: "share-invite",
    data: {
      name: input.email.split("@")[0] ?? "there",
      ownerName: input.ownerName,
      itemName: input.itemName,
      permissionLabel: PERMISSION_LABEL[input.permission].toLowerCase(),
      expiresLabel: `${TTL_DAYS} days`,
      url,
    },
  });

  return {
    id: data.id as string,
    token,
    url,
    // Honest: a missing provider or a rejected send is reported as not delivered, and
    // the caller shows the link instead.
    delivered: sent.ok,
    expiresAt,
  };
}

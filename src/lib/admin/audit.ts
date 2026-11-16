/**
 * Operator audit writes.
 *
 * An audit record is written **after** the action it describes has succeeded — and
 * never in place of reporting a failure. A log entry for something that did not
 * happen is worse than no entry: it is a fabricated history.
 *
 * If the audit insert itself fails, the caller is told. Swallowing that error would
 * leave an operator action with no record, which is the one outcome an audit trail
 * exists to prevent.
 */

import "server-only";

import { AppError } from "@/domain/auth/errors";
import type { AdminContext } from "./auth";

export type AuditAction =
  | "admin.granted"
  | "admin.role_changed"
  | "admin.revoked"
  | "admin.exported"
  | "support.status_changed"
  | "support.assigned"
  | "support.replied"
  | "support.note_added";

export async function writeAudit(
  { db, admin }: AdminContext,
  entry: {
    action: AuditAction;
    targetType: "platform_admin" | "support_ticket";
    targetId: string | null;
    /** Safe, structured detail. Never a message body or a secret. */
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.from("platform_admin_audit_logs").insert({
    actor_id: admin.userId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error("[admin] audit write failed", { action: entry.action, message: error.message });
    throw new AppError(
      "unknown",
      "That action went through, but we couldn't record it in the audit log. Please tell the platform owner.",
    );
  }
}

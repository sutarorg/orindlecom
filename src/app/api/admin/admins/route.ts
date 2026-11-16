/**
 * /api/admin/admins — grant, re-role and revoke platform administration.
 *
 * Owner-only. Three defences in a row, and all three are load-bearing:
 *
 *   1. `permission: "manage_platform_admins"` — the permission map grants it to
 *      `owner` alone, so an ordinary admin gets 403 before any query runs.
 *   2. The last-active-owner invariant is a DEFERRED constraint trigger in the
 *      database. A route-level check cannot hold against two simultaneous
 *      revocations; COMMIT can.
 *   3. Every change writes an audit record. A grant with no record is not a grant
 *      this system accepts.
 *
 * What is deliberately absent: creating accounts. A grant requires an existing,
 * verified account, because "create an admin user" is how a shadow account gets
 * made.
 */

import { AppError } from "@/domain/auth/errors";
import { readJson, requireString, requireUuid } from "@/lib/api";
import { writeAudit } from "@/lib/admin/audit";
import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { findVerifiedUserByEmail, getPlatformAdminEmail, listPlatformAdmins } from "@/lib/admin/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["owner", "admin"] as const;

/** POST — grant or re-role. Accepts either `userId` or `email`. */
export async function POST(request: Request) {
  return adminRoute(
    async (ctx) => {
      const body = await readJson(request);
      const role = requireString(body, "role", { max: 10 });

      if (!(ROLES as readonly string[]).includes(role)) {
        throw new AppError("validation_failed", "That role isn't valid.");
      }

      let userId: string;
      let email: string | null;

      if (typeof body.email === "string" && body.email.trim().length > 0 && !body.userId) {
        const lookup = await findVerifiedUserByEmail(ctx, body.email);
        if (!lookup) {
          throw new AppError(
            "not_found",
            "No Orindle account with that email exists. The person must sign up first.",
          );
        }
        if (!lookup.verified) {
          throw new AppError(
            "validation_failed",
            "That account hasn't verified its email yet. Ask them to confirm their email first.",
          );
        }
        userId = lookup.userId;
        email = lookup.email;
      } else {
        userId = requireUuid(body, "userId");
        email = await getPlatformAdminEmail(ctx, userId);
        if (!email) {
          throw new AppError("not_found", "No account with that id exists.");
        }
      }

      const { data: account } = await ctx.db
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!account) {
        throw new AppError("not_found", "No account with that id exists.");
      }

      const { data: existing } = await ctx.db
        .from("platform_admins")
        .select("role, is_active")
        .eq("user_id", userId)
        .maybeSingle();

      const { error } = await ctx.db.from("platform_admins").upsert(
        {
          user_id: userId,
          role,
          is_active: true,
          disabled_at: null,
          created_by: ctx.admin.userId,
        },
        { onConflict: "user_id" },
      );

      if (error) {
        // The constraint trigger's message is the only one worth surfacing
        // verbatim: it explains exactly what to do instead.
        if (error.message.includes("last_platform_owner")) {
          throw new AppError(
            "conflict",
            "That would leave the platform with no active owner. Grant ownership to another account first.",
          );
        }
        throw new AppError("unknown", "We couldn't save that change.");
      }

      await writeAudit(ctx, {
        action: existing ? "admin.role_changed" : "admin.granted",
        targetType: "platform_admin",
        targetId: userId,
        // The email is stored because the actor row may later be deleted; the
        // audit trail has to remain readable on its own.
        metadata: { email, from: existing?.role ?? null, to: role },
      });

      return adminOk({ userId, role, granted: true });
    },
    { permission: "manage_platform_admins", limit: "adminMutation" },
  );
}

/** DELETE — revoke access. Soft: the row stays, disabled, with a timestamp. */
export async function DELETE(request: Request) {
  return adminRoute(
    async (ctx) => {
      const body = await readJson(request);
      const userId = requireUuid(body, "userId");

      if (userId === ctx.admin.userId) {
        // Not a technical limit — the database would allow it with another owner
        // present. It is a guard against the specific mistake of an owner
        // removing their own access in a hurry.
        throw new AppError(
          "forbidden",
          "You cannot revoke your own access. Ask another platform owner to do it.",
        );
      }

      const admins = await listPlatformAdmins(ctx);
      const target = admins.find((row) => row.userId === userId);
      if (!target) throw new AppError("not_found", "That account is not a platform administrator.");

      const activeOwners = admins.filter((row) => row.role === "owner" && row.isActive).length;
      if (target.role === "owner" && target.isActive && activeOwners <= 1) {
        // Checked here for a useful message; the constraint trigger is what
        // actually enforces it.
        throw new AppError(
          "conflict",
          "That would leave the platform with no active owner. Grant ownership to another account first.",
        );
      }

      const { error } = await ctx.db
        .from("platform_admins")
        .update({ is_active: false, disabled_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) {
        if (error.message.includes("last_platform_owner")) {
          throw new AppError(
            "conflict",
            "That would leave the platform with no active owner.",
          );
        }
        throw new AppError("unknown", "We couldn't revoke that access.");
      }

      await writeAudit(ctx, {
        action: "admin.revoked",
        targetType: "platform_admin",
        targetId: userId,
        metadata: { email: target.email, role: target.role },
      });

      return adminOk({ userId, revoked: true });
    },
    { permission: "manage_platform_admins", limit: "adminMutation" },
  );
}

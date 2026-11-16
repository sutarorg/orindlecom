/**
 * Platform administrator authorization.
 *
 * ── The one rule this file exists to enforce ─────────────────────────────────
 *
 * **The privileged service client is not obtained until authorization has
 * succeeded.** Not "isn't used" — isn't obtained. A module that builds the
 * service client at the top of the file and then checks a role has already
 * crossed the line, because the very next refactor is an early return path that
 * forgot it, and nothing in the type system says no.
 *
 * `requirePlatformAdmin()` is the only exported way to get both the operator and
 * the client together. There is no other export that returns the service client.
 *
 * ── Why two clients ─────────────────────────────────────────────────────────
 *
 * The check runs over the *user-scoped* client, so RLS applies. The only policy on
 * `platform_admins` is `user_id = auth.uid()`, which means the query "is there an
 * active admin row for me" can physically only ever return the caller's own row.
 * Checking with the service client would work — it bypasses RLS — but then the
 * check would be a query whose safety depends on a `.eq()` somebody might remove.
 *
 * ── What is deliberately NOT accepted as proof ──────────────────────────────
 *
 * user_metadata (user-writable), a header, a cookie, a form field, a JWT claim the
 * client can influence, `members.role` (that is a *customer's* organization role),
 * or simply "there is a session".
 */

import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { AppError } from "@/domain/auth/errors";
import { resolveActor } from "@/domain/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The two platform roles. Not the organization roles, and deliberately spelled
 *  differently from `BusinessRole` wherever confusion is possible. */
export type PlatformRole = "owner" | "admin";

export interface PlatformAdmin {
  userId: string;
  email: string;
  fullName: string | null;
  role: PlatformRole;
}

/**
 * The permission map.
 *
 * One table, not a comparison per page. The point is that a reviewer can read
 * every privileged capability in the product in twelve lines, and that adding a
 * page cannot silently widen anyone's authority: a route that names a permission
 * absent from this map is a type error.
 */
export const PLATFORM_PERMISSIONS = {
  /** Read operational data: users, billing, storage, teams, support, logs. */
  view_operations: ["owner", "admin"],
  /** Reply to a customer, change ticket state, add internal notes. */
  manage_support: ["owner", "admin"],
  /** See the platform audit trail. */
  view_audit_log: ["owner", "admin"],
  /** See which integrations are configured (presence only, never values). */
  view_settings: ["owner", "admin"],
  /** Grant, revoke and re-role platform administrators. */
  manage_platform_admins: ["owner"],
  /** Change platform-level configuration. Nothing is editable in v1, but the
   *  permission exists so the rule is written down rather than invented later. */
  manage_platform_settings: ["owner"],
  /** Change approved pricing. Requires a separate approval workflow; not built. */
  manage_pricing: ["owner"],
} as const satisfies Record<string, readonly PlatformRole[]>;

export type PlatformPermission = keyof typeof PLATFORM_PERMISSIONS;

export function roleCan(role: PlatformRole, permission: PlatformPermission): boolean {
  return (PLATFORM_PERMISSIONS[permission] as readonly PlatformRole[]).includes(role);
}

export type AdminAuthFailure = "unauthenticated" | "email_unverified" | "not_configured" | "forbidden";

/**
 * Resolve the caller's administrator record, or null.
 *
 * Wrapped in `cache` so a layout, a page and a nested component in one request
 * share a single resolution instead of three round trips.
 */
export const resolvePlatformAdmin = cache(async (): Promise<
  { ok: true; admin: PlatformAdmin } | { ok: false; code: AdminAuthFailure }
> => {
  const actorResult = await resolveActor();
  if (!actorResult.ok) {
    // resolveActor already refuses an unverified address, which is the
    // requirement's "unverified account: refused" path.
    const code =
      actorResult.code === "not_configured"
        ? "not_configured"
        : actorResult.code === "email_unverified"
          ? "email_unverified"
          : "unauthenticated";
    return { ok: false, code };
  }

  const { actor } = actorResult;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("platform_admins")
      .select("role, is_active")
      .eq("user_id", actor.userId)
      .maybeSingle();

    if (error) {
      // A read failure is a refusal, not a pass. Failing open here would turn a
      // database blip into a privilege escalation.
      console.error("[admin] authorization read failed", { message: error.message });
      return { ok: false, code: "forbidden" };
    }

    if (!data || !data.is_active) return { ok: false, code: "forbidden" };

    const role = data.role === "owner" ? "owner" : "admin";

    return {
      ok: true,
      admin: {
        userId: actor.userId,
        email: actor.email,
        fullName: actor.fullName,
        role,
      },
    };
  } catch (error) {
    console.error("[admin] authorization threw", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, code: "forbidden" };
  }
});

/**
 * The authorized context: an operator, a role, and only now the privileged client.
 *
 * Nothing returns this tuple without the check above having passed.
 */
export interface AdminContext {
  admin: PlatformAdmin;
  /** Service-role client. Building it requires SUPABASE_SERVICE_ROLE_KEY. */
  db: SupabaseClient;
}

/**
 * Authorize, then and only then build the service client.
 *
 * Throws `AppError` so route handlers get the standard envelope from `handle()`:
 *   401 unauthenticated — no session
 *   403 email_unverified — session, but the address was never confirmed
 *   403 forbidden — signed in and verified, but not an active platform admin
 *   503 not_configured — deployment has no Supabase credentials
 */
export async function requirePlatformAdmin(
  permission?: PlatformPermission,
): Promise<AdminContext> {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    if (result.code === "unauthenticated") {
      throw new AppError("unauthenticated", "You need to sign in to do that.");
    }
    if (result.code === "email_unverified") {
      throw new AppError("email_unverified", "Confirm your email address first.");
    }
    if (result.code === "not_configured") {
      throw new AppError("not_configured", "Accounts aren't connected on this deployment yet.");
    }
    // Deliberately the same message as "no such page". An authenticated customer
    // probing /admin should not learn that /admin is real, populated, and simply
    // closed to them.
    throw new AppError("forbidden", "You don't have permission to do that.");
  }

  if (permission && !roleCan(result.admin.role, permission)) {
    throw new AppError(
      "forbidden",
      "That action is limited to the platform owner.",
    );
  }

  // Only here. Everything above is a read over RLS as the user.
  if (!isServiceConfigured()) {
    throw new AppError("not_configured", "Administration isn't connected on this deployment yet.");
  }

  return { admin: result.admin, db: getServiceClient() };
}

/** Convenience for pages: the operator, without the client. */
export async function requireAdminPage(permission?: PlatformPermission): Promise<PlatformAdmin> {
  const { admin } = await requirePlatformAdmin(permission);
  return admin;
}

/**
 * The page variant: same authorization, but a refusal redirects instead of throwing.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * A layout and its page render concurrently in the App Router, so a page cannot
 * rely on the layout having redirected first. When the page throws instead, Next
 * logs the error and serves the `error.tsx` boundary — and a redirect from the
 * layout that lands on the right screen does not undo the error entry. The visitor
 * sees the correct refusal page; the logs fill with 500s, which is how a real
 * outage gets missed.
 *
 * So: **API routes throw** (they need a JSON status code and `adminRoute` maps the
 * `AppError`), and **pages redirect**. Same `resolvePlatformAdmin` underneath, same
 * order of operations, same refusal page — only the failure transport differs.
 */
export async function requireAdminPageContext(
  permission?: PlatformPermission,
): Promise<AdminContext> {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    if (result.code === "unauthenticated") redirect("/login?next=/admin");
    if (result.code === "email_unverified") redirect("/verify-email?next=/admin");
    if (result.code === "not_configured") redirect("/access-denied?reason=not-configured");
    redirect("/access-denied");
  }

  if (permission && !roleCan(result.admin.role, permission)) {
    // An `admin` reaching an owner-only page gets the same page as a customer.
    // Telling them "you are an admin, but not enough of one" is a permission map
    // disclosure they have no use for.
    redirect("/access-denied");
  }

  if (!isServiceConfigured()) redirect("/access-denied?reason=not-configured");

  return { admin: result.admin, db: getServiceClient() };
}

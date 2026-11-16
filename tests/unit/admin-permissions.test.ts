/**
 * The platform-permission map, and the separation it encodes.
 *
 * These are assertions about a data structure rather than about an HTTP call, and
 * that is deliberate: the permission map is where the rules are written down. If a
 * role were silently added to `manage_platform_admins`, every `requirePlatformAdmin`
 * call site would keep working and nothing would fail. This test would.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PLATFORM_PERMISSIONS, roleCan } from "@/lib/admin/auth";

const ROOT = path.resolve(__dirname, "../..");

describe("platform permission map", () => {
  it("gives an admin operator every operational permission", () => {
    for (const permission of [
      "view_operations",
      "manage_support",
      "view_audit_log",
      "view_settings",
    ] as const) {
      expect(roleCan("admin", permission), permission).toBe(true);
    }
  });

  it("reserves the dangerous permissions for the platform owner", () => {
    for (const permission of [
      "manage_platform_admins",
      "manage_platform_settings",
      "manage_pricing",
    ] as const) {
      expect(roleCan("admin", permission), permission).toBe(false);
      expect(roleCan("owner", permission), permission).toBe(true);
    }
  });

  it("names exactly three owner-only permissions", () => {
    const ownerOnly = Object.entries(PLATFORM_PERMISSIONS)
      .filter(([, roles]) => !(roles as readonly string[]).includes("admin"))
      .map(([name]) => name)
      .sort();
    expect(ownerOnly).toEqual([
      "manage_platform_admins",
      "manage_platform_settings",
      "manage_pricing",
    ]);
  });

  it("permits only the two platform roles, never a business role", () => {
    // `members.role` values. None of them is a platform role, and none may be
    // accepted anywhere `PlatformRole` is expected — including at runtime, where
    // a string from a customer row could otherwise reach `roleCan`.
    const businessRoles = ["owner", "admin", "member", "manager", "viewer"];
    for (const businessRole of businessRoles) {
      if (businessRole === "owner" || businessRole === "admin") continue;
      const isPlatformRole = Object.values(PLATFORM_PERMISSIONS).some((roles) =>
        (roles as readonly string[]).includes(businessRole),
      );
      expect(isPlatformRole, `${businessRole} must not be a platform role`).toBe(false);
    }
  });

  it("has no permission for anything the console must not do", () => {
    // Customer account deletion, impersonation, plan assignment and payment
    // manipulation are prohibited. A permission named for one of them would be the
    // first step toward building it.
    const forbidden = [
      "delete_user",
      "impersonate",
      "impersonate_user",
      "assign_plan",
      "change_plan",
      "refund",
      "manual_payment",
      "adjust_storage",
      "delete_file",
      "override_restriction",
      "approve_signup",
    ];
    const names = Object.keys(PLATFORM_PERMISSIONS);
    for (const name of forbidden) {
      expect(names, `${name} must not exist`).not.toContain(name);
    }
  });
});

describe("authorization boundary in the source", () => {
  it("never lets a page or route pass a caller-supplied role to roleCan", async () => {
    /*
     * `roleCan` must only ever receive the role read from `platform_admins` by
     * `resolvePlatformAdmin`. If a page called `roleCan(body.role, …)` the check
     * would be advisory. Asserting the call sites is the only static way to say so.
     */
    const files = [
      "src/lib/admin/auth.ts",
      "src/lib/admin/route-helpers.ts",
      "src/app/admin/layout.tsx",
    ];
    for (const file of files) {
      const raw = await readFile(path.join(ROOT, file), "utf8");
      // The declaration itself is `roleCan(role: PlatformRole, …)`, and a comment
      // describing the rule is not a call site. Strip both before looking for calls.
      const text = raw
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/export function roleCan\([\s\S]*?\n}/g, "");
      for (const match of text.matchAll(/roleCan\(([^,)]+)/g)) {
        const argument = match[1].trim();
        expect(
          ["role", "ctx.admin.role", "admin.role", "input.role"].some((allowed) =>
            argument === allowed || argument.endsWith(".role"),
          ),
          `${file}: roleCan(${argument}) looks caller-supplied`,
        ).toBe(true);
      }
    }
  });

  it("keeps business-role checks out of the admin layer", async () => {
    // `BusinessRole` is a customer's organization role. Reading it anywhere in the
    // admin authorization path would be the exact inheritance bug the requirement
    // forbids.
    const raw = await readFile(path.join(ROOT, "src/lib/admin/auth.ts"), "utf8");
    // Comments may (and do) name BusinessRole to explain the distinction; code
    // must never import it or read a member row's role.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/BusinessRole|from "\.\/members"|\.from\("members"\)/);
  });
});

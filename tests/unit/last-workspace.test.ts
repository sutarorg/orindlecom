/**
 * Post-login destination.
 *
 * The stored path comes from the browser and ends up in a `redirect()`, which is the
 * exact shape of an open redirect. These tests exist to pin the validation rather
 * than to exercise a happy path: a permissive change here would let a crafted link
 * send a freshly-authenticated customer to an attacker's page.
 *
 * The suite is deliberately hostile — protocol-relative paths, backslash tricks,
 * embedded control characters, and lookalike prefixes are all in the table below.
 */
import { describe, expect, it } from "vitest";

import {
  destinationFor,
  sanitizeWorkspacePath,
  workspaceForPath,
} from "@/lib/navigation/last-workspace";

describe("sanitizeWorkspacePath", () => {
  it.each([
    "/dashboard",
    "/dashboard/files",
    "/dashboard/files/abc-123",
    "/business",
    "/business/members",
    "/business/folders",
  ])("accepts %s", (path) => {
    expect(sanitizeWorkspacePath(path)).toBe(path);
  });

  it.each([
    // Absolute URLs — the obvious attack.
    "https://evil.example/steal",
    "http://evil.example",
    // Protocol-relative: inherits the current scheme, leaves the origin.
    "//evil.example",
    // Browsers normalise `/\host` to `//host`.
    "/\\evil.example",
    // Control characters can terminate a header or split a URL.
    "/dashboard\nLocation: https://evil.example",
    "/dashboard\r\nX: y",
    // Outside the two workspaces.
    "/login",
    "/pricing",
    "/admin",
    // Lookalikes: a prefix match on the raw string would wrongly accept these.
    "/dashboard-evil",
    "/business.evil.example",
    "/account",
    // Empty and junk.
    "",
    "   ",
    "/",
  ])("rejects %j", (path) => {
    expect(sanitizeWorkspacePath(path)).toBeNull();
  });

  it("rejects non-strings", () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(sanitizeWorkspacePath(value)).toBeNull();
    }
  });

  it("drops query strings and fragments", () => {
    // An invite token or a one-time code must not be replayed at sign-in.
    expect(sanitizeWorkspacePath("/business?invite=secret-token")).toBe("/business");
    expect(sanitizeWorkspacePath("/dashboard/files#top")).toBe("/dashboard/files");
  });

  it("does not land on a settings page", () => {
    // Returning someone straight into settings after login is disorienting, and it
    // is one click from destructive controls.
    expect(sanitizeWorkspacePath("/dashboard/profile")).toBeNull();
    expect(sanitizeWorkspacePath("/business/settings")).toBeNull();
  });
});

describe("workspaceForPath", () => {
  it("identifies the workspace a path belongs to", () => {
    expect(workspaceForPath("/dashboard")).toBe("personal");
    expect(workspaceForPath("/dashboard/files")).toBe("personal");
    expect(workspaceForPath("/business")).toBe("business");
    expect(workspaceForPath("/business/members")).toBe("business");
  });

  it("does not classify a lookalike as a workspace", () => {
    expect(workspaceForPath("/dashboard-evil")).toBeNull();
    expect(workspaceForPath("/pricing")).toBeNull();
  });
});

describe("destinationFor", () => {
  it("returns the stored path when there is one", () => {
    expect(destinationFor({ workspace: "business", path: "/business/members" })).toBe(
      "/business/members",
    );
  });

  it("falls back to the stored workspace root", () => {
    expect(destinationFor({ workspace: "business", path: null })).toBe("/business");
  });

  it("sends a brand-new account to the dashboard", () => {
    // No profile preference yet: this is the first signup.
    expect(destinationFor({ workspace: null, path: null })).toBe("/dashboard");
  });
});

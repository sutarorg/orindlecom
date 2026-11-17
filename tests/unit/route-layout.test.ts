/**
 * Route layout invariants.
 *
 * The team workspace and the public marketing page both used to be reachable at
 * `/business`, so the workspace had to live at `/dashboard/business`. They are now
 * separate paths, and the separation is easy to undo by accident: one stray link
 * back to `/dashboard/business` sends people to a 404, and one stray public link to
 * `/business` sends anonymous visitors into the app, which redirects them to login.
 *
 * These assertions read the filesystem and the source rather than a built server,
 * because the failure mode being guarded against is a wrong path in a string.
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

async function exists(relative: string): Promise<boolean> {
  try {
    await stat(path.join(ROOT, relative));
    return true;
  } catch {
    return false;
  }
}

async function read(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

describe("route layout", () => {
  it("serves the workspace at /business", async () => {
    expect(await exists("src/app/business/page.tsx")).toBe(true);
    expect(await exists("src/app/business/layout.tsx")).toBe(true);
    // The workspace sub-routes moved with it.
    for (const segment of ["members", "folders", "permissions", "activity", "storage", "settings"]) {
      expect(await exists(`src/app/business/${segment}/page.tsx`)).toBe(true);
    }
  });

  it("no longer nests the workspace under /dashboard", async () => {
    expect(await exists("src/app/dashboard/business")).toBe(false);
  });

  it("serves the public team page at /teams", async () => {
    expect(await exists("src/app/teams/page.tsx")).toBe(true);
  });

  it("points no source file at the old workspace path", async () => {
    // A 404 for any user who clicks a stale link. Comments are stripped first:
    // prose explaining the move legitimately names the old path, and only a real
    // href/redirect is a bug.
    const { execSync } = await import("node:child_process");
    const files = execSync(
      "grep -rl 'dashboard/business' src 2>/dev/null || true",
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    const offenders: string[] = [];
    for (const file of files) {
      const code = (await read(file))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      if (code.includes("dashboard/business")) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the marketing nav off the signed-in workspace", async () => {
    // PRIMARY_NAV and FOOTER_NAV must not send anonymous visitors to /business.
    const site = await read("src/config/site.ts");
    expect(site).not.toContain('href: "/business"');
    expect(site).toContain('href: "/teams"');
  });

  it("marks the marketing page's canonical path as /teams", async () => {
    const seo = await read("src/config/seo-pages.ts");
    const businessEntry = seo.slice(seo.indexOf("business: {"), seo.indexOf("business: {") + 200);
    expect(businessEntry).toContain('path: "/teams"');
  });

  it("gates the workspace without relying on middleware", async () => {
    // /business is no longer beneath /dashboard, so it must defend itself: middleware
    // is skipped entirely when Supabase env is absent.
    const layout = await read("src/app/business/layout.tsx");
    expect(layout).toContain("viewer.authenticated");
    expect(layout).toMatch(/redirect\(/);
  });
});

/**
 * Admin console — architectural and authorization guarantees.
 *
 * The Prompt 8 test file used to assert that **no** directory under `src/app/`
 * matched `/(admin|abuse-dashboard|review-queue)/`. That assertion was correct for
 * its time and is now wrong: this product deliberately has a platform
 * administration console.
 *
 * It has not been deleted. It has been **narrowed to what it was actually
 * protecting** — the absence of an anti-abuse monitoring surface — and the
 * remaining admin surface now has to satisfy a much longer list of properties,
 * which is a stronger test than the blanket ban ever was.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const APP = path.join(SRC, "app");
const ADMIN_API = path.join(APP, "api", "admin");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function read(file: string): Promise<string> {
  return readFile(file, "utf8");
}

/** Strip comments so a prohibition described in prose is not read as a violation. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("anti-abuse surface (the requirement that still holds)", () => {
  it("ships no anti-abuse dashboard, risk console or review queue", async () => {
    // The Prompt 8 requirement: automated enforcement only, no manual review.
    // A general admin console does not change that, so these paths must not exist.
    const forbidden = [
      path.join(APP, "admin", "abuse"),
      path.join(APP, "admin", "risk"),
      path.join(APP, "admin", "review-queue"),
      path.join(APP, "admin", "review"),
      path.join(APP, "admin", "approvals"),
      path.join(APP, "admin", "devices"),
      path.join(APP, "admin", "ip"),
    ];

    for (const forbiddenPath of forbidden) {
      const entries = await readdir(forbiddenPath).catch(() => null);
      expect(entries, `${forbiddenPath} must not exist`).toBeNull();
    }
  });

  it("exposes no anti-abuse table through an admin API", async () => {
    // risk_events, device_signups and account_restrictions are server-only. A
    // general console must not become a window onto them.
    const forbidden = [
      "risk_events",
      "device_signups",
      "account_restrictions",
      "abuse_policy",
      "turnstile_tokens",
      "email_domain_risk",
    ];

    const files = await walk(ADMIN_API);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = stripComments(await read(file));
      for (const table of forbidden) {
        expect(source, `${file} must not read ${table}`).not.toContain(`"${table}"`);
      }
    }
  });

  it("never references a device or IP hash anywhere in the admin surface", async () => {
    const files = [...(await walk(path.join(APP, "admin"))), ...(await walk(ADMIN_API))];
    for (const file of files) {
      const source = stripComments(await read(file));
      expect(source, `${file} must not touch device_hash`).not.toMatch(/device_hash/);
      expect(source, `${file} must not touch ip_hash`).not.toMatch(/ip_hash/);
    }
  });

  it("has no approval or review table in any migration", async () => {
    const dir = path.join(ROOT, "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql"));
    const offenders: string[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(dir, file), "utf8");
      if (/create table public\.(approval|review|pending_registration)/i.test(sql)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("every admin API route authorizes independently", () => {
  it("calls requirePlatformAdmin, directly or through adminRoute", async () => {
    const files = (await walk(ADMIN_API)).filter((file) => file.endsWith("route.ts"));
    expect(files.length).toBeGreaterThanOrEqual(10);

    for (const file of files) {
      const source = stripComments(await read(file));
      const authorized = /requirePlatformAdmin\(/.test(source) || /adminRoute\(/.test(source);
      expect(authorized, `${file} must authorize before doing anything`).toBe(true);
    }
  });

  it("never obtains the privileged client before authorizing", async () => {
    /*
     * The ordering requirement from the specification: "Never obtain the privileged
     * service client before the administrator has been authorized."
     *
     * Two things are asserted, and the difference matters:
     *
     *   - `getServiceClient` must not appear in a route body at all, because the
     *     authorized context already carries the client. Reaching for it directly
     *     is the way the ordering guarantee gets lost.
     *   - `isServiceConfigured` IS allowed: it returns a boolean for a settings
     *     display and builds nothing. Banning it would force a route to duplicate
     *     its own presence check, which would be worse.
     */
    const files = (await walk(ADMIN_API)).filter((file) => file.endsWith("route.ts"));

    for (const file of files) {
      const source = stripComments(await read(file));
      expect(
        source,
        `${file} must obtain the client from the authorized context, not directly`,
      ).not.toMatch(/getServiceClient\s*\(/);
    }
  });

  it("declares the permission each route requires", async () => {
    // A route that authorizes but names no permission is implicitly "any admin".
    // Naming it makes the required authority reviewable in one grep.
    const files = (await walk(ADMIN_API)).filter((file) => file.endsWith("route.ts"));
    for (const file of files) {
      const source = stripComments(await read(file));
      if (!/adminRoute\(/.test(source)) continue;
      expect(source, `${file} must name a permission`).toMatch(/permission:\s*"/);
    }
  });
});

describe("the authorization module", () => {
  it("is server-only", async () => {
    const source = await read(path.join(SRC, "lib", "admin", "auth.ts"));
    expect(source).toMatch(/import\s+["']server-only["']/);
  });

  it("checks over the user-scoped client, not the service client", async () => {
    /*
     * The security property: the authorization read runs with RLS applied, so the
     * query physically cannot return another person's administrator row. Using the
     * service client for this read would work but would make safety depend on a
     * `.eq()` nobody might keep.
     */
    const source = stripComments(await read(path.join(SRC, "lib", "admin", "auth.ts")));
    expect(source).toContain("createSupabaseServerClient");
    expect(source).toContain('from("platform_admins")');

    // The service client may only appear after the authorization block.
    const authIndex = source.indexOf(".from(\"platform_admins\")");
    const serviceIndex = source.indexOf("getServiceClient()");
    expect(authIndex).toBeGreaterThan(-1);
    expect(serviceIndex).toBeGreaterThan(authIndex);
  });

  it("treats a read failure as a refusal", async () => {
    // Failing open on a database error turns a blip into a privilege escalation.
    const source = stripComments(await read(path.join(SRC, "lib", "admin", "auth.ts")));
    const block = source.slice(
      source.indexOf("if (error)"),
      source.indexOf("if (error)") + 400,
    );
    expect(block).toMatch(/return\s*\{\s*ok:\s*false/);
  });

  it("does not accept any client-supplied proof of administration", async () => {
    const files = await walk(path.join(SRC, "lib", "admin"));
    const patterns = [
      /body\.isAdmin/,
      /searchParams\.get\(["']role/,
      /user_metadata.*role/i,
      /localStorage.*admin/i,
      /headers\(\).*admin/i,
    ];

    for (const file of files) {
      const source = stripComments(await read(file));
      for (const pattern of patterns) {
        expect(source, `${file} must not trust ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("keeps the platform permission map in one place", async () => {
    const source = await read(path.join(SRC, "lib", "admin", "auth.ts"));
    expect(source).toContain("PLATFORM_PERMISSIONS");
    expect(source).toContain("manage_platform_admins");
    // Owner-only capabilities must actually be owner-only.
    const block = source.slice(
      source.indexOf("manage_platform_admins"),
      source.indexOf("manage_platform_admins") + 120,
    );
    expect(block).toContain('["owner"]');
  });
});

describe("no privileged code can reach the browser", () => {
  it("no client component imports an admin server module", async () => {
    const files = await walk(path.join(SRC, "components", "admin"));
    for (const file of files) {
      const source = await read(file);
      if (!/^\s*["']use client["']/m.test(source)) continue;
      expect(source, `${file} must not import lib/admin/service`).not.toMatch(
        /from\s+["']@\/lib\/admin\/service["']/,
      );
      expect(source, `${file} must not import lib/admin/auth`).not.toMatch(
        /from\s+["']@\/lib\/admin\/auth["']/,
      );
      expect(source, `${file} must not import the service client`).not.toMatch(
        /from\s+["']@\/lib\/supabase\/service["']/,
      );
    }
  });

  it("keeps the service-role module server-only", async () => {
    const source = await read(path.join(SRC, "lib", "supabase", "service.ts"));
    expect(source).toMatch(/import\s+["']server-only["']/);
  });
});

describe("pages are excluded from indexing", () => {
  it("every admin page declares noindex", async () => {
    const files = (await walk(path.join(APP, "admin"))).filter(
      (file) => file.endsWith("page.tsx") || file.endsWith("layout.tsx"),
    );
    expect(files.length).toBeGreaterThanOrEqual(9);

    for (const file of files) {
      const source = stripComments(await read(file));
      expect(source, `${file} must set robots noindex`).toMatch(/robots:\s*\{[^}]*index:\s*false/);
    }
  });

  it("robots.txt disallows /admin", async () => {
    const source = await read(path.join(APP, "robots.ts"));
    expect(source).toContain('"/admin"');
  });

  it("the sitemap contains no admin route", async () => {
    const source = await read(path.join(APP, "sitemap.ts"));
    const config = await read(path.join(SRC, "config", "seo-pages.ts"));
    expect(source).not.toMatch(/["'`]\/admin/);
    expect(config).not.toMatch(/["'`]\/admin/);
  });
});

describe("the anti-abuse documentation is still accurate", () => {
  it("says there is a console but no abuse monitoring surface", async () => {
    const doc = await read(path.join(ROOT, "docs", "security", "anti-abuse-system.md"));
    // The claim must have been updated: it used to say there is no administrator
    // surface at all, which stopped being true the moment /admin shipped.
    expect(doc).toMatch(/no anti-abuse monitoring|not an anti-abuse monitoring/i);
  });
});

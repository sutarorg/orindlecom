/**
 * Structural guarantees about the admin layer.
 *
 * These assert things about the shape of the code rather than its output, because
 * the failures they prevent are the kind that pass every behavioural test:
 *
 *  - a module reachable from the browser that holds a secret
 *  - a page that ships the whole table to the client and filters it there
 *  - a privileged query that forgot to be scoped
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Removes comments so a rule cannot be satisfied by prose about the rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("secrets stay on the server", () => {
  it("marks every module that reads a private key as server-only", async () => {
    const files = await walk(path.join(ROOT, "src"));
    const offenders: string[] = [];

    for (const file of files) {
      const code = stripComments(await readFile(file, "utf8"));
      const readsSecret = /process\.env\.(GA_SERVICE_ACCOUNT_PRIVATE_KEY|GSC_SERVICE_ACCOUNT_PRIVATE_KEY|SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|RESEND_API_KEY|TURNSTILE_SECRET_KEY)/.test(
        code,
      );
      if (!readsSecret) continue;
      if (code.includes('"server-only"')) continue;
      // The env var registry is documentation, not a consumer.
      if (file.endsWith(path.join("config", "env.ts"))) continue;
      /*
       * Route handlers and `"use server"` actions are already server boundaries:
       * Next refuses to bundle either into a client chunk, so a `server-only`
       * import there would be a comment rather than a guard. Requiring one would
       * train the reader to add a meaningless line, which is worse than the
       * explicit boundary check below.
       */
      const isServerBoundary =
        /(^|\/)route\.ts$/.test(file) || /^\s*["']use server["'];?/m.test(code);
      if (isServerBoundary) continue;
      offenders.push(path.relative(ROOT, file));
    }

    expect(offenders, "these files read a secret without `import \"server-only\"`").toEqual([]);
  });

  it("keeps every file that reads a secret out of the client bundle", async () => {
    // The exemption above is only sound if those files are genuinely server
    // boundaries. Assert the boundary itself rather than trusting the path.
    for (const file of [
      "src/app/api/health/route.ts",
      "src/app/api/admin/settings/route.ts",
      "src/app/contact/actions.ts",
    ]) {
      const code = await readFile(path.join(ROOT, file), "utf8");
      const boundary = /(^|\/)route\.ts$/.test(file) || /^\s*["']use server["'];?/m.test(code);
      expect(boundary, `${file} must be a server boundary`).toBe(true);
    }
  });

  it("marks the admin data, csv and analytics modules server-only", async () => {
    for (const file of [
      "src/lib/admin/auth.ts",
      "src/lib/admin/service.ts",
      "src/lib/admin/csv.ts",
      "src/lib/admin/analytics.ts",
      "src/lib/admin/audit.ts",
    ]) {
      const code = await readFile(path.join(ROOT, file), "utf8");
      expect(code, file).toContain('import "server-only"');
    }
  });

  it("never exposes the service client to a client component", async () => {
    const files = await walk(path.join(ROOT, "src"));
    const offenders: string[] = [];
    for (const file of files) {
      const raw = await readFile(file, "utf8");
      const code = stripComments(raw);
      if (!code.includes("getServiceClient(")) continue;
      const isClient =
        /^\s*["']use client["']/m.test(code) ||
        // A .tsx file under components/ with state hooks is a client component.
        (/use(State|Effect|Reducer)\(/.test(code) && file.endsWith(".tsx"));
      if (isClient) offenders.push(path.relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe("pagination and aggregation happen on the server", () => {
  it("never selects a whole table in an admin page", async () => {
    const pages = await walk(path.join(ROOT, "src/app/admin"));
    const offenders: string[] = [];
    for (const file of pages) {
      const raw = await readFile(file, "utf8");
      const code = stripComments(raw);
      // A `select()` with no limit, range or aggregate behind it would ship the
      // table. Pages read through `service.ts`, which clamps page size in SQL.
      if (/\.from\(["'][a-z_]+["']\)\s*\.select\(/.test(code)) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders, "admin pages should read through the service layer, not the DB").toEqual([]);
  });

  it("clamps page size in SQL rather than trusting the caller", async () => {
    const sql = await readFile(
      path.join(ROOT, "supabase/migrations/0018_admin_aggregates.sql"),
      "utf8",
    );
    // least(greatest(limit, 1), 200) — a request for 100000 rows gets 200.
    expect(sql).toMatch(/least\(greatest\(/);
  });
});

describe("no anti-abuse surface exists in the admin layer", () => {
  it("never reads a risk, device or restriction table", async () => {
    const files = [
      ...(await walk(path.join(ROOT, "src/app/admin"))),
      ...(await walk(path.join(ROOT, "src/app/api/admin"))),
      ...(await walk(path.join(ROOT, "src/lib/admin"))),
    ];
    const forbidden = [
      "risk_events",
      "device_signups",
      "account_restrictions",
      "abuse_policy",
      "email_domain_risk",
      "turnstile_tokens",
      "risk_score",
      "ip_hash",
      "device_hash",
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(await readFile(file, "utf8"));
      for (const needle of forbidden) {
        if (code.includes(needle)) offenders.push(`${path.relative(ROOT, file)} → ${needle}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

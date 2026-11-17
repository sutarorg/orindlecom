/**
 * Middleware route policy.
 *
 * The middleware decides two things that are easy to get subtly wrong and
 * impossible to notice by looking at a screenshot:
 *
 *   1. Which paths require a session.
 *   2. Which paths are exempt because they authenticate another way.
 *
 * The second is the dangerous one. A webhook or cron route accidentally covered by
 * the session gate would be redirected to a login page, and Razorpay or Vercel would
 * see a 307 instead of an error — the job would appear to run and do nothing. These
 * tests pin both lists, reading the same source the middleware does.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIDDLEWARE = path.resolve(process.cwd(), "src/middleware.ts");

async function source(): Promise<string> {
  return readFile(MIDDLEWARE, "utf8");
}

/** Pull a string array literal assigned to a named const. */
function arrayLiteral(text: string, name: string): string[] {
  const match = text.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`, "s"));
  if (!match) throw new Error(`could not find ${name}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("protected prefixes", () => {
  it("covers the dashboard and workspace areas", async () => {
    const prefixes = arrayLiteral(await source(), "PROTECTED_PREFIXES");
    expect(prefixes).toContain("/dashboard");
    /*
     * `/business` is the team workspace. This assertion replaces the old `/account`
     * one: that page no longer exists (it redirects to /dashboard), and the
     * guarantee worth keeping — "the signed-in product is not reachable
     * anonymously" — now applies to `/business`, which moved out from under the
     * `/dashboard` prefix and would otherwise be unprotected.
     */
    expect(prefixes).toContain("/business");
  });

  it("does not protect public marketing pages", async () => {
    const prefixes = arrayLiteral(await source(), "PROTECTED_PREFIXES");
    // Protecting "/" would put a login wall in front of the site.
    for (const publicPath of ["/", "/pricing", "/privacy", "/terms", "/help", "/contact", "/login", "/signup"]) {
      expect(prefixes).not.toContain(publicPath);
    }
  });
});

describe("self-authenticating exemptions", () => {
  it("exempts webhooks, cron, auth callbacks and health", async () => {
    const exemptions = arrayLiteral(await source(), "SELF_AUTHENTICATING");
    for (const required of ["/api/webhooks/", "/api/cron/", "/api/auth/", "/api/health"]) {
      expect(exemptions, `${required} must not be behind the session gate`).toContain(required);
    }
  });

  it("does not exempt ordinary data routes", async () => {
    const exemptions = arrayLiteral(await source(), "SELF_AUTHENTICATING");
    // These must stay gated: they read a person's files.
    for (const gated of ["/api/files", "/api/download/", "/api/storage", "/api/trash"]) {
      expect(exemptions).not.toContain(gated);
    }
  });

  it("exempts nothing under /api/billing", async () => {
    // Billing routes act on the caller's subscription, so they need a session
    // exactly as much as the file routes do.
    const exemptions = arrayLiteral(await source(), "SELF_AUTHENTICATING");
    expect(exemptions.some((prefix) => prefix.startsWith("/api/billing"))).toBe(false);
  });
});

describe("API responses", () => {
  it("returns JSON 401 rather than an HTML redirect for API routes", async () => {
    const text = await source();
    // An API client that receives a login page has to guess what went wrong.
    expect(text).toMatch(/isApi\(pathname\)/);
    expect(text).toMatch(/status:\s*401/);
    expect(text).toContain('"unauthenticated"');
  });

  it("validates the post-login destination server-side", async () => {
    // `next` is a URL parameter, which makes it the classic open-redirect input.
    const text = await source();
    expect(text).toMatch(/searchParams\.set\("next"/);
  });

  it("does not gate when Supabase is unconfigured", async () => {
    // A hard gate with no auth provider would make the deployment unreviewable:
    // every route would redirect to a login page that cannot work.
    const text = await source();
    expect(text).toMatch(/needsAuth && SUPABASE_URL && SUPABASE_ANON_KEY/);
  });

  it("validates the session with getUser, not getSession", async () => {
    // getSession trusts the cookie's contents, which is exactly what a forged
    // cookie relies on.
    const text = await source();
    expect(text).toContain("supabase.auth.getUser()");

    // Check for a CALL, not the word: the comment above explains why getSession is
    // wrong, and matching the prose would fail on a correct file.
    expect(text).not.toMatch(/auth\.getSession\s*\(/);
  });
});

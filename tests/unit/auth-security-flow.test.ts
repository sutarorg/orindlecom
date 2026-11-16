/**
 * Authentication flow invariants.
 *
 * These are static assertions about source files, and that is deliberate. The
 * properties below are about *what the code is allowed to say*, not about what it
 * computes, and they are exactly the kind that a well-meaning refactor breaks
 * without any test going red:
 *
 *   - a Set Password screen that can be skipped,
 *   - a CAPTCHA result treated as a pass when no challenge ran,
 *   - an OAuth callback that trusts `isNewUser`,
 *   - a 2FA panel that promises recovery codes that do not exist.
 *
 * Reading the source is a blunt instrument, but it catches the class of mistake
 * that matters here: a guarantee quietly removed from a branch.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function stripComments(source: string): string {
  // Prose in a comment often quotes the very thing being forbidden (see the
  // header of tests/unit/seo.test.ts, where this exact trap is documented).
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function read(relative: string): Promise<string> {
  return readFile(path.join(ROOT, relative), "utf8");
}

async function readStripped(relative: string): Promise<string> {
  return stripComments(await read(relative));
}

/* ── Google signup and Set Password ───────────────────────────────────────── */

describe("set-password onboarding", () => {
  it("is gated on a database flag, not on user metadata", async () => {
    const source = await readStripped("src/lib/security/account-security.ts");
    // The flag must come from the protected table.
    expect(source).toContain("account_security");
    expect(source).toContain("password_setup_required");
    // A user-writable store must never be the authority.
    expect(source).not.toMatch(/user_metadata[^)]*password_setup/i);
  });

  it("cannot be reached by a non-Google account to change its password", async () => {
    const source = await readStripped("src/app/auth/set-password/actions.ts");
    // The guard that makes an email/password account unable to use this route to
    // set a password without knowing the current one.
    expect(source).toContain('signupProvider !== "google"');
  });

  it("records completion only after the provider confirmed the update", async () => {
    const source = await readStripped("src/app/auth/set-password/actions.ts");
    // Anchor on the call sites, not the import statement: `indexOf("markPasswordSet")`
    // matches the import at the top of the file and would pass no matter what the
    // function body did.
    const updateCall = source.indexOf(".updatePassword(");
    const markCall = source.indexOf("await markPasswordSet(");
    expect(updateCall).toBeGreaterThan(-1);
    expect(markCall).toBeGreaterThan(updateCall);
  });

  it("keeps the requirement when the completion write fails", async () => {
    const source = await readStripped("src/app/auth/set-password/actions.ts");
    // A failed `markPasswordSet` must return an error, never a redirect onwards.
    expect(source).toMatch(/if \(!recorded\)/);
  });

  it("does not re-show the form once setup is complete at page level", async () => {
    const page = await readStripped("src/app/auth/set-password/page.tsx");
    expect(page).toMatch(/if \(!security\.passwordSetupRequired\)/);
    expect(page).toContain("redirect(next)");
  });

  it("gates the dashboard in middleware, not only in the page", async () => {
    const middleware = await readStripped("src/middleware.ts");
    // Per-page checks leave one page forgotten; middleware covers every route
    // including a bookmarked deep link.
    expect(middleware).toContain("needsPasswordSetup");
  });
});

describe("OAuth callback", () => {
  it("does not trust a client-supplied new-user flag", async () => {
    const source = await readStripped("src/app/auth/callback/route.ts");
    expect(source).not.toMatch(/isNewUser/);
    expect(source).not.toMatch(/searchParams\.get\(["']is_new/);
  });

  it("derives the provider claim from the verified user record", async () => {
    const source = await readStripped("src/app/auth/callback/route.ts");
    // `emailConfirmed` is populated from email_confirmed_at in the adapter, which
    // Supabase sets from the provider's assertion.
    expect(source).toContain("emailConfirmed");
    expect(source).not.toMatch(/body\.verified|body\[["']verified/);
  });

  it("sends an unfinished onboarding back to set-password even on a returning login", async () => {
    const source = await readStripped("src/app/auth/callback/route.ts");
    expect(source).toContain("/auth/set-password");
    expect(source).toMatch(/passwordSetupRequired/);
  });

  it("never caches a callback response", async () => {
    const source = await readStripped("src/app/auth/callback/route.ts");
    // The URL carries a one-time code; a cached response is a replayed session.
    expect(source).toContain("no-store");
  });
});

/* ── Two-factor authentication ────────────────────────────────────────────── */

describe("two-factor authentication", () => {
  it("is optional: nothing blocks signup on it", async () => {
    const signup = await readStripped("src/components/auth/signup-form.tsx");
    const actions = await readStripped("src/app/(auth)/actions.ts");
    // MFA must not appear in the registration path at all.
    expect(signup).not.toMatch(/mfa/i);
    expect(actions).not.toMatch(/mfaState\(\)[\s\S]{0,200}signUpAction/);
  });

  it("never mentions phone or SMS", async () => {
    const files = [
      "src/components/security/two-factor-panel.tsx",
      "src/app/auth/mfa/page.tsx",
      "src/app/api/account/mfa/route.ts",
      "src/lib/auth/supabase/service.ts",
    ];
    for (const file of files) {
      const source = await readStripped(file);
      expect(source, file).not.toMatch(/\bSMS\b/);
      expect(source, file).not.toMatch(/\bphone_number\b/);
    }
  });

  it("does not claim recovery codes exist", async () => {
    const route = await readStripped("src/app/api/account/mfa/route.ts");
    const panel = await readStripped("src/components/security/two-factor-panel.tsx");
    // The API returns `recoveryCodes: false`; the UI says a second device is the
    // backup instead. Neither may promise codes Supabase does not issue.
    expect(route).toContain("recoveryCodes: false");
    expect(panel).not.toMatch(/your recovery codes/i);
  });

  it("activates a factor only after a verified code", async () => {
    const route = await readStripped("src/app/api/account/mfa/route.ts");
    // `enabled` is read back from the provider's factor list, not assumed from a
    // successful verify call.
    expect(route).toContain("mfaState()");
    expect(route).toMatch(/factors\.some/);
  });

  it("requires reauthentication before removing a factor", async () => {
    const route = await readStripped("src/app/api/account/mfa/route.ts");
    expect(route).toContain("password");
    // And a password confirmation alone is not enough: it lowers the session to
    // AAL1, so removal completes only after a challenge.
    expect(route).toContain("aal2");
  });

  it("verifies the session actually reached aal2 before redirecting", async () => {
    const actions = await readStripped("src/app/auth/mfa/actions.ts");
    expect(actions).toContain('currentLevel !== "aal2"');
  });

  it("sends a user with no factor onward rather than trapping them", async () => {
    const page = await readStripped("src/app/auth/mfa/page.tsx");
    expect(page).toContain("redirect(next)");
    expect(page).toMatch(/factors\.length === 0/);
  });

  it("never stores the TOTP secret in the database", async () => {
    // The secret belongs to Supabase's factor record. Anything in this repo that
    // wrote it to a table would be a plaintext second factor at rest.
    const source = await readStripped("src/lib/auth/supabase/service.ts");
    expect(source).not.toMatch(/\.insert\([^)]*secret/i);
    expect(source).not.toMatch(/\.update\([^)]*secret/i);
  });
});

/* ── CAPTCHA ──────────────────────────────────────────────────────────────── */

describe("Turnstile", () => {
  it("distinguishes 'skipped' from 'passed'", async () => {
    const source = await readStripped("src/lib/security/turnstile.ts");
    // The type union is the guarantee: a caller cannot read `skipped` as success.
    expect(source).toContain('status: "skipped"');
    expect(source).toContain('status: "passed"');
    // And the gate must only treat passed-or-skipped-when-unconfigured as OK.
    const gate = await readStripped("src/lib/security/signup-gate.ts");
    expect(gate).toMatch(/outcome\.status === "failed"/);
  });

  it("posts to Cloudflare's Siteverify, not to a hand-rolled check", async () => {
    const source = await readStripped("src/lib/security/turnstile.ts");
    expect(source).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(source).toContain("secret");
  });

  it("refuses a replayed token", async () => {
    const source = await readStripped("src/lib/security/turnstile.ts");
    expect(source).toContain("duplicate");
    expect(source).toContain("turnstile_tokens");
  });

  it("fails closed when Cloudflare is unreachable", async () => {
    const source = await readStripped("src/lib/security/turnstile.ts");
    // Failing open would let an attacker disable CAPTCHA by cutting our egress.
    expect(source).toContain("verification_error");
    expect(source).not.toMatch(/catch[\s\S]{0,120}status: "passed"/);
  });

  it("never considers the widget's own callback sufficient", async () => {
    const widget = await readStripped("src/components/security/turnstile-widget.tsx");
    const gate = await readStripped("src/lib/security/signup-gate.ts");
    expect(widget).not.toMatch(/verified/i.test(widget) ? /await verify/ : /$^/);
    // The server verifies; the component only collects a token.
    expect(gate).toContain("verifyTurnstile");
  });
});

/* ── Registration gate ordering ───────────────────────────────────────────── */

describe("signup gate", () => {
  it("checks the domain before spending a challenge", async () => {
    const source = await readStripped("src/lib/security/signup-gate.ts");
    // Making someone solve a CAPTCHA and *then* telling them their address is a
    // temporary inbox is a waste of their time and of a token.
    const refuseIndex = source.indexOf('assessment.decision === "refuse"');
    const turnstileIndex = source.indexOf("verifyTurnstile(");
    expect(refuseIndex).toBeGreaterThan(-1);
    expect(turnstileIndex).toBeGreaterThan(refuseIndex);
  });

  it("rate-limits before touching the database", async () => {
    const source = await readStripped("src/lib/security/signup-gate.ts");
    const limitIndex = source.indexOf("consume(");
    const assessIndex = source.indexOf("assessSignup(");
    expect(limitIndex).toBeGreaterThan(-1);
    expect(assessIndex).toBeGreaterThan(limitIndex);
  });

  it("records a refused attempt against the device", async () => {
    const source = await readStripped("src/lib/security/risk.ts");
    // A refusal with no record is a free retry.
    expect(source).toContain("apply_signup_outcome");
  });
});

/* ── No administrator surface ─────────────────────────────────────────────── */

describe("no admin monitoring surface", () => {
  it("ships no admin route or dashboard", async () => {
    const appDir = path.join(ROOT, "src", "app");

    async function walk(dir: string): Promise<string[]> {
      const out: string[] = [];
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) out.push(...(await walk(path.join(dir, entry.name))));
        else out.push(path.join(dir, entry.name));
      }
      return out;
    }

    const files = await walk(appDir);
    const offenders = files.filter((file) => /\/(admin|abuse-dashboard|review-queue)\//.test(file));
    expect(offenders).toEqual([]);
  });

  it("has no approval or review table", async () => {
    const migrationsDir = path.join(ROOT, "supabase", "migrations");
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql"));
    const offenders: string[] = [];
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      // A table an operator edits to approve a signup is the design the
      // requirements forbid. Configuration is fine; a queue is not.
      if (/create table public\.(approval|review|pending_registration)/i.test(sql)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

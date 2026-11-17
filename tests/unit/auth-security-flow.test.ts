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
  /*
   * Narrowed, not deleted.
   *
   * This assertion used to forbid every path containing `/admin/`, because there
   * was no admin console. There is one now (see docs/admin/), so a blanket ban
   * would either fail or force the console somewhere worse. What the assertion was
   * actually protecting — the absence of an ANTI-ABUSE monitoring surface — is
   * preserved exactly, and `tests/unit/admin-security.test.ts` carries the
   * stronger replacement checks (no abuse table reachable from any admin route, no
   * device or IP hash anywhere in the console, no review queue).
   */
  it("ships no anti-abuse dashboard or review queue", async () => {
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
    const offenders = files.filter((file) =>
      /\/(abuse-dashboard|review-queue|admin\/abuse|admin\/risk|admin\/devices)\//.test(file),
    );
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

/* ── Email links and the onboarding redirect ──────────────────────────────── */

describe("email confirmation links", () => {
  it("verify through a token_hash route, not a PKCE code exchange", async () => {
    /*
     * A confirmation link is opened from an inbox, which is routinely a different
     * browser from the one that signed up. `exchangeCodeForSession` needs the PKCE
     * code-verifier cookie that browser never had, so the exchange failed with
     * `flow_state` — and that was mapped to "link_expired", telling people a
     * 24-hour link had expired seconds after it arrived.
     *
     * `verifyOtp({ token_hash })` needs no verifier cookie. The redirect targets
     * must point at the route that uses it.
     */
    const actions = await read("src/app/(auth)/actions.ts");
    expect(actions).not.toMatch(/auth\/callback\?next=/);
    expect(actions).toMatch(/auth\/verify\?next=/);

    const route = await read("src/app/auth/verify/route.ts");
    expect(route).toContain("verifyEmailLink");
    // The bare `token` from the stock ConfirmationURL is accepted too.
    expect(route).toContain("TOKEN_PARAM");
  });

  it("reports a code-exchange failure as session_missing, not as expiry", async () => {
    /*
     * The reported bug: a link issued minutes earlier said "expired or already
     * used". Two distinct causes produce a failed code exchange, and neither is a
     * 24-hour expiry — a missing verifier cookie (another device, an in-app
     * browser, a private window) and `flow_state_expired`, because GoTrue keeps
     * PKCE flow state for 300 seconds from signup.
     *
     * `link_expired` must therefore be reachable only from a token the auth server
     * genuinely rejected.
     */
    const errors = await readStripped("src/lib/auth/supabase/errors.ts");
    const flowBranch = errors.slice(errors.indexOf('raw.includes("flow_state")'));
    const flowReturn = flowBranch.slice(0, flowBranch.indexOf("}"));
    expect(flowReturn).toContain('"session_missing"');
    expect(flowReturn).not.toContain("link_expired");
  });

  it("only the verify route's expiry branch may say the link expired", async () => {
    const route = await readStripped("src/app/auth/verify/route.ts");
    /*
     * Exactly two call sites may say it, and both are cases where the auth server
     * itself rejected the token: the `error`/`error_description` early return, and
     * the `link_expired` arm. Every other arm carries its own diagnosis.
     */
    expect(route.match(/link_expired/g) ?? []).toHaveLength(3); // 2 calls + 1 case label
    expect(route).toContain("errorDescription");

    // A code-exchange failure has its own destination: signing in, because the
    // address is already confirmed.
    expect(route).toMatch(/case "session_missing":\s*return fail\("session_missing", "\/login"\)/);
    // And the catch-all is not allowed to fall back to the expiry wording again.
    expect(route).toMatch(/default:[\s\S]{0,200}return fail\("callback_failed", "\/verify-email"\)/);
  });

  it("does not repeat the 24-hour promise on the confirmation screen", async () => {
    /*
     * The email template that ships here uses `{{ .TokenHash }}`, so the token's
     * own lifetime is the only clock — but the app should not assert a number it
     * does not control, and under the stock `{{ .ConfirmationURL }}` template it
     * was plainly false: the flow state died after five minutes.
     */
    const page = await read("src/app/(auth)/verify-email/page.tsx");
    expect(page).not.toContain("expires after 24 hours");
  });

  it("tells a visitor whose code could not be exchanged that they are already confirmed", async () => {
    const page = await readStripped("src/app/(auth)/verify-email/page.tsx");
    // `session_missing` gets its own card; it must not be folded into the expiry one.
    expect(page).toContain("alreadyConfirmed");
    expect(page).toContain('params.error === "session_missing"');
    expect(page).toContain('params.error === "link_expired"');
  });

  it("ships email templates that use TokenHash rather than the PKCE ConfirmationURL", async () => {
    /*
     * This is the actual fix for the cross-device case. `{{ .ConfirmationURL }}`
     * routes through `/auth/v1/verify` and hands back a PKCE `code`, which cannot
     * be redeemed without the signup browser's verifier cookie. A `token_hash`
     * link goes straight to `/auth/verify` and is verified server-side.
     */
    const doc = await read("docs/deployment/email-templates.md");
    const body = doc.slice(doc.indexOf("## 1. Confirm signup"));

    expect(body).not.toContain("{{ .ConfirmationURL }}");
    expect(body).toContain("token_hash={{ .TokenHash }}");
    // Each template's type has to match the template it is pasted into.
    for (const type of ["signup", "invite", "email_change", "recovery"]) {
      expect(body).toContain(`type=${type}`);
    }
  });

  it("never reports a code-exchange failure as an expired token", async () => {
    // The two are different diagnoses and only one of them is worth asking the
    // person to request a new link for.
    // Comments are stripped first: the branch explains at length *why* it is not
    // `link_expired`, and matching the prose would make the test fail on its own
    // documentation.
    const errors = await readStripped("src/lib/auth/supabase/errors.ts");
    const flowStateBranch = errors.slice(errors.indexOf("flow_state"));
    const upToNextBranch = flowStateBranch.slice(0, flowStateBranch.indexOf("otp_expired"));

    expect(upToNextBranch).not.toContain("link_expired");
  });
});

describe("the set-password gate is reachable", () => {
  it("allows /auth as a redirect target", async () => {
    /*
     * Without this, `/login?next=%2Fauth%2Fset-password` silently dropped the
     * `next` and rendered the sign-in form for an already-signed-in visitor — the
     * exact "only showing the /login page UI" symptom. The allowlist is what makes
     * the onboarding gate reachable from a bookmark, an email or a resume.
     */
    const redirect = await read("src/lib/auth/redirect.ts");
    expect(redirect).toContain('"/auth"');

    // And it is still a closed list: an off-site value cannot pass.
    expect(redirect).toContain("parsed.origin !==");
  });

  it("sends an already-signed-in visitor onward from /login", async () => {
    const page = await read("src/app/(auth)/login/page.tsx");
    expect(page).toContain("getCurrentSession");
    expect(page).toMatch(/redirect\(next \?\? "\/dashboard"\)/);
  });
});

/* ── Account deletion ─────────────────────────────────────────────────────── */

describe("account deletion", () => {
  it("signs the user out everywhere, rather than only claiming to", async () => {
    const route = await read("src/app/api/users/me/delete/route.ts");
    // Revoking the refresh token is the only thing that actually ends a session.
    expect(route).toContain("admin.signOut");
    expect(route).toContain('"global"');
    expect(route).toContain("signOut({ scope: \"local\" })");
  });

  it("does not claim the account becomes read-only, because nothing enforces it", async () => {
    /*
     * The old copy and the old email both said the account "becomes read-only".
     * No layer enforced that — not middleware, not a policy — so the sentence was
     * simply false. A half-enforced read-only state would be worse than none,
     * because the screens that forget to enforce it are the ones that let a
     * departing account change data.
     */
    const settings = await read("src/components/dashboard/settings-view.tsx");
    const email = await read("src/lib/resend/client.ts");

    expect(settings).not.toContain("becomes read-only");
    expect(email).not.toContain("now read-only");
  });

  it("cancels the request when the customer signs in during the grace period", async () => {
    const actions = await read("src/app/(auth)/actions.ts");
    expect(actions).toContain("cancelPendingDeletion");
    expect(actions).toContain("cancel_account_deletion");
  });

  it("states the real purge date, which comes from the database", async () => {
    // A date computed in the application can drift from the one the job acts on.
    const route = await read("src/app/api/users/me/delete/route.ts");
    expect(route).toContain("request_account_deletion");
  });
});

/* ── Client-side rendering boundaries ─────────────────────────────────────── */

/* ── Request-scoped auth client ───────────────────────────────────────────── */

describe("auth service lifetime", () => {
  it("is request-scoped, so it never reuses another request's cookie jar", async () => {
    /*
     * The bug this pins: `getAuthService()` was a module-level singleton, and the
     * Supabase server client inside it awaits `cookies()` exactly once. So the
     * first request to touch it pinned its cookie jar for every request after.
     *
     * The symptom was a sign-in loop, not an error page: the sign-in action wrote
     * the session cookie correctly, middleware admitted `/dashboard`, and then the
     * dashboard layout's `getViewer()` read the *stale* jar, saw no user and
     * redirected to `/login?next=/dashboard`. That page read the stale jar too, so
     * it rendered a form instead of continuing on — the visitor was signed in and
     * unable to get in. A black render is the same fault with no session at all.
     *
     * `cache()` is the fix: per-request sharing, not per-process.
     */
    const service = await readStripped("src/lib/auth/service.ts");
    expect(service).toContain("cache(");
    // The singleton is what made this a process-wide cache.
    expect(service).not.toMatch(/^let cached/m);
    expect(service).not.toMatch(/cached \?\?=/);
  });

  it("documents why the client cannot outlive a request", async () => {
    const server = await readStripped("src/lib/auth/supabase/server.ts");
    // The client captures the awaited cookie store; that closure is the binding
    // that must not be shared across requests.
    expect(server).toContain("await cookies()");
    expect(server).toContain("createServerClient");
  });
});

describe("useSearchParams boundaries", () => {
  it("every component reading useSearchParams sits under a Suspense boundary", async () => {
    /*
     * `useSearchParams` opts its enclosing tree into client-side rendering. Next
     * requires a Suspense boundary above it in any statically prerenderable route;
     * without one the prerender is cancelled and the route throws at runtime,
     * unmounting the tree. The symptom is a blank page with a correct document
     * title, which is easy to mistake for a slow load or a CSS problem — and it is
     * exactly what happened when the deletion banner was added to the dashboard
     * shell without one.
     *
     * This asserts the pairing for the two call sites that render inside a page
     * tree. `admin/filter-bar` is rendered inside pages that are all dynamic, and
     * `business/create-organization-card` is already wrapped at its call site.
     */
    const shell = await read("src/components/dashboard/dashboard-shell.tsx");
    expect(shell).toContain("useSearchParams");

    // The boundary must wrap the component, not merely be imported.
    expect(shell).toMatch(/<Suspense[^>]*>\s*<DeletionCancelledNotice\s*\/>/);
  });

  it("the business card is wrapped at its call site", async () => {
    const page = await read("src/app/business/page.tsx");
    expect(page).toMatch(/<Suspense[^>]*>[\s\S]{0,120}<CreateOrganizationCard\s*\/>/);
  });
});

/* ── Email link shapes ────────────────────────────────────────────────────── */

describe("the verify route accepts every link shape Supabase emits", () => {
  it("handles token_hash, bare token and the PKCE code fallback", async () => {
    /*
     * A link built from `{{ .ConfirmationURL }}` reaches the auth server first,
     * which verifies the token and then redirects here with `?code=...` — it never
     * carries a token. Handling only `token_hash`/`token` meant those links fell
     * through to `callback_failed`, which is the error that was reported.
     */
    const route = await read("src/app/auth/verify/route.ts");
    expect(route).toContain('"token_hash"');
    expect(route).toContain('"token"');
    expect(route).toContain('"code"');
    expect(route).toContain("handleOAuthCallback");
  });
});

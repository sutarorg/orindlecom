/**
 * Shared plumbing for admin routes.
 *
 * Every admin route does the same four things in the same order:
 *
 *   1. authorize (`requirePlatformAdmin`) — before anything else
 *   2. rate limit (a bucket per route family)
 *   3. validate parameters
 *   4. run the query and shape the response
 *
 * Doing it in a helper rather than in each route is what makes "every admin route
 * is authorized" a property of the codebase rather than a checklist someone
 * remembers. `tests/unit/admin-security.test.ts` asserts the call is present in
 * every file under `src/app/api/admin/`, so a new route that forgets it fails CI
 * instead of shipping.
 */

import "server-only";

import { NextResponse } from "next/server";
import { AppError } from "@/domain/auth/errors";
import { fail } from "@/lib/api";
import { requirePlatformAdmin, type AdminContext, type PlatformPermission } from "./auth";
import { enforceRateLimit } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";

/**
 * Admin responses are private and must never be cached by a CDN or a browser.
 *
 * Registered as a constant so a route cannot add its own `Cache-Control` that
 * contradicts this one.
 */
export const ADMIN_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function adminOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(
    { ok: true as const, data },
    { ...init, headers: { ...ADMIN_HEADERS, ...(init?.headers ?? {}) } },
  );
}

/**
 * Wrap an admin handler.
 *
 * `permission` is checked inside `requirePlatformAdmin`, so a route that needs
 * owner rights cannot be reached by an ordinary admin even if the UI hides the
 * button. Hiding a control is not authorization.
 */
export async function adminRoute(
  fn: (ctx: AdminContext) => Promise<Response>,
  options: {
    permission?: PlatformPermission;
    /** Which rate-limit bucket applies. Everything admin-related is expensive. */
    limit?: keyof typeof LIMITS;
  } = {},
): Promise<Response> {
  try {
    const ctx = await requirePlatformAdmin(options.permission);

    // Rate limit keyed on the operator, not the IP: an operator on a shared
    // office connection should not be limited by a colleague's usage, and an
    // operator cannot escape their own bucket by changing networks.
    if (options.limit) {
      const limited = await enforceRateLimit(`admin:${ctx.admin.userId}`, LIMITS[options.limit]);
      if (limited) return limited;
    }

    const response = await fn(ctx);
    // Belt and braces: a route that built its own Response still gets the
    // no-store headers.
    for (const [key, value] of Object.entries(ADMIN_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    if (error instanceof AppError) {
      return withAdminHeaders(fail(error.code, error.message, error.fields));
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[admin] unhandled", { message });
    return withAdminHeaders(fail("unknown", "Something went wrong loading that."));
  }
}

function withAdminHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(ADMIN_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/** Parse the query string once, in one place. */
export function queryOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

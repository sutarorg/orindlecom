/**
 * POST /api/session/last-workspace — remember where the customer is.
 *
 * Called by the app shell on every in-app navigation. The value is re-validated
 * server-side: `sanitizeWorkspacePath` accepts only `/dashboard` and `/business`
 * prefixes, so a request from a modified client cannot store an arbitrary string for
 * a later sign-in to redirect to.
 *
 * Deliberately unauthenticated-looking but not unguarded: `withActor()` runs first, an
 * anonymous caller gets 401, and RLS scopes the write to the caller's own profile row.
 *
 * Not rate-limited. It is a single-row idempotent update fired once per page view, and
 * a limiter here would drop legitimate beacons from someone clicking quickly through
 * folders — the exact behaviour it is meant to record.
 */

import "server-only";

import { handle, ok, readJson, withActor } from "@/lib/api";
import { rememberWorkspace, sanitizeWorkspacePath } from "@/lib/navigation/last-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handle(async () => {
    const auth = await withActor();
    if (!auth.ok) return auth.response;

    const body = await readJson(request).catch(() => ({ path: undefined }));
    const path = sanitizeWorkspacePath(body.path);

    // An unacceptable path is not an error worth surfacing: the client is the one
    // thing that would read it, and it already knows what it sent. No-op and 200.
    if (path) await rememberWorkspace(path);

    return ok({ remembered: Boolean(path) });
  });
}

/**
 * Cron authentication.
 *
 * Every scheduled route requires `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Two details that matter:
 *   - The comparison is constant-time. A string comparison leaks timing, and a
 *     shared secret is exactly the thing worth timing.
 *   - A missing or wrong secret returns 404, not 401. A 401 advertises that the
 *     endpoint exists and is worth attacking; 404 says there is nothing here.
 */

import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function authoriseCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return notFound();

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!provided || !constantTimeEqual(provided, secret)) return notFound();
  return null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which would itself be a signal.
  if (bufA.length !== bufB.length) {
    // Compare against itself so the work is similar either way.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function notFound() {
  return NextResponse.json(
    { ok: false, code: "not_found", message: "Not found." },
    { status: 404 },
  );
}

/**
 * HTTP boundary helpers.
 *
 * Route handlers do three things and nothing else: resolve identity, validate
 * input, and shape a response. This module is the shaping.
 *
 * Why a wrapper rather than try/catch in each route: the error envelope has to be
 * identical everywhere or the client needs a special case per endpoint. One
 * function that cannot drift is worth more than forty correct try/catch blocks
 * and one incorrect one.
 */

import "server-only";

import { NextResponse } from "next/server";
import { AppError, type AppErrorCode, USER_MESSAGES } from "@/domain/auth/errors";
import type { Actor } from "@/domain/auth/actor";
import { resolveActor } from "@/domain/auth/actor";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; code: AppErrorCode; message: string };

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(
  code: AppErrorCode,
  message: string,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { ok: false as const, code, message, ...(fields ? { fields } : {}) },
    { status: new AppError(code, message).status },
  );
}

/**
 * Wraps a handler so any thrown error becomes the correct envelope.
 *
 * Unknown errors are logged with their real message and returned as a generic
 * one: an internal error message can name tables, columns or filesystem paths,
 * and none of that belongs in a response.
 */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) return error.toJSON() as unknown as NextResponse;

    const message = error instanceof Error ? error.message : String(error);
    console.error("[api] unhandled", { message });

    return fail("unknown", USER_MESSAGES.unknown);
  }
}

/**
 * Resolve the actor for a route, or return the response to send.
 *
 * Returning a union rather than throwing keeps the failure path visible at the
 * call site: a handler that forgets to check is a type error, not a runtime
 * surprise.
 */
export async function withActor(): Promise<
  { ok: true; actor: Actor } | { ok: false; response: NextResponse }
> {
  const result = await resolveActor();
  if (!result.ok) {
    return { ok: false, response: fail(result.code, result.message) };
  }
  return { ok: true, actor: result.actor };
}

/** Parse a JSON body, rejecting anything that is not an object. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("validation_failed", "That request wasn't valid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("validation_failed", "That request wasn't valid.");
  }
  return body as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/*                                                                     */
/*  Hand-written rather than a schema library. The rule set is small,  */
/*  the messages have to be written for a person, and a dependency that */
/*  ships its own error strings would have to be overridden everywhere */
/*  anyway. Server-side validation only: the client's checks are a     */
/*  courtesy, and these are the ones that count.                       */
/* ------------------------------------------------------------------ */

export function requireString(
  input: Record<string, unknown>,
  key: string,
  { max = 255, min = 1 }: { max?: number; min?: number } = {},
): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw new AppError("validation_failed", `Missing ${key}.`, { [key]: "Required" });
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new AppError("validation_failed", `Missing ${key}.`, { [key]: "Required" });
  }
  if (trimmed.length > max) {
    throw new AppError("validation_failed", `That ${key} is too long.`, {
      [key]: `Keep it under ${max} characters.`,
    });
  }
  return trimmed;
}

export function optionalString(
  input: Record<string, unknown>,
  key: string,
  max = 255,
): string | null {
  const value = input[key];
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new AppError("validation_failed", `${key} must be text.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw new AppError("validation_failed", `That ${key} is too long.`);
  }
  return trimmed;
}

/**
 * A file or folder name.
 *
 * The constraints exist because the name is displayed, searched and echoed back:
 * path separators would suggest a hierarchy that does not exist, control
 * characters break layout, and the Windows device names break downloads on the
 * most common desktop platform.
 */
const RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

export function validateItemName(raw: string): string {
  const name = raw.trim();

  if (!name) throw new AppError("invalid_name", USER_MESSAGES.invalidName);
  if (name === "." || name === "..") throw new AppError("invalid_name", USER_MESSAGES.invalidName);
  if (name.startsWith(".")) {
    throw new AppError("invalid_name", "A name can't start with a dot.");
  }
  if (name.length > 255) {
    throw new AppError("invalid_name", "That name is too long — keep it under 255 characters.");
  }
  // eslint-disable-next-line no-control-regex
  if (/[/\\\u0000-\u001f\u007f]/.test(name)) {
    throw new AppError("invalid_name", USER_MESSAGES.invalidName);
  }
  const stem = name.split(".")[0]?.toLowerCase() ?? "";
  if (RESERVED_NAMES.has(stem)) {
    throw new AppError("invalid_name", "That name is reserved by Windows. Try another.");
  }

  return name;
}

export function requireUuid(input: Record<string, unknown>, key: string): string;
export function requireUuid(input: Record<string, unknown>, key: string, optional: true): string | null;
export function requireUuid(
  input: Record<string, unknown>,
  key: string,
  optional = false,
): string | null {
  const value = input[key];
  if (value == null || value === "") {
    if (optional) return null;
    throw new AppError("validation_failed", `Missing ${key}.`);
  }
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError("validation_failed", `That ${key} isn't valid.`);
  }
  return value;
}

export function requireStringArray(
  input: Record<string, unknown>,
  key: string,
  max = 500,
): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError("validation_failed", `Select something first.`);
  }
  if (value.length > max) {
    throw new AppError("validation_failed", `Too many items at once — the limit is ${max}.`);
  }
  for (const entry of value) {
    if (typeof entry !== "string" || !/^[0-9a-f-]{36}$/i.test(entry)) {
      throw new AppError("validation_failed", "One of those ids isn't valid.");
    }
  }
  return value as string[];
}

export function requireNumber(
  input: Record<string, unknown>,
  key: string,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError("validation_failed", `Missing ${key}.`);
  }
  if (value < min || value > max) {
    throw new AppError("validation_failed", `That ${key} is out of range.`);
  }
  return value;
}

/**
 * Enforce a rate limit, or return null to continue.
 *
 * Returns a ready-made 429 response rather than throwing, so a route can pass the
 * result straight back. The Retry-After header is seconds until the window rolls
 * over, which is what a well-behaved client needs to back off correctly.
 */
export async function enforceRateLimit(
  bucket: string,
  policy: { limit: number; windowSeconds: number },
): Promise<NextResponse<ApiFailure> | null> {
  const { consume } = await import("@/lib/rate-limit");
  const result = await consume(bucket, policy);
  if (result.allowed) return null;

  const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));

  return NextResponse.json<ApiFailure>(
    {
      ok: false,
      code: "rate_limited",
      message: "That's a lot of requests in a short time. Please wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

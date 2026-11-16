/**
 * The actor — the single way identity enters the system.
 *
 * The hard requirement is that a client-supplied user id is never trusted. This
 * module is what makes that true: it reads the *verified session*, validates it
 * server-side, and hands the rest of the application an `Actor`.
 *
 * Consequences, which the domain layer relies on:
 *   - No service method accepts a `userId` that a caller could have read from a
 *     request body. Where a target user has to be named (removing a member,
 *     changing a role), it is a *subject* under the actor's authority, not the
 *     actor themselves.
 *   - Nothing under src/domain imports `next/headers` or a request object, so the
 *     domain layer cannot even see a request. A test enforces this.
 */

import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { isAuthConfigured } from "@/lib/auth/supabase/server";

export interface Actor {
  /** From the verified session. Never from a request body. */
  userId: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
}

export type ActorFailureCode = "unauthenticated" | "email_unverified" | "not_configured";

export interface ActorFailure {
  ok: false;
  code: ActorFailureCode;
  message: string;
}

export type ActorResult = { ok: true; actor: Actor } | ActorFailure;

const MESSAGES: Record<ActorFailureCode, string> = {
  unauthenticated: "You need to sign in to do that.",
  email_unverified: "Confirm your email address first — we sent you a link.",
  not_configured: "Accounts aren't connected on this deployment yet.",
};

function failure(code: ActorFailureCode): ActorFailure {
  return { ok: false, code, message: MESSAGES[code] };
}

/**
 * Resolve the acting user.
 *
 * `getUser()` (not `getSession()`) is used deliberately: it validates the token
 * with the auth server rather than trusting the cookie's contents. A forged or
 * stale cookie is rejected here instead of being trusted downstream.
 *
 * Wrapped in React `cache` so several server components in one request share a
 * single resolution rather than calling the auth server repeatedly.
 */
export const resolveActor = cache(async (): Promise<ActorResult> => {
  if (!isAuthConfigured()) return failure("not_configured");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return failure("unauthenticated");

  const user = data.user;
  if (!user.email) return failure("unauthenticated");

  // Unverified accounts may exist (they must, to be verifiable) but they may not
  // act. Returning a distinct code lets the UI say "confirm your email" rather
  // than "sign in", which is the difference between a fixable problem and a
  // confusing one.
  const verified = Boolean(user.email_confirmed_at ?? user.confirmed_at);
  if (!verified) return failure("email_unverified");

  return {
    ok: true,
    actor: {
      userId: user.id,
      email: user.email,
      emailVerified: true,
      fullName: (user.user_metadata?.full_name as string | undefined)?.trim() || null,
    },
  };
});

/** Resolve, or throw. Only for callers that genuinely cannot continue. */
export async function requireActor(): Promise<Actor> {
  const result = await resolveActor();
  if (!result.ok) {
    const error = new Error(result.message);
    error.name = `ActorError:${result.code}`;
    throw error;
  }
  return result.actor;
}

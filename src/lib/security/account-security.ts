/**
 * Protected account onboarding state.
 *
 * `password_setup_required` decides whether a Google-created account is sent to
 * `/auth/set-password` before it can reach the dashboard. It lives in a database
 * column with no client write policy, and not in `auth.users.user_metadata`,
 * precisely because user metadata is user-writable: a flag the client can flip
 * would turn a mandatory onboarding step into an optional one.
 *
 * Reads go through the user's own client — the RLS policy in 0015 permits a user
 * to read their own row. Writes go through the service role, because that is the
 * only role that may write at all.
 */

import "server-only";

import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";

export interface AccountSecurity {
  signupProvider: "email" | "google";
  passwordSetupRequired: boolean;
  passwordSetupAt: string | null;
  providerEmailVerified: boolean;
}

const DEFAULT_SECURITY: AccountSecurity = {
  signupProvider: "email",
  passwordSetupRequired: false,
  passwordSetupAt: null,
  providerEmailVerified: false,
};

/**
 * Read the caller's own onboarding state.
 *
 * Returns the "nothing required" default when the row is absent or unreadable,
 * which is the safe direction: the Set Password screen is an inconvenience, but
 * trapping someone in it forever would be a lockout, so a read failure must not
 * be able to cause one.
 */
export async function readOwnSecurity(): Promise<AccountSecurity> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return DEFAULT_SECURITY;

    const { data } = await supabase
      .from("account_security")
      .select("signup_provider, password_setup_required, password_setup_at, provider_email_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return DEFAULT_SECURITY;

    return {
      signupProvider: data.signup_provider === "google" ? "google" : "email",
      passwordSetupRequired: Boolean(data.password_setup_required),
      passwordSetupAt: data.password_setup_at ?? null,
      providerEmailVerified: Boolean(data.provider_email_verified),
    };
  } catch {
    return DEFAULT_SECURITY;
  }
}

/** Privileged read, for the OAuth callback where the row must be authoritative. */
export async function readSecurityFor(userId: string): Promise<AccountSecurity | null> {
  if (!isServiceConfigured()) return null;
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("account_security")
      .select("signup_provider, password_setup_required, password_setup_at, provider_email_verified")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return null;

    return {
      signupProvider: data.signup_provider === "google" ? "google" : "email",
      passwordSetupRequired: Boolean(data.password_setup_required),
      passwordSetupAt: data.password_setup_at ?? null,
      providerEmailVerified: Boolean(data.provider_email_verified),
    };
  } catch {
    return null;
  }
}

/**
 * Mark password setup complete.
 *
 * Scoped to the calling user and written by the service role only after Supabase
 * confirmed the password update. Returns whether the row actually changed, so the
 * caller can avoid reporting success on a no-op.
 */
export async function markPasswordSet(userId: string): Promise<boolean> {
  if (!isServiceConfigured()) return false;
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("account_security")
      .update({
        password_setup_required: false,
        password_setup_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (error || !data) {
      console.error("[security] markPasswordSet failed", { message: error?.message });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a row exists for a user this deployment created some other way.
 *
 * The database trigger covers every new auth user, so this is only for accounts
 * that predate the trigger (an existing deployment upgrading in place). It is
 * idempotent and never overwrites an existing row, because overwriting is how a
 * completed onboarding would be silently re-armed.
 */
export async function ensureSecurityRow(input: {
  userId: string;
  provider: "email" | "google";
  emailVerified: boolean;
}): Promise<void> {
  if (!isServiceConfigured()) return;
  try {
    const supabase = getServiceClient();
    await supabase.from("account_security").upsert(
      {
        user_id: input.userId,
        signup_provider: input.provider,
        provider_email_verified: input.emailVerified,
        // Only a Google account needs a password to be set; see 0014's trigger.
        password_setup_required: input.provider === "google",
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  } catch {
    // Best effort: the trigger is the primary path.
  }
}

/**
 * Whether the account was created in the last few seconds.
 *
 * Used by the OAuth callback as a corroborating signal for "first sign-in". It is
 * never the sole authority — `password_setup_required` from the database is —
 * because a client-supplied `isNewUser` flag is exactly the thing the
 * requirements forbid trusting.
 */
export function createdJustNow(createdAt: string | null | undefined, withinSeconds = 120): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= withinSeconds * 1000;
}

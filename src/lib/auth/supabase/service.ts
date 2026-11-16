/**
 * Supabase implementation of `AuthService`.
 *
 * Rules this file holds itself to:
 *   1. Never claim success the provider didn't confirm. Every success path
 *      below is downstream of a resolved provider call with no error.
 *   2. Never throw to the caller. Providers throw on network failure, and an
 *      unhandled rejection in a server action would surface as a Next error
 *      page rather than a sentence the visitor can act on.
 *   3. Never widen the returned user beyond `AuthUser`. Provider records carry
 *      metadata the frontend has no business knowing.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ENABLED_PROVIDERS, createSupabaseServerClient, isAuthConfigured } from "./server";
import { failure, mapProviderError } from "./errors";
import type {
  AuthResult,
  AuthService,
  AuthSession,
  AuthUser,
  OAuthCallbackInput,
  OAuthCallbackOutcome,
  OAuthProvider,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  UpdatePasswordInput,
} from "../types";

function toAuthUser(user: User): AuthUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    typeof meta.full_name === "string"
      ? meta.full_name
      : typeof meta.name === "string"
        ? meta.name
        : null;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName,
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
}

function toSession(user: User, expiresAt: number | null): AuthSession {
  return { user: toAuthUser(user), expiresAt };
}

/**
 * A service bound to one request's cookie jar.
 *
 * The client is lazy so that merely importing this module (e.g. in a page that
 * renders the "not configured" notice) never touches the network.
 */
export function createSupabaseAuthService(): AuthService {
  let clientPromise: Promise<SupabaseClient> | null = null;
  const client = () => (clientPromise ??= createSupabaseServerClient());

  const configured = isAuthConfigured();

  return {
    configured,
    providers: ENABLED_PROVIDERS,

    async signUp(input: SignUpInput) {
      if (!configured) {
        return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      }
      try {
        const supabase = await client();
        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            emailRedirectTo: input.emailRedirectTo,
            data: { full_name: input.fullName },
          },
        });

        if (error) return mapProviderError(error);
        if (!data.user) {
          return failure("unknown", "The provider didn't return an account. Please try again.");
        }

        // Supabase deliberately returns a fake user with no identities when the
        // address is already registered, to avoid leaking account existence.
        // An empty identities array is how that is exposed to us.
        const isExisting = Array.isArray(data.user.identities) && data.user.identities.length === 0;
        if (isExisting) {
          return failure(
            "user_already_exists",
            "An account already exists for that email address. Try signing in instead.",
            { fieldErrors: { email: "This email is already registered." } },
          );
        }

        return {
          ok: true,
          data: {
            user: toAuthUser(data.user),
            needsVerification: !data.session,
          },
        };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async signIn(input: SignInInput) {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      try {
        const supabase = await client();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error) return mapProviderError(error);
        if (!data.session || !data.user) {
          return failure("unknown", "Sign-in didn't complete. Please try again.");
        }

        // `remember: false` shortens the cookie to a browser-session cookie.
        // Supabase writes the auth cookies itself; this flag is information for
        // the cookie layer we control (see `auth-cookie.ts`).
        if (!input.remember) {
          await markSessionOnly();
        }

        return {
          ok: true,
          data: toSession(data.user, data.session.expires_at ?? null),
        };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async signOut() {
      if (!configured) return { ok: true, data: null };
      try {
        const supabase = await client();
        const { error } = await supabase.auth.signOut();
        if (error && error.status !== 403) return mapProviderError(error);
        return { ok: true, data: null };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async resetPassword(input: ResetPasswordInput) {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      try {
        const supabase = await client();
        const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
          redirectTo: input.redirectTo,
        });
        // Rate limiting is the one failure worth surfacing: everything else
        // would leak whether the address exists.
        if (error) {
          const mapped = mapProviderError(error);
          if (mapped.code === "rate_limited" || mapped.code === "network") return mapped;
        }
        return { ok: true, data: null };
      } catch (error) {
        const mapped = mapProviderError({ message: String(error) });
        if (mapped.code === "network") return mapped;
        return { ok: true, data: null };
      }
    },

    async updatePassword(input: UpdatePasswordInput) {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      try {
        const supabase = await client();
        const { error } = await supabase.auth.updateUser({ password: input.password });
        if (error) return mapProviderError(error);
        if (input.remember === false) await markSessionOnly();
        return { ok: true, data: null };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async resendVerification(input: { email: string; emailRedirectTo: string }) {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      try {
        const supabase = await client();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: input.email,
          options: { emailRedirectTo: input.emailRedirectTo },
        });
        if (error) return mapProviderError(error);
        return { ok: true, data: null };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async handleOAuthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackOutcome> {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);

      if (input.error) {
        const denied = input.error === "access_denied";
        return failure(
          denied ? "oauth_denied" : "unknown",
          denied
            ? "Sign-in was cancelled. Nothing changed on your account."
            : "That sign-in link didn't work. Please start again.",
        );
      }

      try {
        const supabase = await client();

        // Email confirmation links carry `token_hash` + `type`; OAuth and magic
        // links carry a PKCE `code`. Both end with the session in the cookie jar.
        if (input.tokenHash && input.tokenType) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: input.tokenHash,
            type: input.tokenType as "signup" | "recovery" | "invite" | "magiclink" | "email_change",
          });
          if (error) return mapProviderError(error);
          if (!data.user || !data.session) {
            return failure("session_missing", "That link didn't create a session. Request a new one.");
          }
          return {
            ok: true,
            session: toSession(data.user, data.session.expires_at ?? null),
            confirmation: input.tokenType !== "recovery",
          };
        }

        if (input.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(input.code);
          if (error) return mapProviderError(error);
          if (!data.user || !data.session) {
            return failure("session_missing", "That link didn't create a session. Request a new one.");
          }
          return {
            ok: true,
            session: toSession(data.user, data.session.expires_at ?? null),
            confirmation: false,
          };
        }

        return failure("session_missing", "That link is missing its verification code.");
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },

    async getCurrentSession() {
      if (!configured) return null;
      try {
        const supabase = await client();
        // getUser() revalidates against the auth server; getSession() trusts the
        // cookie and is not safe for anything that gates access.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return null;
        const { data: sessionData } = await supabase.auth.getSession();
        return toSession(data.user, sessionData.session?.expires_at ?? null);
      } catch {
        return null;
      }
    },

    async startOAuth(provider: OAuthProvider, options: { redirectTo: string; next?: string }) {
      if (!configured) return failure("not_configured", NOT_CONFIGURED_MESSAGE);
      if (!ENABLED_PROVIDERS.includes(provider)) {
        return failure("provider_disabled", `${provider} sign-in isn't enabled for this deployment.`);
      }
      try {
        const supabase = await client();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: options.redirectTo, skipBrowserRedirect: true },
        });
        if (error) return mapProviderError(error);
        if (!data.url) return failure("unknown", "The provider didn't return a sign-in URL.");
        return { ok: true, data: { url: data.url } };
      } catch (error) {
        return mapProviderError({ message: String(error) });
      }
    },
  };
}

async function markSessionOnly() {
  // Imported lazily: `auth-cookie` is a server module and this keeps the
  // dependency one-directional.
  const { shortenAuthCookiesToSession } = await import("./auth-cookie");
  await shortenAuthCookiesToSession();
}

export const NOT_CONFIGURED_MESSAGE =
  "Accounts aren't connected on this deployment yet. Nothing was sent and no account was created — write to us and we'll let you know the moment sign-in opens.";

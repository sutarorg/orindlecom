/**
 * Authentication contract types.
 *
 * These are deliberately provider-shaped but not provider-bound: they describe
 * what every auth backend must be able to answer, in the vocabulary the UI
 * speaks. The Supabase adapter in `./supabase` is one implementation; the
 * unconfigured adapter is another. Nothing in `src/components/auth` imports a
 * provider SDK directly.
 */

/** The fields any auth form may report an error against. */
export type AuthField =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword"
  | "terms"
  | "token";

/**
 * Stable, translatable error codes.
 *
 * Components switch on these, never on provider message strings — provider
 * copy changes without notice and leaks implementation detail to the visitor.
 */
export type AuthErrorCode =
  | "not_configured"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_already_exists"
  | "weak_password"
  | "same_password"
  | "rate_limited"
  | "link_expired"
  | "session_missing"
  | "oauth_denied"
  | "provider_disabled"
  | "network"
  | "invalid_input"
  | "unknown";

/** A failure carries a code for logic and a message for humans. */
export interface AuthFailure {
  ok: false;
  code: AuthErrorCode;
  /** Safe to render as-is. Never contains provider internals. */
  message: string;
  /** Per-field messages, keyed by form field. */
  fieldErrors?: Partial<Record<AuthField, string>>;
  /** Present on rate limiting; the UI counts this down. */
  retryAfterSeconds?: number;
}

export type AuthResult<T> = { ok: true; data: T } | AuthFailure;

/** The subset of a user record the frontend is allowed to see. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  emailConfirmed: boolean;
  avatarUrl: string | null;
}

export interface AuthSession {
  user: AuthUser;
  /** Unix seconds. Null when the provider issues no fixed expiry. */
  expiresAt: number | null;
}

/** What a caller must supply. Every mutation returns a result, never throws. */
export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  /** Absolute URL the provider should return the visitor to. */
  emailRedirectTo: string;
}

export interface SignInInput {
  email: string;
  password: string;
  /** When false the session cookie is a browser-session cookie. */
  remember: boolean;
}

export interface ResetPasswordInput {
  email: string;
  redirectTo: string;
}

export interface UpdatePasswordInput {
  password: string;
  /** When false the session cookie is a browser-session cookie. */
  remember?: boolean;
}

export interface OAuthCallbackInput {
  /** PKCE authorization code. */
  code?: string | null;
  /** Email-confirmation token hash (`type=signup|recovery|email_change`). */
  tokenHash?: string | null;
  tokenType?: string | null;
  /** Provider-reported failure, e.g. `access_denied` when the visitor cancels. */
  error?: string | null;
}

/** Outcome of `/auth/callback`; the route handler turns this into a redirect. */
export type OAuthCallbackOutcome =
  | {
      ok: true;
      session: AuthSession;
      /** True when this was an email confirmation rather than a fresh sign-in. */
      confirmation: boolean;
    }
  | AuthFailure;

/**
 * The service contract. Every method resolves to a result object — a thrown
 * error would be an unhandled rejection in a server action, and "did it work"
 * must always be an explicit, inspectable value.
 */
export interface AuthService {
  /** True when the deployment has credentials and calls can succeed. */
  readonly configured: boolean;
  /** OAuth providers this deployment has actually enabled. */
  readonly providers: ReadonlyArray<OAuthProvider>;

  signUp(input: SignUpInput): Promise<AuthResult<{ user: AuthUser; needsVerification: boolean }>>;
  signIn(input: SignInInput): Promise<AuthResult<AuthSession>>;
  signOut(): Promise<AuthResult<null>>;
  resetPassword(input: ResetPasswordInput): Promise<AuthResult<null>>;
  updatePassword(input: UpdatePasswordInput): Promise<AuthResult<null>>;
  resendVerification(input: { email: string; emailRedirectTo: string }): Promise<AuthResult<null>>;
  handleOAuthCallback(input: OAuthCallbackInput): Promise<OAuthCallbackOutcome>;
  getCurrentSession(): Promise<AuthSession | null>;
  /** Returns the provider consent URL, or a failure if OAuth isn't enabled. */
  startOAuth(
    provider: OAuthProvider,
    options: { redirectTo: string; next?: string },
  ): Promise<AuthResult<{ url: string }>>;
}

export type OAuthProvider = "google";

/** Human labels, kept in one place so every screen agrees. */
export const OAUTH_PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: "Google",
};

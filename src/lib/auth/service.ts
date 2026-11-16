/**
 * The single entry point UI code calls.
 *
 * Everything above this line is provider-agnostic; everything below is the
 * Supabase adapter. Swapping providers later means replacing one factory, not
 * touching a single component.
 */

import "server-only";

import { createSupabaseAuthService } from "./supabase/service";
import type { AuthService } from "./types";

let cached: AuthService | null = null;

/**
 * Returns the configured auth service. When the deployment has no credentials
 * the returned service still answers every call — with an explicit
 * `not_configured` failure rather than a thrown error, so screens can render
 * their real form and explain the situation on submit.
 */
export function getAuthService(): AuthService {
  cached ??= createSupabaseAuthService();
  return cached;
}

export function isAuthConfigured() {
  return getAuthService().configured;
}

export function enabledOAuthProviders() {
  return getAuthService().providers;
}

/**
 * The single entry point UI code calls.
 *
 * Everything above this line is provider-agnostic; everything below is the
 * Supabase adapter. Swapping providers later means replacing one factory, not
 * touching a single component.
 *
 * ── Why the service is request-scoped, not module-scoped ────────────────────
 * This used to be a module-level singleton and it silently broke sign-in.
 *
 * A Supabase server client is *bound to one request's cookie jar*:
 * `createSupabaseServerClient()` awaits `cookies()` once and every later read and
 * write goes through that captured store. On a long-lived server that is a
 * cross-request bug — the first request to touch the singleton pinned its cookies
 * for every request that followed. The visible symptom was a redirect loop:
 *
 *   1. POST the sign-in action. It succeeds, and the session cookie is written to
 *      that response by the Supabase client's `setAll`.
 *   2. The action redirects to `/dashboard`.
 *   3. Middleware reads the new cookie and admits the request — but the dashboard
 *      layout's `getViewer()` read the *stale* jar, saw no user, and sent the
 *      visitor to `/login?next=/dashboard`.
 *   4. That page read the stale jar too, so it also saw no session and rendered
 *      the form instead of redirecting on to the dashboard.
 *
 * `cache()` is the right lifetime: per request. React keys it to the request it is
 * rendering, so every call in one render tree shares a single client (which is
 * what keeps the work cheap) while the next request gets a fresh one bound to its
 * own cookies. It is the same mechanism `getViewer` uses.
 */

import "server-only";

import { cache } from "react";

import { createSupabaseAuthService } from "./supabase/service";
import type { AuthService } from "./types";

/**
 * Returns the configured auth service for the *current request*.
 *
 * When the deployment has no credentials the returned service still answers every
 * call — with an explicit `not_configured` failure rather than a thrown error, so
 * screens can render their real form and explain the situation on submit.
 */
export const getAuthService = cache((): AuthService => createSupabaseAuthService());

export function isAuthConfigured() {
  return getAuthService().configured;
}

export function enabledOAuthProviders() {
  return getAuthService().providers;
}

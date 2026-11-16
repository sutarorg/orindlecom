/**
 * Supabase server client.
 *
 * Only ever imported from server files (route handlers, server actions, server
 * components). The publishable/anon key may be public, but it lives in the
 * environment and is never inlined into a client bundle here — and the secret
 * key, which bypasses row-level security, must never appear in this repository
 * at all.
 */

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * OAuth providers are only advertised when the deployment has actually enabled
 * them. Setting `NEXT_PUBLIC_AUTH_PROVIDERS=google` is an explicit statement
 * that the Google provider is configured in the Supabase dashboard; showing a
 * Google button that always fails would be worse than showing none.
 */
export const ENABLED_PROVIDERS = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter((value): value is "google" => value === "google");

export function isAuthConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Builds a request-scoped client bound to Next's cookie store.
 *
 * A fresh client per request is required: the SSR helper caches cookie writes
 * on the instance, so reusing one across requests could drop a session.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies. The middleware refreshes
          // the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}

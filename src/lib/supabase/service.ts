/**
 * The privileged Supabase client.
 *
 * ── Read this before using it ────────────────────────────────────────────────
 *
 * This client bypasses row-level security. Everything RLS would have checked has
 * to be checked by the caller instead, so its uses are deliberately narrow:
 *
 *   1. Trash cleanup and other scheduled jobs (no user request to act as).
 *   2. Quota reconciliation against real storage objects.
 *   3. Webhook processing (Dodo is the caller, not a person).
 *   4. Invite acceptance lookups (the invitee has no session by definition).
 *   5. Writing support requests from the anonymous contact form.
 *
 * It must never be used to answer a user's read request "because the policy was
 * awkward". If a policy is awkward, the policy is wrong.
 *
 * The `server-only` import below is a compile-time guarantee: importing this
 * module from a client component fails the build rather than leaking the key
 * into a public bundle. A test additionally greps the build output.
 */

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

export function isServiceConfigured(): boolean {
  return Boolean(URL && SERVICE_KEY);
}

let cached: SupabaseClient | null = null;

/**
 * Returns the service client, or throws when the deployment has no key.
 *
 * Throwing rather than returning a "not configured" result is deliberate here:
 * every caller is a job or a webhook whose entire purpose is this write. A silent
 * no-op would mean a subscription never activates and nobody notices.
 */
export function getServiceClient(): SupabaseClient {
  if (!isServiceConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured: privileged work cannot run on this deployment.",
    );
  }

  cached ??= createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}

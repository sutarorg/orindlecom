/**
 * Where UI code gets its business repository.
 *
 * Uses the Supabase-backed organization service whenever authentication and
 * the service role are configured, and degrades cleanly to the honest empty
 * repository otherwise (so local builds and unconfigured previews still render).
 */

import "server-only";

import { isAuthConfigured } from "@/lib/auth/supabase/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import { createEmptyBusinessRepository } from "./empty-repository";
import { createSupabaseBusinessRepository } from "./supabase-repository";
import type { BusinessRepository } from "./repository";

let override: BusinessRepository | null = null;
let supabaseRepo: BusinessRepository | null = null;
let emptyRepo: BusinessRepository | null = null;

export function getBusinessRepository(): BusinessRepository {
  if (override) return override;
  if (isAuthConfigured() && isServiceConfigured()) {
    supabaseRepo ??= createSupabaseBusinessRepository();
    return supabaseRepo;
  }
  emptyRepo ??= createEmptyBusinessRepository();
  return emptyRepo;
}

/** Verification hook — tests can inject a fixture-backed repository. */
export function setBusinessRepository(repository: BusinessRepository | null) {
  override = repository;
}

export function isBusinessConfigured(): boolean {
  return getBusinessRepository().configured;
}

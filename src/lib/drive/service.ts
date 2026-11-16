/**
 * Where UI code gets its drive repository.
 *
 * There are now two real implementations of the same contract:
 *
 *   - `createEmptyDriveRepository()` — the honest "nothing is connected" state.
 *     Reads succeed empty, writes return `not_configured`.
 *   - `createSupabaseDriveRepository()` — the live one.
 *
 * The choice is made once, here, from the environment. Every screen was built
 * against the contract rather than against either implementation, which is why
 * switching between them required no component changes.
 *
 * If R2 credentials are missing the live repository is still selected when
 * Supabase is configured — because reads (files already stored, usage, billing,
 * activity) genuinely work without R2. Only uploads need storage. Falling back to
 * the empty repository in that case would hide a customer's existing files from
 * them, which is worse than a failed upload.
 */

import "server-only";

import { isAuthConfigured } from "@/lib/auth/supabase/server";
import { isStorageConfigured } from "@/lib/r2/client";
import { createEmptyDriveRepository } from "./empty-repository";
import { createSupabaseDriveRepository } from "./supabase-repository";
import type { DriveRepository } from "./repository";

let cached: DriveRepository | null = null;

function build(): DriveRepository {
  // With no Supabase project there is no identity, so there is nothing to read
  // and no session to read it as. The empty repository is the truthful answer.
  if (!isAuthConfigured()) return createEmptyDriveRepository();
  return createSupabaseDriveRepository();
}

export function getDriveRepository(): DriveRepository {
  cached ??= build();
  return cached;
}

/**
 * Verification hook.
 *
 * Swaps in a fixture-backed repository so populated states can be reviewed, and
 * so tests can drive components without a database. Gated on an env var that the
 * harness sets and nothing else does, so production always gets the real one.
 */
export function setDriveRepository(repository: DriveRepository) {
  cached = repository;
}

export function isDriveConfigured() {
  return getDriveRepository().configured;
}

/** True when uploads can actually be performed. Reads do not depend on this. */
export function canUpload() {
  return isAuthConfigured() && isStorageConfigured();
}

/**
 * Where UI code gets its drive repository.
 *
 * Swapping to a live backend means replacing this factory; no component
 * changes. The repository is stateless, so a module-level singleton is safe
 * here in a way it would not be for a cookie-bound auth client.
 */

import "server-only";

import { createEmptyDriveRepository } from "./empty-repository";
import type { DriveRepository } from "./repository";

let cached: DriveRepository | null = null;

export function getDriveRepository(): DriveRepository {
  cached ??= createEmptyDriveRepository();
  return cached;
}

/**
 * Verification hook.
 *
 * The screenshot and interaction harness swaps in a fixture-backed repository
 * so the populated states can be reviewed. It is gated on an env var that the
 * harness sets and nothing else does, so production always gets the real one.
 */
export function setDriveRepository(repository: DriveRepository) {
  cached = repository;
}

export function isDriveConfigured() {
  return getDriveRepository().configured;
}

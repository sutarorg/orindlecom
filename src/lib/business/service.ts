/**
 * Where UI code gets its business repository.
 *
 * Swapping to a live organization backend means replacing this factory; no
 * component changes. The repository is stateless, so a module-level singleton is
 * safe here in a way it would not be for something cookie-bound.
 */

import "server-only";

import { createEmptyBusinessRepository } from "./empty-repository";
import type { BusinessRepository } from "./repository";

let cached: BusinessRepository | null = null;

export function getBusinessRepository(): BusinessRepository {
  cached ??= createEmptyBusinessRepository();
  return cached;
}

/** Verification hook — the harness swaps in a fixture-backed repository. */
export function setBusinessRepository(repository: BusinessRepository) {
  cached = repository;
}

export function isBusinessConfigured(): boolean {
  return getBusinessRepository().configured;
}

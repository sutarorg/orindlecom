/**
 * The shape every auth server action returns.
 *
 * Client-safe by design (no server imports), so components can narrow on
 * `status` without pulling the provider SDK into the browser bundle.
 */

import type { AuthErrorCode, AuthField } from "./types";

export interface AuthFormState {
  status: "idle" | "error" | "success";
  /** Human-readable, safe to render. Empty when idle. */
  message: string;
  code?: AuthErrorCode;
  fieldErrors?: Partial<Record<AuthField, string>>;
  retryAfterSeconds?: number;
}

export const INITIAL_AUTH_STATE: AuthFormState = { status: "idle", message: "" };

/** Narrowing helper so components read cleanly. */
export function isFailure(state: AuthFormState): boolean {
  return state.status === "error";
}

/**
 * Collapses a service failure into the form state, preserving field errors.
 * Kept here so all five forms report failures identically.
 */
export function toFormState(failure: {
  code: AuthErrorCode;
  message: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  retryAfterSeconds?: number;
}): AuthFormState {
  return {
    status: "error",
    message: failure.message,
    code: failure.code,
    fieldErrors: failure.fieldErrors,
    retryAfterSeconds: failure.retryAfterSeconds,
  };
}

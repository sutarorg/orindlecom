/**
 * The one error envelope.
 *
 * Every HTTP failure returns this shape, and its `code` values are exactly the
 * union the frontend already branches on (DriveErrorCode plus the auth codes).
 * That is why wiring the backend does not require new error states in the UI.
 */

export type AppErrorCode =
  | "unauthenticated"
  | "email_unverified"
  | "not_configured"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "quota_exceeded"
  | "invalid_name"
  | "validation_failed"
  | "rate_limited"
  | "unsupported"
  | "network"
  | "unknown";

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  email_unverified: 403,
  not_configured: 503,
  not_found: 404,
  forbidden: 403,
  conflict: 409,
  quota_exceeded: 413,
  invalid_name: 400,
  validation_failed: 400,
  rate_limited: 429,
  unsupported: 400,
  network: 502,
  unknown: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fields?: Record<string, string>;

  constructor(code: AppErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fields = fields;
  }

  get status(): number {
    return STATUS[this.code];
  }

  toJSON() {
    return { ok: false as const, code: this.code, message: this.message, fields: this.fields };
  }
}

/**
 * Messages are written for the person using the product, not for the person
 * reading the logs. "Constraint violation on files_name_key" is not an error
 * message; it is a stack trace with delusions.
 */
export const USER_MESSAGES = {
  notConfigured: "This part of Orindle isn't connected on this deployment yet.",
  notFound: "That item doesn't exist, or you don't have access to it.",
  forbidden: "You don't have permission to do that.",
  quota: "That upload is larger than the storage you have left. Free up space or move to a bigger plan.",
  invalidName: "A file name can't be empty, start with a dot, or contain / or \\.",
  conflict: "Something with that name already exists here.",
  rateLimited: "That's a lot of requests. Wait a moment and try again.",
  unsupported: "That option isn't available yet.",
  unauthenticated: "You need to sign in to do that.",
  unknown: "Something went wrong on our side. We've recorded it.",
} as const;

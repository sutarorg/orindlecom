import "server-only";

import { getServiceClient } from "@/lib/supabase/service";

/**
 * Rate limiting.
 *
 * The counting happens in Postgres (see 0010), not in this process. That matters
 * on Vercel: each concurrent instance has its own memory, so an in-memory counter
 * would give every warm instance its own full allowance. The requirement says no
 * in-memory timers, and this is the same principle applied to counters.
 *
 * Every limit here is per-user or per-IP depending on what is being protected.
 * The bucket key is built by the caller so it can include the right scope.
 */

export type RateLimitResult = {
  allowed: boolean;
  used: number;
  remaining: number;
  /** When the current window rolls over. Used to build a Retry-After header. */
  resetAt: Date;
};

/**
 * Limits, per window. Named rather than inline so they can be reviewed together
 * and changed in one place.
 *
 * The numbers are deliberately generous for normal use and tight for abuse:
 * a person does not create 120 folders in a minute, but a script does.
 */
export const LIMITS = {
  uploadPrepare: { limit: 120, windowSeconds: 60 },
  uploadComplete: { limit: 120, windowSeconds: 60 },
  createItem: { limit: 120, windowSeconds: 60 },
  renameItem: { limit: 120, windowSeconds: 60 },
  trashItem: { limit: 120, windowSeconds: 60 },
  shareCreate: { limit: 30, windowSeconds: 60 },
  // A person downloading a folder of 40 files mints 40 URLs. The cap is well above
  // that so ordinary use never trips it.
  download: { limit: 300, windowSeconds: 60 },
  checkout: { limit: 10, windowSeconds: 300 },
  emailSend: { limit: 20, windowSeconds: 3600 },
  supportMessage: { limit: 5, windowSeconds: 3600 },
} as const;

/**
 * Consume one unit from a bucket.
 *
 * Fails open when the database is unreachable. That is a deliberate trade: the
 * alternative is a storage product that refuses every request whenever the
 * database has a blip. The rate limiter protects against abuse, not against
 * catastrophic failure, and RLS plus per-user quotas still bound what a single
 * account can do.
 */
export async function consume(
  bucket: string,
  policy: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: policy.limit,
      p_window_s: policy.windowSeconds,
    });

    if (error || !data) {
      return {
        allowed: true,
        used: 0,
        remaining: policy.limit,
        resetAt: new Date(Date.now() + policy.windowSeconds * 1000),
      };
    }

    // The function returns a table, so the client hands back an array.
    const row = (Array.isArray(data) ? data[0] : data) as {
      allowed: boolean;
      used: number;
      remaining: number;
      reset_at: string;
    };

    return {
      allowed: row.allowed,
      used: row.used,
      remaining: row.remaining,
      resetAt: new Date(row.reset_at),
    };
  } catch {
    return {
      allowed: true,
      used: 0,
      remaining: policy.limit,
      resetAt: new Date(Date.now() + policy.windowSeconds * 1000),
    };
  }
}

/** Bucket key for a signed-in user. */
export function userBucket(scope: string, userId: string): string {
  return `${scope}:user:${userId}`;
}

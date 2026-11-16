/**
 * Quota-bypass detection.
 *
 * A single refusal is a person trying to upload a file that is too big, which is
 * an ordinary mistake and deserves a clear message and nothing else. Three
 * refusals inside an hour is a client retrying against a limit it has already been
 * told about, which is a different thing and is worth a cooldown.
 *
 * This module exists as its own file so the threshold lives beside the reasoning
 * rather than inside the upload service, where it would be one line among forty.
 */

import "server-only";

import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export interface QuotaViolationOutcome {
  /** True when this refusal pushed the account into a cooldown. */
  restricted: boolean;
  /** How many refusals are in the current hour, including this one. */
  violations: number;
}

/**
 * Record one refusal and escalate if the account has earned it.
 *
 * The counting and the escalation are done in one database function (0014) so
 * that two concurrent uploads cannot both read "2" and both decide to escalate,
 * and cannot both read "2" and neither escalate.
 */
export async function recordQuotaViolation(userId: string): Promise<QuotaViolationOutcome> {
  if (!isServiceConfigured()) return { restricted: false, violations: 0 };

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc("record_quota_violation", {
      p_user_id: userId,
      p_device_hash: null,
      p_ip_hash: null,
    });

    if (error) {
      console.error("[quota-guard] record_quota_violation failed", { message: error.message });
      return { restricted: false, violations: 0 };
    }

    const result = (data ?? {}) as { restricted?: boolean; violations?: number };
    return {
      restricted: Boolean(result.restricted),
      violations: Number(result.violations ?? 0),
    };
  } catch {
    return { restricted: false, violations: 0 };
  }
}

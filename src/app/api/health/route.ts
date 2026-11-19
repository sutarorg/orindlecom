/**
 * GET /api/health — configuration presence, never values.
 *
 * Deliberately public and deliberately useless to an attacker: no hostnames, no
 * key prefixes, no bucket names. It reports whether each subsystem can work, so
 * a deployment problem is visible before a customer finds it.
 */

import { ok, handle } from "@/lib/api";
import { isAuthConfigured } from "@/lib/auth/supabase/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isStorageConfigured } from "@/lib/r2/client";
import { activeBillingProvider, dodoHealth } from "@/domain/billing/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type State = "configured" | "missing" | "test-mode" | "sandbox" | "mismatch";

function resendState(): State {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!key) return "missing";
  const from = process.env.RESEND_FROM_ADDRESS ?? "";
  // The sandbox sender only delivers to the account owner, so "configured"
  // would overclaim for every other recipient.
  return from.includes("resend.dev") ? "sandbox" : "configured";
}

/**
 * The legacy Razorpay webhook handler.
 *
 * It stays mounted for historical events, so its secret is still worth
 * reporting — but it is not the provider that takes new payments, and its
 * presence says nothing about whether checkout works.
 */
function legacyRazorpayState(): State {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  return secret ? "configured" : "missing";
}

export async function GET() {
  return handle(async () =>
    ok({
      supabase: isAuthConfigured() ? "configured" : "missing",
      serviceRole: isServiceConfigured() ? "configured" : "missing",
      r2: isStorageConfigured() ? "configured" : "missing",
      // The provider that takes new checkouts.
      billingProvider: activeBillingProvider(),
      // Presence and mode only. Never a secret value, never a key prefix.
      dodo: dodoHealth(),
      // The legacy handler, kept for historical Razorpay events.
      legacyRazorpay: legacyRazorpayState(),
      resend: resendState(),
      jobs: process.env.CRON_SECRET ? "configured" : "missing",
      scanning: process.env.MALWARE_SCAN_ENABLED === "true" ? "enabled" : "not-configured",
    }),
  );
}

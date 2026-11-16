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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type State = "configured" | "missing" | "test-mode" | "sandbox" | "mismatch";

function razorpayState(): State {
  const id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? "";
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  if (!id || !secret) return "missing";

  const isTest = id.startsWith("rzp_test_");
  const isLive = id.startsWith("rzp_live_");

  // The two mistakes that cost real money: live keys outside production, and
  // test keys inside it.
  if (!isTest && !isLive) return "mismatch";
  if (process.env.NODE_ENV === "production" && isTest) return "mismatch";
  if (process.env.NODE_ENV !== "production" && isLive) return "mismatch";

  return isTest ? "test-mode" : "configured";
}

function resendState(): State {
  const key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (!key) return "missing";
  const from = process.env.RESEND_FROM_ADDRESS ?? "";
  // The sandbox sender only delivers to the account owner, so "configured"
  // would overclaim for every other recipient.
  return from.includes("resend.dev") ? "sandbox" : "configured";
}

export async function GET() {
  return handle(async () =>
    ok({
      supabase: isAuthConfigured() ? "configured" : "missing",
      serviceRole: isServiceConfigured() ? "configured" : "missing",
      r2: isStorageConfigured() ? "configured" : "missing",
      razorpay: razorpayState(),
      resend: resendState(),
      jobs: process.env.CRON_SECRET ? "configured" : "missing",
      scanning: process.env.MALWARE_SCAN_ENABLED === "true" ? "enabled" : "not-configured",
    }),
  );
}

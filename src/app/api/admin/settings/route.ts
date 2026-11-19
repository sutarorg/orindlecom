/**
 * GET /api/admin/settings — integration presence and the approved catalogue.
 *
 * **Presence, never values.** Each state is derived from whether a variable is
 * set (and, for Dodo, whether the configured environment matches the
 * deployment). No key,
 * key prefix, bucket name, hostname or project reference is in this payload — the
 * same discipline `/api/health` already applies in public.
 */

import { adminOk, adminRoute } from "@/lib/admin/route-helpers";
import { listPlatformAdmins } from "@/lib/admin/service";
import type { IntegrationState } from "@/lib/admin/types";
import { isAuthConfigured } from "@/lib/auth/supabase/server";
// Presence check only — a boolean. The client itself is never imported here; the
// authorized context carries it.
import { isServiceConfigured } from "@/lib/supabase/service";
import { isStorageConfigured } from "@/lib/r2/client";
import { getEmailState } from "@/lib/resend/client";
import { dodoHealth } from "@/domain/billing/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Dodo configuration state.
 *
 * `dodoHealth()` already applies the two mistakes that cost real money — live
 * credentials outside production and test credentials inside it — so the
 * mapping here is a straight pass-through.
 */
function dodoState(): IntegrationState["state"] {
  return dodoHealth();
}

export async function GET() {
  return adminRoute(
    async (ctx) => {
      const emailState = getEmailState();

      const integrations: IntegrationState[] = [
        {
          key: "supabase",
          label: "Supabase (auth and database)",
          state: isAuthConfigured() ? "configured" : "missing",
          detail: isAuthConfigured()
            ? "Sign-in and account data are connected."
            : "No Supabase project is configured. Accounts cannot work.",
        },
        {
          key: "service-role",
          label: "Supabase service role",
          state: isServiceConfigured() ? "configured" : "missing",
          detail: isServiceConfigured()
            ? "Privileged server work is available."
            : "Without the service-role key, administration cannot run at all.",
        },
        {
          key: "r2",
          label: "Cloudflare R2 (file storage)",
          state: isStorageConfigured() ? "configured" : "missing",
          detail: isStorageConfigured()
            ? "Files are stored in a private bucket accessed through short-lived signed URLs."
            : "No storage bucket is configured. Uploads cannot complete.",
        },
        {
          key: "dodo",
          label: "Dodo Payments (payments)",
          state: dodoState(),
          detail:
            "The configured Dodo environment is checked against the deployment so live credentials never run in development.",
        },
        {
          key: "legacy-razorpay",
          label: "Razorpay (legacy, historical events only)",
          state: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ? "configured" : "missing",
          detail:
            "Kept so historical Razorpay subscriptions and delayed events still process. No new checkouts use it.",
        },
        {
          key: "resend",
          label: "Resend (email)",
          state:
            emailState === "ready"
              ? "configured"
              : emailState === "sandbox"
                ? "sandbox"
                : "missing",
          detail:
            emailState === "ready"
              ? "A verified sending domain is configured."
              : emailState === "sandbox"
                ? "The sandbox sender only delivers to the account owner. Other recipients will not receive mail."
                : "No email provider is configured. Support replies cannot be sent.",
        },
        {
          key: "jobs",
          label: "Scheduled jobs",
          state: process.env.CRON_SECRET ? "configured" : "missing",
          detail: process.env.CRON_SECRET
            ? "Cron routes require a bearer secret."
            : "No cron secret is set, so scheduled routes cannot authenticate.",
        },
        {
          key: "analytics",
          label: "Website analytics",
          state:
            process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true" &&
            process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID &&
            process.env.GA_PROPERTY_ID
              ? "configured"
              : "not-connected",
          detail: "Analytics is off until a measurement id, a property id and a consent banner are all configured.",
        },
        {
          key: "search-console",
          label: "Google Search Console",
          state: process.env.GSC_SITE_URL ? "not-connected" : "not-connected",
          detail: "Search Console reporting requires a property grant this deployment does not have.",
        },
      ];

      return adminOk({
        integrations,
        // The approved catalogue, read from the database — the same rows checkout
        // resolves amounts from, so the console cannot show a price the product
        // will not charge.
        plans: await ctx.db
          .from("plans")
          .select("id, name, storage_bytes, sort_order, is_active")
          .order("sort_order"),
        prices: await ctx.db
          .from("plan_prices")
          .select("plan_id, currency, period, amount_minor, approved")
          .eq("approved", true)
          .order("plan_id"),
        admins: await listPlatformAdmins(ctx),
        currentRole: ctx.admin.role,
      });
    },
    { permission: "view_settings", limit: "adminRead" },
  );
}

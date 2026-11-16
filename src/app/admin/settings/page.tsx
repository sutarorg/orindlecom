/**
 * /admin/settings — integration states, the approved price catalogue, and
 * platform administrators.
 *
 * **Presence, never values.** Every integration row is derived from whether a
 * variable is set, and for Razorpay from whether the key mode matches the
 * environment. No key, key prefix, hostname, bucket name or project reference is
 * rendered — the same discipline `/api/health` applies in public.
 *
 * Nothing here is editable. Prices require an approval workflow that does not
 * exist; administrator grants are owner-only and go through a separate,
 * audit-logged route.
 */

import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getPriceCatalogue, listPlatformAdmins } from "@/lib/admin/service";
import { getEmailState } from "@/lib/resend/client";
import { isAuthConfigured } from "@/lib/auth/supabase/server";
import { isServiceConfigured } from "@/lib/supabase/service";
import { isStorageConfigured } from "@/lib/r2/client";
import { isBillingConfigured } from "@/domain/billing/razorpay";
import {
  AdminCard,
  AdminCardHeader,
  AdminPageHeader,
  Badge,
  TableShell,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/admin/admin-ui";
import { AdminAccessManager } from "@/components/admin/admin-access-manager";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type IntegrationTone = "green" | "amber" | "red" | "neutral";

interface IntegrationRow {
  key: string;
  label: string;
  state: string;
  tone: IntegrationTone;
  detail: string;
}

function razorpayRow(): IntegrationRow {
  if (!isBillingConfigured()) {
    return {
      key: "razorpay",
      label: "Razorpay",
      state: "Missing",
      tone: "neutral",
      detail: "No payment keys are configured. Checkout is unavailable.",
    };
  }
  const id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? "";
  const isTest = id.startsWith("rzp_test_");
  const isLive = id.startsWith("rzp_live_");

  if (!isTest && !isLive) {
    return {
      key: "razorpay",
      label: "Razorpay",
      state: "Unrecognised key mode",
      tone: "red",
      detail: "The key does not identify as test or live. Checkout will refuse to create orders.",
    };
  }
  if (process.env.NODE_ENV === "production" && isTest) {
    return {
      key: "razorpay",
      label: "Razorpay",
      state: "Mismatch",
      tone: "red",
      detail: "Test keys are configured in a production build. Live payments cannot work.",
    };
  }
  if (process.env.NODE_ENV !== "production" && isLive) {
    return {
      key: "razorpay",
      label: "Razorpay",
      state: "Mismatch",
      tone: "red",
      detail: "Live keys are configured outside production. This is how real money is taken by accident.",
    };
  }
  return {
    key: "razorpay",
    label: "Razorpay",
    state: isTest ? "Test mode" : "Configured",
    tone: isTest ? "amber" : "green",
    detail: isTest
      ? "Test keys: no real payment can be taken."
      : "Live keys, matching this environment.",
  };
}

export default async function AdminSettingsPage() {
  const ctx = await requirePlatformAdmin("view_settings");

  const emailState = getEmailState();

  const integrations: IntegrationRow[] = [
    {
      key: "supabase",
      label: "Supabase",
      state: isAuthConfigured() ? "Configured" : "Missing",
      tone: isAuthConfigured() ? "green" : "red",
      detail: isAuthConfigured()
        ? "Sign-in and account data are connected."
        : "No Supabase project is configured. Accounts cannot work.",
    },
    {
      key: "service",
      label: "Supabase service role",
      state: isServiceConfigured() ? "Configured" : "Missing",
      tone: isServiceConfigured() ? "green" : "red",
      detail: "Required for administration, webhooks and scheduled jobs.",
    },
    {
      key: "r2",
      label: "Cloudflare R2",
      state: isStorageConfigured() ? "Configured" : "Missing",
      tone: isStorageConfigured() ? "green" : "red",
      detail: "Private bucket; files are served through short-lived signed URLs.",
    },
    razorpayRow(),
    {
      key: "resend",
      label: "Resend",
      state: emailState === "ready" ? "Configured" : emailState === "sandbox" ? "Sandbox" : "Missing",
      tone: emailState === "ready" ? "green" : emailState === "sandbox" ? "amber" : "red",
      detail:
        emailState === "ready"
          ? "A verified sending domain is configured."
          : emailState === "sandbox"
            ? "The sandbox sender delivers only to the account owner. Customers will not receive mail."
            : "No email provider. Support replies cannot be sent.",
    },
    {
      key: "jobs",
      label: "Scheduled jobs",
      state: process.env.CRON_SECRET ? "Configured" : "Missing",
      tone: process.env.CRON_SECRET ? "green" : "red",
      detail: process.env.CRON_SECRET
        ? "Cron routes require a bearer secret."
        : "No cron secret is set, so scheduled routes cannot authenticate.",
    },
    {
      key: "analytics",
      label: "Website analytics",
      state:
        process.env.GA_PROPERTY_ID && process.env.GA_SERVICE_ACCOUNT_EMAIL
          ? "Configured"
          : "Not connected",
      tone: process.env.GA_PROPERTY_ID && process.env.GA_SERVICE_ACCOUNT_EMAIL ? "amber" : "neutral",
      detail:
        process.env.GA_PROPERTY_ID && process.env.GA_SERVICE_ACCOUNT_EMAIL
          ? "Reporting credentials are present, but this build does not run live GA4 queries."
          : "No property or reporting credentials. Analytics shows an honest empty state.",
    },
    {
      key: "gsc",
      label: "Google Search Console",
      state: "Not connected",
      tone: "neutral",
      detail: "Requires a verified property and a service-account grant.",
    },
  ];

  const admins = await listPlatformAdmins(ctx);

  /*
   * Read through the service layer rather than querying the tables here. Both are
   * small, but "small" is an assumption that stops being true quietly, and the
   * page has no business knowing the schema of a catalogue it only displays.
   */
  const catalogue = await getPriceCatalogue(ctx);
  const priceRows = catalogue.flatMap((plan) =>
    plan.prices.map((price) => ({ plan, price })),
  );

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Integration state, the approved price catalogue and platform administrator access. Nothing on this page is editable — each change has its own reviewable path."
      />

      <AdminCard>
        <AdminCardHeader
          title="Platform integrations"
          description="Presence and mode only. No key, prefix or hostname is shown."
        />
        <ul className="divide-y divide-[var(--brand-border-soft)]">
          {integrations.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink">{row.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">{row.detail}</p>
              </div>
              <Badge tone={row.tone} className="shrink-0">
                {row.state}
              </Badge>
            </li>
          ))}
        </ul>
      </AdminCard>

      <AdminCard className="mt-3" padded={false}>
        <div className="p-4 pb-0">
          <AdminCardHeader
            title="Plans and prices"
            description="Read from the same tables checkout resolves amounts from, so this cannot show a price the product will not charge."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">Approved plan prices</caption>
            <thead>
              <tr>
                <Th>Plan</Th>
                <Th>Currency</Th>
                <Th>Period</Th>
                <Th align="right">Price</Th>
                <Th>Approved</Th>
              </tr>
            </thead>
            <tbody>
              {priceRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[12px] text-text-muted">
                    No price rows. Checkout will refuse every order until prices are seeded.
                  </td>
                </tr>
              ) : (
                priceRows.map(({ plan, price }) => (
                  <tr key={`${plan.planId}-${price.currency}-${price.period}`}>
                    <Td>{plan.planName}</Td>
                    <Td>{price.currency}</Td>
                    <Td className="capitalize">{price.period}</Td>
                    <Td align="right" numeric>
                      {formatMoney(price.amountMinor, price.currency)}
                    </Td>
                    <Td>
                      {price.approved ? (
                        <Badge tone="green">Approved</Badge>
                      ) : (
                        <Badge tone="amber">Not approved</Badge>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="p-4 pt-2 text-[11px] leading-relaxed text-text-subtle">
          Only approved rows can be charged. Annual and regional prices are absent because none
          have been approved — this table shows what exists, and nothing is invented to fill a
          column.
        </p>
      </AdminCard>

      <div className="mt-3">
        <AdminCardHeader
          title="Platform administrators"
          description={
            ctx.admin.role === "owner"
              ? "Grant, change and revoke platform access. Every change is audited."
              : "Only the platform owner can change this list."
          }
        />
        <TableShell caption="Platform administrators" columns={5}>
          <thead>
            <tr>
              <Th>Account</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Granted</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {admins.map((row) => (
              <tr key={row.userId}>
                <Td>
                  <span className="truncate text-[12px] text-ink">{row.email ?? row.userId}</span>
                </Td>
                <Td>
                  <Badge tone={row.role === "owner" ? "violet" : "blue"}>{row.role}</Badge>
                </Td>
                <Td>
                  {row.isActive ? (
                    <Badge tone="green">Active</Badge>
                  ) : (
                    <Badge tone="red">Disabled</Badge>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-[11.5px]">{formatDate(row.createdAt)}</Td>
                <Td align="right">
                  <AdminAccessManager
                    targetUserId={row.userId}
                    targetEmail={row.email}
                    role={row.role}
                    isActive={row.isActive}
                    canManage={ctx.admin.role === "owner"}
                    isSelf={row.userId === ctx.admin.userId}
                    activeOwners={admins.filter((a) => a.role === "owner" && a.isActive).length}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
          Platform roles are unrelated to a customer&rsquo;s organization roles. Being an owner or
          admin of a business team grants nothing here, and never can — the two are separate tables
          with separate policies.
        </p>
      </div>
    </div>
  );
}

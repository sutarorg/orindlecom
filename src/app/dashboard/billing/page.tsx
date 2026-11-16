import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingView, type InvoiceRow } from "@/components/dashboard/billing-view";
import { getDriveRepository } from "@/lib/drive/service";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/auth/supabase/server";
import { resolveActor } from "@/domain/auth/actor";
import { isSupportedCurrency, type CurrencyCode } from "@/config/pricing";
import { resolveRequestCurrency } from "@/lib/geo/currency";
import type { Subscription } from "@/lib/drive/types";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Billing",
  description: "Your Orindle plan, invoices and payment method.",
  path: "/dashboard/billing",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [result, locationCurrency] = await Promise.all([
    getDriveRepository().subscription(),
    resolveRequestCurrency(),
  ]);

  const subscription: Subscription = result.ok
    ? result.data
    : {
        planId: "free",
        planName: "Free",
        status: "none",
        currency: locationCurrency,
        amount: 0,
        interval: "month",
        currentPeriodEnd: null,
        renewsAutomatically: false,
        cancelAtPeriodEnd: false,
      };

  // Existing active/past_due paid subscribers stay locked to their subscription
  // currency; everyone else sees prices strictly in their server-detected
  // location currency (defaulting to USD for countries outside the 8 regions).
  const hasLockedPaidSub =
    subscription.planId !== "free" &&
    (subscription.status === "active" || subscription.status === "past_due") &&
    isSupportedCurrency(subscription.currency);
  const currency: CurrencyCode = hasLockedPaidSub
    ? (subscription.currency as CurrencyCode)
    : locationCurrency;

  let invoices: InvoiceRow[] = [];
  if (isAuthConfigured()) {
    const actor = await resolveActor();
    if (actor.ok) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("invoices")
        .select("id, provider_payment_id, amount_minor, currency, status, paid_at, created_at")
        .eq("owner_id", actor.actor.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      invoices = (data ?? []).map((row) => ({
        id: String(row.id),
        paymentId: String(row.provider_payment_id),
        amountMinor: Number(row.amount_minor ?? 0),
        currency: String(row.currency ?? locationCurrency),
        status: String(row.status),
        paidAt: row.paid_at ? String(row.paid_at) : String(row.created_at),
      }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Billing"
        description="Your plan, what it costs, and how you pay for it."
        className="mb-4"
      />
      <BillingView subscription={subscription} currency={currency} invoices={invoices} />
    </div>
  );
}

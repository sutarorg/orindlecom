import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { BillingView } from "@/components/dashboard/billing-view";
import { getDriveRepository } from "@/lib/drive/service";
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
  const result = await getDriveRepository().subscription();

  const subscription: Subscription = result.ok
    ? result.data
    : {
        planId: "free",
        planName: "Free",
        status: "none",
        currency: "INR",
        amount: 0,
        interval: "month",
        currentPeriodEnd: null,
        renewsAutomatically: false,
        cancelAtPeriodEnd: false,
      };

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-5 sm:px-6">
      <PageHeader
        title="Billing"
        description="Your plan, what it costs, and how you pay for it."
        className="mb-4"
      />
      <BillingView subscription={subscription} />
    </div>
  );
}

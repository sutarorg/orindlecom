"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CreditCard, FileText, Globe, Lock, Minus, Receipt } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  ANNUAL_DISCOUNT_PCT,
  DEFAULT_CURRENCY,
  HIGHLIGHTED_PLAN,
  PLANS,
  currencyMeta,
  formatPrice,
  isSupportedCurrency,
  resolveAnnualTotal,
  resolvePrice,
  type BillingPeriod,
  type CurrencyCode,
  type Plan,
} from "@/config/pricing";
import { formatBytes, formatDate } from "@/lib/drive/format";
import type { Subscription } from "@/lib/drive/types";
import { cn } from "@/lib/utils";
import { startCheckout } from "@/lib/billing/checkout";
import { api } from "@/lib/drive/client";

export interface InvoiceRow {
  id: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  paidAt: string;
}

function formatMinorAmount(amountMinor: number, currencyCode: string): string {
  const code = isSupportedCurrency(currencyCode) ? currencyCode : DEFAULT_CURRENCY;
  return formatPrice(amountMinor / 100, code);
}

/**
 * Billing.
 *
 * Pricing currency is resolved authoritatively on the server from the user's
 * location (or their existing paid subscription) and cannot be changed manually.
 * `checkout()` opens Razorpay's overlay with an order created server-side from
 * `public.plan_prices` and resolves only after signature verification activates
 * the subscription.
 */
export function BillingView({
  subscription,
  currency: propCurrency,
  invoices = [],
}: {
  subscription: Subscription;
  currency?: CurrencyCode;
  invoices?: InvoiceRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();

  const currency: CurrencyCode =
    propCurrency ??
    (isSupportedCurrency(subscription.currency) ? subscription.currency : DEFAULT_CURRENCY);
  const [period, setPeriod] = React.useState<BillingPeriod>(
    subscription.interval === "year" ? "yearly" : "monthly",
  );
  const [busyPlan, setBusyPlan] = React.useState<string | null>(null);
  const [pendingDowngrade, setPendingDowngrade] = React.useState<Plan | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);

  const current = PLANS.find((plan) => plan.id === subscription.planId) ?? PLANS[0];
  const isActive = subscription.status === "active";
  const selectedCurrency = currencyMeta(currency);

  const cancelSubscription = async () => {
    const result = await api.post<{ status: string; currentPeriodEnd: string | null }>(
      "/api/billing/cancel",
    );

    if (!result.ok) {
      toast({ tone: "error", title: "Nothing was cancelled", description: result.message });
      return;
    }

    const end = result.data.currentPeriodEnd ? formatDate(result.data.currentPeriodEnd) : null;
    toast({
      tone: "success",
      title: "Subscription cancelled",
      description: end
        ? `Your plan stays active until ${end}, then drops to Free. Nothing is deleted.`
        : "Your plan stays active until the end of the period, then drops to Free. Nothing is deleted.",
    });
    router.refresh();
  };

  const switchPlan = async (plan: Plan) => {
    const result = await api.post<{ effectiveAt: string; note: string }>(
      "/api/billing/change-plan",
      { planId: plan.id },
    );

    if (!result.ok) {
      toast({ tone: "error", title: "Plan didn't change", description: result.message });
      return;
    }

    toast({
      tone: "success",
      title: `Switching to ${plan.name}`,
      description: result.data.note,
    });
    router.refresh();
  };

  const checkout = async (plan: Plan) => {
    setBusyPlan(plan.id);

    const outcome = await startCheckout({
      planId: plan.id,
      planName: plan.name,
      period,
    });

    setBusyPlan(null);

    if (outcome.ok) {
      toast({
        tone: "success",
        title: `${plan.name} is active`,
        description: "Your new allowance is available now.",
      });
      router.refresh();
      return;
    }

    if (outcome.code === "cancelled") {
      toast({ tone: "info", title: "Checkout closed", description: outcome.message });
      return;
    }

    toast({ tone: "error", title: "Payment wasn't completed", description: outcome.message });
  };

  const currentMonthlyPrice = resolvePrice(current, currency, "monthly");

  return (
    <div className="space-y-4">
      {/* Current subscription */}
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="border-b border-[var(--brand-border-soft)] px-4 py-3">
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">Current subscription</h2>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[17px] font-extrabold tracking-[-0.03em] text-ink">{current.name}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                    isActive
                      ? "bg-[#EAF9F1] text-[#1B8A57]"
                      : "bg-[var(--brand-surface-muted)] text-text-muted",
                  )}
                >
                  {isActive
                    ? subscription.cancelAtPeriodEnd
                      ? "Cancelling at period end"
                      : "Active"
                    : "No paid plan"}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-text-muted">
                {formatBytes(current.storageBytes)} of storage ·{" "}
                {currentMonthlyPrice === null
                  ? "—"
                  : current.id === "free"
                    ? `${formatPrice(0, currency)}/month`
                    : `${formatPrice(currentMonthlyPrice, currency)}/month`}
              </p>
            </div>
            <Link
              href="/dashboard/storage"
              className="inline-flex h-8 items-center rounded-lg border border-[var(--brand-border-strong)] bg-white px-2.5 text-[11.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View storage
            </Link>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Row
              label="Next billing date"
              value={
                subscription.currentPeriodEnd
                  ? formatDate(subscription.currentPeriodEnd)
                  : "Not scheduled — no paid plan is active"
              }
              muted={!subscription.currentPeriodEnd}
            />
            <Row
              label="Renews automatically"
              value={subscription.renewsAutomatically ? "Yes" : "Not applicable"}
              muted={!subscription.renewsAutomatically}
            />
            <Row
              label="Selected currency"
              value={`${selectedCurrency.code} (${selectedCurrency.symbol.trim()})`}
            />
            <Row
              label="Billing cycle"
              value={subscription.interval === "year" ? "Annual" : "Monthly"}
            />
          </dl>

          {isActive && !subscription.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="mt-4 inline-flex min-h-6 items-center rounded text-[11.5px] font-medium text-text-muted underline-offset-2 hover:text-[#C93B2B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel subscription
            </button>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--brand-border-soft)] px-4 py-3">
          <div>
            <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">Plans</h2>
            <p className="text-[10.5px] text-text-subtle">
              Choose a currency and monthly or annual billing
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Billing period"
              className="inline-flex items-center rounded-lg border border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] p-0.5 text-[11px]"
            >
              <button
                type="button"
                aria-pressed={period === "monthly"}
                onClick={() => setPeriod("monthly")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-semibold transition-colors",
                  period === "monthly" ? "bg-white text-ink shadow-xs" : "text-text-muted hover:text-ink",
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                aria-pressed={period === "yearly"}
                onClick={() => setPeriod("yearly")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold transition-colors",
                  period === "yearly" ? "bg-white text-ink shadow-xs" : "text-text-muted hover:text-ink",
                )}
              >
                Yearly
                <span className="rounded bg-primary-soft px-1 py-0.5 text-[9.5px] font-bold text-primary">
                  -{ANNUAL_DISCOUNT_PCT}%
                </span>
              </button>
            </div>

            <span
              aria-label={`Billing currency: ${selectedCurrency.label} (${selectedCurrency.code})`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-canvas)] px-2.5 text-[11.5px] font-semibold text-ink"
            >
              <Globe className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              {selectedCurrency.code} ({selectedCurrency.symbol.trim()})
            </span>
          </div>
        </div>

        <ul className="divide-y divide-[var(--brand-border-soft)]">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === subscription.planId;
            const isPopular = plan.id === HIGHLIGHTED_PLAN;
            const amount = resolvePrice(plan, currency, period);
            const annualTotal = resolveAnnualTotal(plan, currency);
            const isDowngrade = PLANS.indexOf(plan) < PLANS.indexOf(current);
            return (
              <li
                key={plan.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 px-4 py-3",
                  isCurrent && "bg-primary-soft/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                    isCurrent ? "bg-primary text-white" : "bg-[var(--brand-surface-muted)] text-text-muted",
                  )}
                  aria-hidden="true"
                >
                  {plan.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                    {plan.name}
                    {isPopular && !isCurrent && (
                      <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-primary">
                        Popular
                      </span>
                    )}
                    {isCurrent && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-[10.5px] text-text-subtle">
                    {formatBytes(plan.storageBytes)}
                    {period === "yearly" && plan.id !== "free" && annualTotal !== null && (
                      <> · Billed {formatPrice(annualTotal, currency)}/year</>
                    )}
                  </p>
                </div>
                <p className="tabular-nums text-[12px] font-semibold text-text">
                  {amount === null ? "—" : formatPrice(amount, currency)}
                  <span className="text-[10.5px] font-normal text-text-subtle">/mo</span>
                </p>
                <button
                  type="button"
                  disabled={isCurrent || busyPlan !== null}
                  onClick={() => (isDowngrade ? setPendingDowngrade(plan) : checkout(plan))}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-[11.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    isCurrent
                      ? "cursor-default border border-[var(--brand-border)] bg-transparent text-text-subtle"
                      : "border border-[var(--brand-border-strong)] bg-white text-ink hover:bg-[var(--brand-surface-muted)]",
                  )}
                >
                  {isCurrent
                    ? "Your plan"
                    : busyPlan === plan.id
                      ? "Opening…"
                      : isDowngrade
                        ? "Downgrade"
                        : "Upgrade"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Payment history */}
      <section className="overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-white">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--brand-border-soft)] px-4 py-3">
          <h2 className="text-[13px] font-bold tracking-[-0.02em] text-ink">Payment history</h2>
          <Receipt className="h-3.5 w-3.5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
        </div>
        {invoices.length === 0 ? (
          <div className="px-4 py-7 text-center">
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-surface-muted)] text-text-subtle">
              <FileText className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <p className="mt-2.5 text-[12.5px] font-semibold text-ink">No payment receipts yet</p>
            <p className="mx-auto mt-1 max-w-[340px] text-[11.5px] leading-relaxed text-text-muted">
              Receipts appear here after your first payment. Orindle doesn&apos;t generate placeholder
              invoices.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--brand-border-soft)]">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-ink">
                    {formatMinorAmount(inv.amountMinor, inv.currency)}
                    <span className="ml-1.5 text-[11px] font-normal text-text-subtle">
                      {inv.currency}
                    </span>
                  </p>
                  <p className="text-[10.5px] text-text-subtle">
                    {formatDate(inv.paidAt)} · Ref {inv.paymentId}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                    inv.status === "paid"
                      ? "bg-[#EAF9F1] text-[#1B8A57]"
                      : inv.status === "refunded"
                        ? "bg-[#FFF5E5] text-[#A16207]"
                        : "bg-[var(--brand-surface-muted)] text-text-muted",
                  )}
                >
                  {inv.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-1.5 border-t border-[var(--brand-border-soft)] px-4 py-2.5 text-[10.5px] text-text-subtle">
          <Lock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
          Payments are processed by Razorpay. Card details are never stored on Orindle servers.
        </p>
      </section>

      <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-text-subtle">
        <CreditCard className="mt-px h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span>
          Available in 8 currencies with monthly or annual (20% off) billing. GST / downloadable tax
          invoices are not currently enabled. See our{" "}
          <Link href="/terms" className="underline hover:text-ink">
            Terms of Service
          </Link>{" "}
          for renewal, cancellation, and refund details.
        </span>
      </p>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          void cancelSubscription();
        }}
        title="Cancel your subscription?"
        confirmLabel="Cancel subscription"
        destructive
      >
        Your plan stays active until the end of the current billing period, then drops to Free (10
        GB). Your files stay readable and downloadable; new uploads pause if you are above 10 GB
        until you free space or re-subscribe.
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingDowngrade !== null}
        onClose={() => setPendingDowngrade(null)}
        onConfirm={() => {
          const plan = pendingDowngrade;
          setPendingDowngrade(null);
          if (plan) void switchPlan(plan);
        }}
        title={`Switch to ${pendingDowngrade?.name ?? "a smaller plan"}?`}
        confirmLabel="Switch plan"
        destructive
      >
        A smaller plan has less space. If you&apos;re over the new limit you keep your files, but
        you can&apos;t upload more until you free space or upgrade again.
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--brand-canvas)] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 flex items-center gap-1 text-[12px] font-medium",
          muted ? "text-text-subtle" : "text-ink",
        )}
      >
        {muted && <Minus className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />}
        {value}
      </dd>
    </div>
  );
}

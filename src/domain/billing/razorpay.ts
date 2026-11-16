/**
 * Razorpay payments.
 *
 * Three invariants, and every function here exists to hold one of them:
 *
 *   1. **The amount comes from the database.** The client sends a plan id,
 *      currency and period; the server resolves the price from an `approved`
 *      row. There is no code path where a client-supplied figure reaches
 *      Razorpay.
 *   2. **Nothing activates without a verified signature.** Both the browser
 *      callback and the webhook are HMAC-verified, compared in constant time.
 *   3. **Everything is idempotent.** Razorpay retries; a duplicate delivery
 *      must produce one subscription and one invoice, never two charges.
 *
 * International payments across all eight approved currencies (INR, USD, GBP,
 * EUR, AED, SGD, AUD, CAD) and both monthly and annual (20% off) periods are
 * approved for Orindle. Both capability switches remain configurable via
 * environment variables (`RAZORPAY_INTERNATIONAL_ENABLED`,
 * `RAZORPAY_RECURRING_ENABLED`) as kill-switches (`"false"` disables).
 */

import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/domain/auth/errors";
import { isSupportedCurrency, type CurrencyCode } from "@/config/pricing";
import { getServiceClient } from "@/lib/supabase/service";

const KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim() ?? "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
const API = "https://api.razorpay.com/v1";

/**
 * Merchant-account capabilities.
 *
 * Razorpay international and recurring payments are approved for Orindle;
 * both default to enabled unless explicitly turned off with `"false"`.
 */
export const BILLING_CAPABILITIES = {
  international: process.env.RAZORPAY_INTERNATIONAL_ENABLED !== "false",
  recurring: process.env.RAZORPAY_RECURRING_ENABLED !== "false",
} as const;

export function isBillingConfigured(): boolean {
  return Boolean(KEY_ID && KEY_SECRET);
}

function authHeader(): string {
  return `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/*  Price resolution                                                   */
/* ------------------------------------------------------------------ */

export interface ResolvedPrice {
  planId: string;
  currency: CurrencyCode;
  period: "monthly" | "yearly";
  /** Minor units, from the database. */
  amountMinor: number;
}

/**
 * The only place an amount is decided.
 *
 * Resolves an approved price row from `public.plan_prices` for any of the
 * eight approved currencies on monthly or yearly billing.
 */
export async function resolveApprovedPrice(
  planId: string,
  currency: string,
  period: "monthly" | "yearly",
): Promise<ResolvedPrice> {
  if (!isBillingConfigured()) {
    throw new AppError("not_configured", "Payments aren't connected on this deployment yet.");
  }

  const normalizedCurrency = currency.trim().toUpperCase();
  if (!isSupportedCurrency(normalizedCurrency)) {
    throw new AppError(
      "unsupported",
      "That currency isn't supported. Choose one of our eight published currencies.",
    );
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("plan_prices")
    .select("plan_id, currency, period, amount_minor")
    .eq("plan_id", planId)
    .eq("currency", normalizedCurrency)
    // Only an approved row may be charged.
    .eq("approved", true)
    .eq("period", period)
    .maybeSingle();

  if (error) throw new AppError("unknown", "We couldn't look up that plan. Nothing was charged.");
  if (!data) {
    throw new AppError(
      "unsupported",
      "That plan isn't available in the selected currency or billing period. Nothing was charged.",
    );
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("is_active")
    .eq("id", planId)
    .maybeSingle();

  if (!plan?.is_active) {
    throw new AppError("unsupported", "That plan isn't available right now. Nothing was charged.");
  }

  // Runtime kill-switches: checked before an order exists.
  const internationalEnabled = process.env.RAZORPAY_INTERNATIONAL_ENABLED !== "false";
  const recurringEnabled = process.env.RAZORPAY_RECURRING_ENABLED !== "false";

  if (normalizedCurrency !== "INR" && !internationalEnabled) {
    throw new AppError(
      "unsupported",
      "Payments in this currency are temporarily paused. Nothing was charged.",
    );
  }
  if (!recurringEnabled) {
    throw new AppError(
      "unsupported",
      "Subscription checkout is temporarily paused. Nothing was charged.",
    );
  }

  return {
    planId: data.plan_id as string,
    currency: normalizedCurrency,
    period: data.period as "monthly" | "yearly",
    amountMinor: Number(data.amount_minor),
  };
}

/**
 * A last check before an order exists.
 *
 * resolveApprovedPrice already refuses anything that is not an approved,
 * sellable row. This asserts the arithmetic is sane, so a bad seed row cannot
 * become a bad charge.
 */
export function createOrderGuard(price: ResolvedPrice): void {
  if (!Number.isInteger(price.amountMinor) || price.amountMinor < 0) {
    throw new AppError("unknown", "We couldn't price that plan. Nothing was charged.");
  }
  if (price.amountMinor === 0 && price.planId !== "free") {
    throw new AppError("unsupported", "That plan has no approved price. Nothing was charged.");
  }
}

/* ------------------------------------------------------------------ */
/*  Orders                                                             */
/* ------------------------------------------------------------------ */

export interface CreatedOrder {
  orderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
}

/**
 * Create a Razorpay order.
 *
 * `userId` goes into the order notes because the webhook arrives with no session
 * at all. The notes are the only trustworthy statement of who the money is for,
 * and they were written by this server at order time rather than supplied by the
 * browser.
 */
export async function createOrder(
  price: ResolvedPrice,
  receipt: string,
  userId: string,
): Promise<CreatedOrder> {
  if (!userId) {
    throw new AppError("unknown", "We couldn't start checkout. Nothing was charged.");
  }

  const response = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: price.amountMinor,
      currency: price.currency,
      receipt,
      notes: { planId: price.planId, period: price.period, currency: price.currency, userId },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[billing] order create failed", { status: response.status, body: body.slice(0, 300) });
    throw new AppError("network", "We couldn't start checkout. Nothing was charged.");
  }

  const order = (await response.json()) as { id?: string; amount?: number; currency?: string };
  if (!order.id) throw new AppError("network", "We couldn't start checkout. Nothing was charged.");

  return {
    orderId: order.id,
    amountMinor: Number(order.amount ?? price.amountMinor),
    currency: order.currency ?? price.currency,
    keyId: KEY_ID,
  };
}

/**
 * Fetch an order from Razorpay.
 */
export async function fetchOrder(orderId: string): Promise<{
  orderId: string;
  amountMinor: number;
  currency: string;
  notes: Record<string, string>;
} | null> {
  const response = await fetch(`${API}/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;

  const order = (await response.json()) as {
    id?: string;
    amount?: number;
    currency?: string;
    notes?: Record<string, string>;
  };

  if (!order.id) return null;

  return {
    orderId: order.id,
    amountMinor: Number(order.amount ?? 0),
    currency: order.currency ?? "INR",
    notes: order.notes ?? {},
  };
}

/* ------------------------------------------------------------------ */
/*  Signature verification                                             */
/* ------------------------------------------------------------------ */

export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!KEY_SECRET) return false;

  const expected = createHmac("sha256", KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return constantTimeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;

  const expected = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return constantTimeEqual(expected, signature);
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------ */
/*  Activation                                                         */
/* ------------------------------------------------------------------ */

export interface ActivationInput {
  userId: string;
  planId: string;
  currency: string;
  period: "monthly" | "yearly";
  amountMinor: number;
  paymentId: string;
  subscriptionId?: string | null;
  periodEnd: string;
}

/**
 * Activate a plan, exactly once.
 *
 * Idempotent by construction: `provider_payment_id` is unique on invoices, so a
 * replayed webhook inserts nothing, and the unique partial index on
 * `subscriptions (owner_id) WHERE status IN ('active','past_due')` means a race
 * between two activations cannot produce two live plans.
 */
export async function activateSubscription(input: ActivationInput): Promise<void> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("provider_payment_id", input.paymentId)
    .maybeSingle();

  if (existing) return;

  const { data: current } = await supabase
    .from("subscriptions")
    .select("id, recovery_ends_at")
    .eq("owner_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    owner_id: input.userId,
    plan_id: input.planId,
    currency: input.currency,
    status: "active" as const,
    provider_subscription_id: input.subscriptionId ?? null,
    current_period_start: new Date().toISOString(),
    current_period_end: input.periodEnd,
    billing_period: input.period,
    cancel_at_period_end: false,
    expired_at: null,
    recovery_ends_at: null,
  };

  let subscriptionId = current?.id;

  if (current) {
    await supabase.from("subscriptions").update(payload).eq("id", current.id);
  } else {
    const { data: created } = await supabase
      .from("subscriptions")
      .insert(payload)
      .select("id")
      .single();
    subscriptionId = created?.id;
  }

  await supabase.from("invoices").insert({
    owner_id: input.userId,
    subscription_id: subscriptionId ?? null,
    provider_payment_id: input.paymentId,
    amount_minor: input.amountMinor,
    currency: input.currency,
    status: "paid",
    paid_at: new Date().toISOString(),
  });

  await supabase.from("activity_events").insert({
    actor_id: input.userId,
    subject_type: "subscription",
    subject_id: subscriptionId ?? null,
    kind: "subscription.activated",
    metadata: {
      planId: input.planId,
      period: input.period,
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
  });
}

/** A receipt reference that is not guessable from the user id. */
export function receiptRef(): string {
  return `orindle_${randomBytes(8).toString("hex")}`;
}

/** Period end for a plan term. Monthly is a calendar month, not 30 days. */
export function periodEnd(from: Date, period: "monthly" | "yearly"): string {
  const end = new Date(from);
  if (period === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end.toISOString();
}

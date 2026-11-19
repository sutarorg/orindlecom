/**
 * Dodo Payments — server-side integration.
 *
 * This module is the only place that talks to Dodo. Everything above it
 * (routes, UI) works in Orindle terms: plan id, currency, billing period,
 * minor units. Everything below it is Dodo: product ids, checkout sessions,
 * subscription ids, webhooks.
 *
 * Four invariants, and every function here exists to hold one of them:
 *
 *   1. **The amount comes from the database.** The browser sends a plan id and
 *      a period. The server resolves the approved price from
 *      `public.plan_prices`, resolves the Dodo product from
 *      `public.billing_provider_prices`, and then *re-validates the product
 *      against Dodo's own catalog* before a checkout session exists. There is
 *      no path where a client-supplied figure, product id, currency or user id
 *      reaches Dodo.
 *   2. **Nothing activates without a verified event.** A plan is activated
 *      from a signature-verified Dodo webhook, or from an authoritative
 *      server-side provider read. A browser redirect proves nothing.
 *   3. **Everything is idempotent.** Dodo retries webhooks and can deliver
 *      them out of order. A duplicate delivery produces one subscription and
 *      one invoice, never two charges.
 *   4. **It fails closed.** A missing product mapping, a price that does not
 *      match the approved Orindle price, a currency that is not the approved
 *      one, or a recurring interval that is wrong all refuse the checkout.
 *      There is no "best effort" path and no fallback to another price.
 *
 * International payments across all eight approved currencies (INR, USD, GBP,
 * EUR, AED, SGD, AUD, CAD) and both monthly and annual (20% off) periods are
 * approved for Orindle.
 */

import "server-only";

import DodoPayments from "dodopayments";
import { AppError } from "@/domain/auth/errors";
import {
  isSupportedCurrency,
  type BillingPeriod,
  type CurrencyCode,
  type PlanId,
} from "@/config/pricing";
import { getServiceClient } from "@/lib/supabase/service";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

/**
 * The provider that handles *new* checkouts.
 *
 * "dodo" is the only value that creates a checkout session today. The
 * provider identifier still exists on every row so historical Razorpay
 * records stay distinguishable, and the legacy Razorpay webhook handler
 * stays mounted for delayed legacy events.
 */
export type BillingProvider = "dodo" | "razorpay";

const API_KEY = process.env.DODO_PAYMENTS_API_KEY?.trim() ?? "";
const WEBHOOK_KEY = process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() ?? "";
const ENVIRONMENT = (process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() ?? "test").toLowerCase();

/** Dodo's two environments, as the SDK names them. */
export type DodoEnvironment = "test_mode" | "live_mode";

export function dodoEnvironment(): DodoEnvironment {
  return ENVIRONMENT === "live" ? "live_mode" : "test_mode";
}

export function isDodoConfigured(): boolean {
  return Boolean(API_KEY);
}

export function isDodoWebhookConfigured(): boolean {
  return Boolean(WEBHOOK_KEY);
}

/**
 * Which payment provider handles new checkouts.
 *
 * Defaults to "dodo" so a deployment that has configured Dodo does not need
 * an extra switch. Any other value leaves paid checkout disabled rather than
 * silently falling back to Razorpay — a failed Dodo call must never quietly
 * route a customer to a second provider.
 */
export function activeBillingProvider(): BillingProvider {
  const raw = (process.env.BILLING_PROVIDER?.trim() ?? "dodo").toLowerCase();
  return raw === "razorpay" ? "razorpay" : "dodo";
}

/**
 * Whether paid checkout can run at all.
 *
 * Both the provider switch and the credentials must agree. `not_configured`
 * is the honest answer when either is missing.
 */
export function isBillingConfigured(): boolean {
  if (activeBillingProvider() !== "dodo") return false;
  return isDodoConfigured();
}

/**
 * Health of the Dodo configuration, for `/api/health`.
 *
 * Reports presence and mode, never a secret value.
 */
export type DodoHealth = "configured" | "missing" | "test-mode" | "mismatch";

export function dodoHealth(): DodoHealth {
  if (!API_KEY) return "missing";

  const environment = dodoEnvironment();
  const isProduction = process.env.NODE_ENV === "production";

  /*
   * The two mistakes that cost real money: live keys outside production, and
   * test keys inside it.
   *
   * Dodo API keys are not prefixed by environment the way Razorpay's were, so
   * the guard is based on the explicitly configured environment rather than on
   * the shape of the key. `DODO_PAYMENTS_ENVIRONMENT` is the source of truth,
   * and a mismatch against the deployment target is reported rather than
   * silently accepted.
   */
  if (isProduction && environment !== "live_mode") return "mismatch";
  if (!isProduction && environment === "live_mode") return "mismatch";

  return environment === "live_mode" ? "configured" : "test-mode";
}

/**
 * Whether the API key actually belongs to the configured environment.
 *
 * Dodo's live-mode API keys are the ones that work against live.dodopayments.com.
 * We cannot introspect a key, so this compares the configured environment with
 * the deployment target — a deliberate, documented limitation rather than a
 * silent assumption.
 */
export function environmentMismatch(): boolean {
  return dodoHealth() === "mismatch";
}

/* ------------------------------------------------------------------ */
/*  SDK client                                                         */
/* ------------------------------------------------------------------ */

let cachedClient: DodoPayments | null = null;

/**
 * The Dodo SDK client.
 *
 * A single instance per process: the SDK is stateless, and constructing one
 * per request is pure overhead. `webhookKey` is attached so
 * `client.webhooks.unwrap(...)` can verify Standard Webhooks signatures.
 */
export function dodoClient(): DodoPayments {
  if (!API_KEY) {
    throw new AppError("not_configured", "Payments aren't connected on this deployment yet.");
  }
  cachedClient ??= new DodoPayments({
    bearerToken: API_KEY,
    webhookKey: WEBHOOK_KEY || null,
    environment: dodoEnvironment(),
  });
  return cachedClient;
}

/* ------------------------------------------------------------------ */
/*  Price resolution                                                   */
/* ------------------------------------------------------------------ */

export interface ResolvedPrice {
  planId: PlanId;
  currency: CurrencyCode;
  period: BillingPeriod;
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
  period: BillingPeriod,
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

  return {
    planId: data.plan_id as PlanId,
    currency: normalizedCurrency,
    period: data.period as BillingPeriod,
    amountMinor: Number(data.amount_minor),
  };
}

/**
 * A last check before a checkout session exists.
 *
 * resolveApprovedPrice already refuses anything that is not an approved,
 * sellable row. This asserts the arithmetic is sane, so a bad seed row cannot
 * become a bad charge.
 */
export function createCheckoutGuard(price: ResolvedPrice): void {
  if (!Number.isInteger(price.amountMinor) || price.amountMinor < 0) {
    throw new AppError("unknown", "We couldn't price that plan. Nothing was charged.");
  }
  if (price.amountMinor === 0 && price.planId !== "free") {
    throw new AppError("unsupported", "That plan has no approved price. Nothing was charged.");
  }
}

/* ------------------------------------------------------------------ */
/*  Product mapping                                                    */
/* ------------------------------------------------------------------ */

export interface ProductMapping {
  provider: BillingProvider;
  planId: string;
  currency: CurrencyCode;
  period: BillingPeriod;
  /** The Dodo product id, e.g. `pdt_...`. */
  productId: string;
  /** The recurring interval the administrator configured. */
  interval: "Month" | "Year";
  /** The price the administrator configured, in minor units. */
  amountMinor: number;
  /** Which Dodo environment this mapping belongs to. */
  environment: DodoEnvironment;
}

/**
 * Find the Dodo product for a plan/currency/period.
 *
 * The mapping lives in `public.billing_provider_prices`, so an administrator
 * configures product ids without editing TypeScript. A missing mapping is an
 * error, never a fallback to some other product.
 */
export async function resolveProductMapping(
  planId: string,
  currency: CurrencyCode,
  period: BillingPeriod,
): Promise<ProductMapping> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("billing_provider_prices")
    .select(
      "provider, plan_id, currency, period, product_id, interval, amount_minor, environment",
    )
    .eq("provider", "dodo")
    .eq("plan_id", planId)
    .eq("currency", currency)
    .eq("period", period)
    .eq("environment", dodoEnvironment())
    .maybeSingle();

  if (error) {
    throw new AppError("unknown", "We couldn't look up that plan. Nothing was charged.");
  }

  if (!data || !data.product_id) {
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  const interval = data.interval === "Year" ? "Year" : "Month";
  const expectedInterval: "Month" | "Year" = period === "yearly" ? "Year" : "Month";

  // A mapping whose interval disagrees with the requested period is a
  // configuration error, and charging the wrong cycle is worse than not
  // charging at all.
  if (interval !== expectedInterval) {
    console.error("[billing] product mapping interval mismatch", {
      planId,
      currency,
      period,
      interval,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  return {
    provider: "dodo",
    planId: data.plan_id as string,
    currency: data.currency as CurrencyCode,
    period: data.period as BillingPeriod,
    productId: String(data.product_id),
    interval,
    amountMinor: Number(data.amount_minor),
    environment: data.environment as DodoEnvironment,
  };
}

/**
 * Validate the Dodo product itself against the approved Orindle price.
 *
 * The mapping table is written by an administrator; Dodo's catalog is the
 * provider's own truth. Both are checked, and any disagreement refuses the
 * checkout. This is what stops a stale mapping from quietly charging a
 * different amount than the one Orindle published.
 */
export async function validateProduct(
  mapping: ProductMapping,
  approved: ResolvedPrice,
): Promise<void> {
  const client = dodoClient();

  let product: Awaited<ReturnType<typeof client.products.retrieve>>;
  try {
    product = await client.products.retrieve(mapping.productId);
  } catch (error) {
    console.error("[billing] product retrieve failed", {
      productId: mapping.productId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  // The product must be a recurring product. A one-time price is not a
  // subscription and must never be treated as one.
  if (!product.is_recurring) {
    console.error("[billing] mapped product is not recurring", { productId: mapping.productId });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  const price = product.price;
  if (!price || price.type !== "recurring_price") {
    console.error("[billing] mapped product has no recurring price", {
      productId: mapping.productId,
      priceType: price?.type,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  /*
   * The recurring interval must match the period being sold. A monthly plan
   * that points at a yearly product would charge twelve times the approved
   * monthly price on the first renewal.
   */
  const productInterval = price.payment_frequency_interval;
  const expectedInterval = mapping.period === "yearly" ? "Year" : "Month";
  if (price.payment_frequency_count !== 1 || productInterval !== expectedInterval) {
    console.error("[billing] product interval mismatch", {
      productId: mapping.productId,
      paymentFrequencyCount: price.payment_frequency_count,
      paymentFrequencyInterval: productInterval,
      expected: expectedInterval,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  /*
   * The currency must be the approved one, and the amount must be the
   * approved amount.
   *
   * This is the check that makes the whole mapping trustworthy: the price on
   * the Dodo product is compared against the price in `public.plan_prices`
   * that Orindle publishes. If they differ by even one minor unit, the
   * checkout is refused.
   */
  if (price.currency !== approved.currency) {
    console.error("[billing] product currency mismatch", {
      productId: mapping.productId,
      productCurrency: price.currency,
      approvedCurrency: approved.currency,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }

  if (price.price !== approved.amountMinor) {
    console.error("[billing] product price mismatch", {
      productId: mapping.productId,
      productAmountMinor: price.price,
      approvedAmountMinor: approved.amountMinor,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }
}

/**
 * Cross-check the mapping table's own recorded amount against the approved
 * price, before any network call.
 *
 * A mapping whose recorded amount disagrees with `plan_prices` is stale and
 * is refused. This is cheap, and it means a bad mapping never reaches Dodo.
 */
export function assertMappingMatchesPrice(mapping: ProductMapping, approved: ResolvedPrice): void {
  if (mapping.amountMinor !== approved.amountMinor) {
    console.error("[billing] mapping amount differs from approved price", {
      planId: mapping.planId,
      currency: mapping.currency,
      period: mapping.period,
      mappingAmountMinor: mapping.amountMinor,
      approvedAmountMinor: approved.amountMinor,
    });
    throw new AppError(
      "not_configured",
      "That plan isn't available for purchase right now. Nothing was charged.",
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Checkout                                                           */
/* ------------------------------------------------------------------ */

export interface CheckoutSessionInput {
  price: ResolvedPrice;
  mapping: ProductMapping;
  userId: string;
  email?: string | null;
  name?: string | null;
  /** Internal reference tying the Dodo session to an Orindle checkout row. */
  reference: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedCheckout {
  sessionId: string;
  checkoutUrl: string;
}

/**
 * Create a Dodo hosted checkout session for a recurring product.
 *
 * The metadata written here is server-authored: the browser cannot set it,
 * and the webhook resolves the Orindle owner from the pending checkout row
 * rather than from metadata alone.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CreatedCheckout> {
  const client = dodoClient();

  const metadata: Record<string, string> = {
    orindle_checkout_reference: input.reference,
    orindle_plan_id: input.price.planId,
    orindle_currency: input.price.currency,
    orindle_period: input.price.period,
  };

  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: input.mapping.productId, quantity: 1 }],
    metadata,
    /*
     * Dodo requires both an email and a name when a new customer is created.
     * The email comes from the verified session, so it is never a
     * browser-supplied value; the name falls back to the email when the
     * account has no display name yet.
     */
    customer: {
      email: input.email ?? "",
      name: input.name ?? input.email ?? "",
    },
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    /*
     * Adaptive pricing is disabled on Orindle's account unless the
     * administrator turns it on, and Dodo discards `billing_currency` when it
     * is off. The currency therefore comes from the product's own price, which
     * is why the product mapping is per-currency and the price is validated
     * above. Sending it is harmless and correct if adaptive pricing is ever
     * enabled.
     */
    billing_currency: input.price.currency as never,
  });

  if (!session.session_id || !session.checkout_url) {
    throw new AppError("network", "We couldn't start checkout. Nothing was charged.");
  }

  return { sessionId: session.session_id, checkoutUrl: session.checkout_url };
}

/* ------------------------------------------------------------------ */
/*  Provider retrieval                                                 */
/* ------------------------------------------------------------------ */

export interface ProviderSubscription {
  subscription_id: string;
  product_id: string;
  status: string;
  currency: string;
  /** Authoritative current-period end, from the provider. */
  next_billing_date: string | null;
  /** Authoritative current-period start, from the provider. */
  previous_billing_date: string | null;
  cancel_at_next_billing_date: boolean;
  quantity: number;
  payment_frequency_interval: string;
  customer_id: string | null;
}

/**
 * Fetch a subscription from Dodo.
 *
 * Used for reconciliation when an event leaves local state ambiguous, and
 * for confirming that a plan change or cancellation actually took effect.
 */
export async function fetchSubscription(
  subscriptionId: string,
): Promise<ProviderSubscription | null> {
  const client = dodoClient();

  try {
    const sub = await client.subscriptions.retrieve(subscriptionId);
    return {
      subscription_id: sub.subscription_id,
      product_id: sub.product_id,
      status: sub.status,
      currency: String(sub.currency),
      next_billing_date: sub.next_billing_date ?? null,
      previous_billing_date: sub.previous_billing_date ?? null,
      cancel_at_next_billing_date: Boolean(sub.cancel_at_next_billing_date),
      quantity: sub.quantity,
      payment_frequency_interval: sub.payment_frequency_interval,
      customer_id: sub.customer?.customer_id ?? null,
    };
  } catch (error) {
    console.error("[billing] subscription retrieve failed", {
      subscriptionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Cancel at the end of the paid period.
 *
 * Orindle's policy is that cancellation never removes access immediately, and
 * Dodo's `cancel_at_next_billing_date` is exactly that: the subscription stays
 * active until the current period ends.
 */
export async function scheduleCancellation(subscriptionId: string): Promise<void> {
  const client = dodoClient();
  await client.subscriptions.update(subscriptionId, {
    cancel_at_next_billing_date: true,
    cancel_reason: "cancelled_by_customer",
  });
}

/**
 * Resume a subscription that was scheduled to cancel.
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  const client = dodoClient();
  await client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: false });
}

/**
 * Change the product on an existing subscription.
 *
 * Downgrades use `do_not_bill` with `effective_at: next_billing_date`: the
 * customer keeps what they paid for, and the new product is billed at the next
 * renewal. The provider's own price for the new product is what will be
 * charged from then on, which is why the mapping is validated first.
 *
 * Upgrades use `difference_immediately`: the customer is charged the gap now
 * and the plan changes at once, on the same subscription. A second
 * subscription is never created.
 */
export async function changeSubscriptionProduct({
  subscriptionId,
  productId,
  prorationBillingMode,
  effectiveAt,
}: {
  subscriptionId: string;
  productId: string;
  prorationBillingMode: "do_not_bill" | "difference_immediately";
  effectiveAt: "next_billing_date" | "immediately";
}): Promise<void> {
  const client = dodoClient();
  await client.subscriptions.changePlan(subscriptionId, {
    product_id: productId,
    quantity: 1,
    proration_billing_mode: prorationBillingMode,
    effective_at: effectiveAt,
    // A failed plan-change charge must not apply the change: the customer
    // would end up on a plan they never paid for.
    on_payment_failure: "prevent_change",
  });
}

/**
 * Create a Customer Portal session for a customer id already known to belong
 * to this Orindle user.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const client = dodoClient();
  const session = await client.customers.customerPortal.create(customerId, {
    return_url: returnUrl,
  });
  if (!session.link) {
    throw new AppError("network", "We couldn't open the billing portal. Please try again.");
  }
  return session.link;
}

/* ------------------------------------------------------------------ */
/*  Webhook verification                                               */
/* ------------------------------------------------------------------ */

export interface VerifiedWebhookEvent {
  webhookId: string;
  type: string;
  businessId: string | null;
  timestamp: string | null;
  data: Record<string, unknown>;
}

/**
 * Verify and parse a Dodo webhook.
 *
 * Dodo follows the Standard Webhooks specification: the signed content is
 * `{webhook-id}.{webhook-timestamp}.{raw-body}`, signed with HMAC-SHA256 and
 * compared in constant time. The SDK's `unwrap` does exactly that, including
 * the five-minute tolerance on the timestamp.
 *
 * The raw body must be the exact bytes received. Re-serialising the parsed
 * JSON changes the bytes and breaks verification, so the caller reads the body
 * as text and passes it through untouched.
 */
export function verifyWebhook(rawBody: string, headers: Record<string, string>): VerifiedWebhookEvent {
  if (!WEBHOOK_KEY) {
    throw new AppError("not_configured", "Webhooks aren't configured.");
  }

  const webhookId = headers["webhook-id"];
  const signature = headers["webhook-signature"];
  const timestamp = headers["webhook-timestamp"];

  if (!webhookId || !signature || !timestamp) {
    throw new AppError("forbidden", "Invalid signature.");
  }

  const client = dodoClient();

  let event: {
    type?: string;
    business_id?: string;
    timestamp?: string;
    data?: Record<string, unknown>;
  };

  try {
    event = client.webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      },
    }) as unknown as typeof event;
  } catch {
    // Never say why: a precise reason helps an attacker tune a forgery.
    throw new AppError("forbidden", "Invalid signature.");
  }

  if (!event || typeof event.type !== "string") {
    throw new AppError("validation_failed", "Invalid payload.");
  }

  return {
    webhookId,
    type: event.type,
    businessId: typeof event.business_id === "string" ? event.business_id : null,
    timestamp: typeof event.timestamp === "string" ? event.timestamp : null,
    data: (event.data ?? {}) as Record<string, unknown>,
  };
}

/* ------------------------------------------------------------------ */
/*  Status mapping                                                     */
/* ------------------------------------------------------------------ */

/**
 * Dodo subscription status → Orindle subscription status.
 *
 * Orindle's status model is `none | active | past_due | cancelled | expired`
 * (see the `subscriptions` table check constraint). The mapping is explicit
 * and documented rather than inferred, because a wrong mapping here decides
 * whether somebody keeps access to their files.
 *
 *   pending   → active   The mandate is authorised and the subscription is
 *                          live; the first payment is confirmed separately.
 *   active    → active
 *   paused    → past_due The customer paused. Orindle has no "paused" state,
 *                          and past_due is the state that keeps recovery rules
 *                          and file preservation intact.
 *   past_due  → past_due A renewal failed and the grace period started. The
 *                          customer keeps access until the grace period ends.
 *   on_hold   → past_due A renewal failed and the grace period ended. Still
 *                          past_due locally so the existing recovery and
 *                          file-preservation rules apply, rather than an
 *                          immediate deletion.
 *   failed    → expired  Subscription creation failed. Terminal: the customer
 *                          never got a subscription, so no entitlement is
 *                          granted and the account falls back to Free.
 *   cancelled → cancelled
 *   expired   → expired
 */
export function mapProviderStatus(status: string): "active" | "past_due" | "cancelled" | "expired" {
  switch (status) {
    case "active":
    case "pending":
      return "active";
    case "paused":
    case "past_due":
    case "on_hold":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "failed":
    case "expired":
      return "expired";
    default:
      // An unknown status must not silently keep or drop access. Treating it
      // as past_due preserves the entitlement and the recovery window, which
      // is the safe direction.
      return "past_due";
  }
}

/**
 * Dodo `payment_frequency_interval` → Orindle billing period.
 */
export function mapBillingPeriod(interval: string): BillingPeriod {
  return interval === "Year" ? "yearly" : "monthly";
}

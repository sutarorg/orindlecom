"use client";

/**
 * Dodo hosted checkout, browser side.
 *
 * The flow, in order, and why each step exists:
 *
 *   1. Ask the server to create a checkout session. The request carries a plan
 *      id and a period — never an amount, a currency, a product id or a user
 *      id. The server resolves the approved price and the provider product.
 *   2. Redirect the browser to the hosted checkout URL the server returned.
 *   3. When the browser comes back, ask `/api/billing/status` what the server
 *      knows. The return URL itself proves nothing.
 *
 * There is no step here that decides a payment succeeded. Only the server,
 * after a verified provider event, can say that.
 */

export type CheckoutOutcome =
  | { ok: true; redirecting: true }
  | { ok: false; code: string; message: string }
  /** The person closed the checkout. Nothing was charged and nothing is wrong. */
  | { ok: false; code: "cancelled"; message: string };

export interface StartCheckoutInput {
  planId: string;
  period: "monthly" | "yearly";
}

/**
 * Run the whole flow.
 *
 * Currency is intentionally omitted from the request body: the server always
 * determines the billing currency authoritatively from geolocation or the
 * user's existing active subscription.
 */
export async function startCheckout(input: StartCheckoutInput): Promise<CheckoutOutcome> {
  const created = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      planId: input.planId,
      period: input.period,
    }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { checkoutUrl?: string };
            code?: string;
            message?: string;
          }
        | null;
      return { response, payload };
    })
    .catch(() => ({ response: null, payload: null }));

  if (!created.response || !created.payload) {
    return {
      ok: false,
      code: "network",
      message: "We couldn't reach the server. Nothing was charged.",
    };
  }

  if (!created.payload.ok || !created.payload.data?.checkoutUrl) {
    return {
      ok: false,
      code: created.payload.code ?? "unknown",
      message: created.payload.message ?? "Checkout couldn't start. Nothing was charged.",
    };
  }

  // The hosted checkout page. Everything that matters happens there; the
  // browser comes back afterwards with no authority over the outcome.
  window.location.assign(created.payload.data.checkoutUrl);

  return { ok: true, redirecting: true };
}

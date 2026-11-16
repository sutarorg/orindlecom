"use client";

/**
 * Razorpay checkout, browser side.
 *
 * The flow, in order, and why each step exists:
 *
 *   1. Ask the server to create an order. The request carries a plan id and a
 *      period — never an amount. The server resolves the price from an approved row.
 *   2. Load Razorpay's script and open its overlay with the returned order id.
 *   3. On success, send the payment id and signature back to the server.
 *      `/api/billing/verify` re-checks the signature itself and activates.
 *
 * No path here decides that a payment succeeded. Step 3's callback firing means
 * Razorpay's UI said so; only the server's answer means it is true.
 */

export type CheckoutOutcome =
  | { ok: true; planId: string }
  | { ok: false; code: string; message: string }
  /** The person closed the overlay. Nothing was charged and nothing is wrong. */
  | { ok: false; code: "cancelled"; message: string };

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (arg: unknown) => void) => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

let scriptPromise: Promise<boolean> | null = null;

/**
 * Load the checkout script once.
 *
 * Cached at module scope so opening checkout twice does not inject the script
 * twice — which would redefine `window.Razorpay` mid-session and is exactly the kind
 * of bug that only shows up on a second attempt.
 */
function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export interface StartCheckoutInput {
  planId: string;
  planName: string;
  period: "monthly" | "yearly";
  currency: "INR" | "USD";
}

/**
 * Run the whole flow. Resolves only when the server has confirmed the outcome.
 */
export async function startCheckout(input: StartCheckoutInput): Promise<CheckoutOutcome> {
  // 1. Server creates the order.
  const created = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      planId: input.planId,
      period: input.period,
      currency: input.currency,
    }),
  })
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              orderId: string;
              amountMinor: number;
              currency: string;
              keyId: string;
            };
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

  if (!created.payload.ok || !created.payload.data) {
    return {
      ok: false,
      code: created.payload.code ?? "unknown",
      message: created.payload.message ?? "Checkout couldn't start. Nothing was charged.",
    };
  }

  const order = created.payload.data;

  // 2. Open the overlay.
  const loaded = await loadScript();
  if (!loaded || !window.Razorpay) {
    // Say what happened. The order exists but no payment can be taken through it,
    // and the person needs to know not to try again immediately.
    return {
      ok: false,
      code: "network",
      message:
        "The payment window couldn't load. Nothing was charged — this is usually a blocked script or an offline device.",
    };
  }

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const settle = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const instance = new window.Razorpay!({
      key: order.keyId,
      amount: order.amountMinor,
      currency: order.currency,
      name: "Orindle",
      description: `${input.planName} plan, billed ${input.period}`,
      order_id: order.orderId,
      theme: { color: "#3178FB" },

      handler: (response) => {
        // 3. The server decides. The callback firing is not evidence of payment.
        void (async () => {
          try {
            const verify = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const payload = (await verify.json().catch(() => null)) as
              | { ok?: boolean; message?: string; code?: string }
              | null;

            if (payload?.ok) {
              settle({ ok: true, planId: input.planId });
              return;
            }

            settle({
              ok: false,
              code: payload?.code ?? "unknown",
              message:
                payload?.message ??
                "We couldn't confirm that payment. If you were charged, contact us.",
            });
          } catch {
            settle({
              ok: false,
              code: "network",
              // Explicitly do NOT say the payment failed: it may well have
              // succeeded and the confirmation simply did not arrive.
              message:
                "We couldn't confirm that payment. If you were charged, contact us and we'll sort it out.",
            });
          }
        })();
      },

      modal: {
        ondismiss: () =>
          settle({
            ok: false,
            code: "cancelled",
            message: "Checkout was closed. Nothing was charged.",
          }),
      },
    });

    // Razorpay reports asynchronous failures (a declined card, a network drop) on
    // the instance itself rather than through an exception.
    instance.on("payment.failed", (arg) => {
      const error = (arg as { error?: { description?: string } })?.error;
      settle({
        ok: false,
        code: "failed",
        message: error?.description ?? "That payment didn't go through. Nothing was charged.",
      });
    });

    instance.open();
  });
}

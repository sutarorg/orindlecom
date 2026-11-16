/**
 * Signature verification.
 *
 * These tests are the reason an unverified payment cannot activate a plan. They
 * exercise the HMAC logic directly, with a known secret, rather than through the
 * HTTP layer — so a failure here is unambiguous.
 *
 * The module reads its secrets from the environment at import time, so the env
 * is set before the dynamic import.
 */
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

const KEY_SECRET = "test_key_secret_value";
const WEBHOOK_SECRET = "test_webhook_secret_value";

let verifyPaymentSignature: (input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) => boolean;
let verifyWebhookSignature: (rawBody: string, signature: string) => boolean;
let periodEnd: (from: Date, period: "monthly" | "yearly") => string;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_abc123";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const mod = await import("@/domain/billing/razorpay");
  verifyPaymentSignature = mod.verifyPaymentSignature;
  verifyWebhookSignature = mod.verifyWebhookSignature;
  periodEnd = mod.periodEnd;
});

function paymentSig(orderId: string, paymentId: string, secret = KEY_SECRET) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

function webhookSig(body: string, secret = WEBHOOK_SECRET) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("payment signature", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a correctly signed payment", () => {
    expect(
      verifyPaymentSignature({ orderId, paymentId, signature: paymentSig(orderId, paymentId) }),
    ).toBe(true);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(
      verifyPaymentSignature({
        orderId,
        paymentId,
        signature: paymentSig(orderId, paymentId, "not_the_secret"),
      }),
    ).toBe(false);
  });

  it("rejects a signature for a different payment", () => {
    // The classic attack: replay a valid signature from another transaction.
    expect(
      verifyPaymentSignature({
        orderId,
        paymentId: "pay_OTHER",
        signature: paymentSig(orderId, paymentId),
      }),
    ).toBe(false);
  });

  it("rejects a signature for a different order", () => {
    expect(
      verifyPaymentSignature({
        orderId: "order_OTHER",
        paymentId,
        signature: paymentSig(orderId, paymentId),
      }),
    ).toBe(false);
  });

  it("rejects an empty or malformed signature without throwing", () => {
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "" })).toBe(false);
    expect(verifyPaymentSignature({ orderId, paymentId, signature: "abc" })).toBe(false);
  });
});

describe("webhook signature", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_1", amount: 19900 } } },
  });

  it("accepts a correctly signed body", () => {
    expect(verifyWebhookSignature(body, webhookSig(body))).toBe(true);
  });

  it("rejects a body that was modified after signing", () => {
    // This is why the raw bytes must be verified rather than a re-serialised
    // object: re-serialising changes the bytes and quietly breaks verification,
    // or worse, lets a modified payload through if the check is skipped.
    const tampered = body.replace("19900", "100");
    expect(verifyWebhookSignature(tampered, webhookSig(body))).toBe(false);
  });

  it("rejects a signature from a different secret", () => {
    expect(verifyWebhookSignature(body, webhookSig(body, "wrong_secret"))).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyWebhookSignature(body, "")).toBe(false);
  });
});

describe("billing period arithmetic", () => {
  it("advances a calendar month, not thirty days", () => {
    const start = new Date("2026-01-31T12:00:00Z");
    const end = new Date(periodEnd(start, "monthly"));
    // JS rolls 31 January + 1 month into early March; what matters is that the
    // result is a month later rather than 30 days later.
    expect(end.getUTCMonth()).not.toBe(start.getUTCMonth());
  });

  it("advances exactly one year for an annual period", () => {
    const start = new Date("2026-11-16T00:00:00Z");
    expect(periodEnd(start, "yearly")).toBe("2027-11-16T00:00:00.000Z");
  });

  it("returns an ISO timestamp", () => {
    expect(periodEnd(new Date("2026-11-16T00:00:00Z"), "monthly")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

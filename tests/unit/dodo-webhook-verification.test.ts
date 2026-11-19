/**
 * Dodo webhook signature verification.
 *
 * These tests are the reason an unverified webhook cannot activate a plan.
 *
 * Dodo follows the Standard Webhooks specification: the signed content is
 * `{webhook-id}.{webhook-timestamp}.{raw-body}`, signed with HMAC-SHA256 using
 * the base64-decoded secret (minus any `whsec_` prefix), and compared in
 * constant time. The timestamp must be within five minutes.
 *
 * The tests build signatures by hand rather than by calling the SDK, so a
 * change in the SDK's behaviour cannot quietly make the tests agree with a
 * broken implementation.
 */
import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * A webhook signing secret in the shape Dodo issues: the `whsec_` prefix
 * followed by base64. The bytes after the prefix are the HMAC key, so the
 * secret has to be valid base64 — a malformed one is a configuration error,
 * not a signature failure.
 */
const WEBHOOK_SECRET_BYTES = "test_signing_key_value_0123456789ab";
const WEBHOOK_KEY = `whsec_${Buffer.from(WEBHOOK_SECRET_BYTES, "utf8").toString("base64")}`;

const RAW_BODY = JSON.stringify({
  business_id: "bus_test",
  type: "payment.succeeded",
  timestamp: "2026-01-15T10:30:00Z",
  data: { payload_type: "Payment", payment_id: "pay_123", total_amount: 109 },
});

let verifyWebhook: (
  rawBody: string,
  headers: Record<string, string>,
) => { webhookId: string; type: string; businessId: string | null; data: Record<string, unknown> };

beforeAll(async () => {
  process.env.DODO_PAYMENTS_API_KEY = "test_api_key";
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  process.env.DODO_PAYMENTS_ENVIRONMENT = "test";
  const mod = await import("@/domain/billing/dodo");
  verifyWebhook = mod.verifyWebhook as typeof verifyWebhook;
});

/** The Standard Webhooks signed payload. */
function signedContent(id: string, timestamp: string, body: string): string {
  return `${id}.${timestamp}.${body}`;
}

function signature(secret: string, id: string, timestamp: string, body: string): string {
  // The secret is base64 after the `whsec_` prefix is removed.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", key)
    .update(signedContent(id, timestamp, body))
    .digest("base64");
  return `v1,${digest}`;
}

/** A signature made with a *different* but equally valid secret. */
function otherSignature(id: string, timestamp: string, body: string): string {
  const otherBytes = "a_completely_different_signing_key_000";
  const key = Buffer.from(otherBytes, "utf8");
  const digest = createHmac("sha256", key)
    .update(signedContent(id, timestamp, body))
    .digest("base64");
  return `v1,${digest}`;
}

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000));
}

describe("Dodo webhook verification", () => {
  it("accepts a correctly signed payload", () => {
    const id = "msg_1";
    const timestamp = nowSeconds();
    const event = verifyWebhook(RAW_BODY, {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature(WEBHOOK_KEY, id, timestamp, RAW_BODY),
    });

    expect(event.webhookId).toBe(id);
    expect(event.type).toBe("payment.succeeded");
    expect(event.businessId).toBe("bus_test");
    expect(event.data.payment_id).toBe("pay_123");
  });

  it("rejects a body that was modified after signing", () => {
    // This is the raw-body test. The signature covers the exact bytes; if the
    // handler parsed and re-serialised the JSON, the bytes would change and
    // either break verification or, worse, let a modified payload through.
    const id = "msg_2";
    const timestamp = nowSeconds();
    const tampered = RAW_BODY.replace("109", "1");

    expect(() =>
      verifyWebhook(tampered, {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature(WEBHOOK_KEY, id, timestamp, RAW_BODY),
      }),
    ).toThrow();
  });

  it("rejects a signature made with a different secret", () => {
    const id = "msg_3";
    const timestamp = nowSeconds();

    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": otherSignature(id, timestamp, RAW_BODY),
      }),
    ).toThrow();
  });

  it("rejects a missing webhook-id", () => {
    const timestamp = nowSeconds();
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-timestamp": timestamp,
        "webhook-signature": signature(WEBHOOK_KEY, "msg_4", timestamp, RAW_BODY),
      }),
    ).toThrow();
  });

  it("rejects a missing webhook-signature", () => {
    const id = "msg_5";
    const timestamp = nowSeconds();
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
      }),
    ).toThrow();
  });

  it("rejects a missing webhook-timestamp", () => {
    const id = "msg_6";
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": id,
        "webhook-signature": signature(WEBHOOK_KEY, id, nowSeconds(), RAW_BODY),
      }),
    ).toThrow();
  });

  it("rejects an empty signature", () => {
    const id = "msg_7";
    const timestamp = nowSeconds();
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": "",
      }),
    ).toThrow();
  });

  it("rejects a stale timestamp", () => {
    // The replay window. An old, correctly-signed event must not be accepted.
    const id = "msg_8";
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": id,
        "webhook-timestamp": timestamp,
        "webhook-signature": signature(WEBHOOK_KEY, id, timestamp, RAW_BODY),
      }),
    ).toThrow();
  });

  it("rejects a signature computed for a different webhook id", () => {
    const timestamp = nowSeconds();
    expect(() =>
      verifyWebhook(RAW_BODY, {
        "webhook-id": "msg_9",
        "webhook-timestamp": timestamp,
        "webhook-signature": signature(WEBHOOK_KEY, "msg_other", timestamp, RAW_BODY),
      }),
    ).toThrow();
  });

  it("never explains why a signature was rejected", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/domain/billing/dodo.ts"),
      "utf8",
    );
    // A precise reason helps an attacker tune a forgery.
    expect(source).toContain('throw new AppError("forbidden", "Invalid signature.")');
  });
});

describe("the webhook route", () => {
  it("reads the raw body before parsing it", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/webhooks/dodo/route.ts"),
      "utf8",
    );
    expect(source).toContain("await request.text()");
  });

  it("stores the event before acknowledging it", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/webhooks/dodo/route.ts"),
      "utf8",
    );
    const insertAt = source.indexOf('from("webhook_events")');
    const ackAt = source.indexOf("NextResponse.json({ ok: true, data: { processed");
    expect(insertAt).toBeGreaterThan(-1);
    expect(ackAt).toBeGreaterThan(insertAt);
  });

  it("acknowledges a duplicate delivery without reprocessing it", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/webhooks/dodo/route.ts"),
      "utf8",
    );
    expect(source).toContain('"23505"');
    expect(source).toContain("duplicate: true");
  });

  it("answers a missing webhook key with 503 and activates nothing", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/webhooks/dodo/route.ts"),
      "utf8",
    );
    expect(source).toContain("isDodoWebhookConfigured()");
    expect(source).toContain("status: 503");
  });

  it("never activates a plan from a metadata user id alone", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await readFile(
      path.join(process.cwd(), "src/app/api/webhooks/dodo/route.ts"),
      "utf8",
    );
    // The owner comes from the pending checkout row, not from metadata.
    expect(source).toContain("resolvePendingCheckout");
    expect(source).not.toMatch(/orindle_user_id/);
  });
});

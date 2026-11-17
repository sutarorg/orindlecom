/**
 * Provider error mapping.
 *
 * `mapProviderError` decides the sentence a visitor sees when signup or sign-in
 * fails, so its ordering is a product decision, not an implementation detail. The
 * cases here are the ones that were actually observed or plausibly reachable; the
 * point of asserting them is that a reordering of the early-return chain silently
 * changes what people are told.
 *
 * The regression this file exists for: a failure to *send* the confirmation email
 * used to fall through to "Something went wrong on our side." That message is
 * false in both directions — nothing went wrong inside the app, and the account
 * was in fact created — and it gave the visitor no action to take.
 */
import { describe, expect, it, vi } from "vitest";

import { mapProviderError } from "@/lib/auth/supabase/errors";

describe("mapProviderError", () => {
  it("maps a confirmation-email delivery failure to its own code", () => {
    // Shape GoTrue returns when SMTP is unconfigured or rejecting.
    const result = mapProviderError({
      code: "unexpected_failure",
      status: 500,
      message: "Error sending confirmation email",
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_delivery_failed");
    // Must not promise a retry that cannot work, and must not send the visitor
    // looking for a confirmation email that was never sent.
    expect(result.message).not.toMatch(/try again/i);
    expect(result.message).toMatch(/created your account/i);
  });

  it("does not mistake a delivery failure for an unconfirmed account", () => {
    // Both messages mention email; the delivery failure must win, because the
    // other mapping points at a link that does not exist.
    const result = mapProviderError({
      code: "unexpected_failure",
      status: 500,
      message: "Error sending confirmation email",
    });

    expect(result.code).not.toBe("email_not_confirmed");
  });

  it("still maps email_not_confirmed for a genuinely unconfirmed account", () => {
    const result = mapProviderError({
      code: "email_not_confirmed",
      status: 400,
      message: "Email not confirmed",
    });

    expect(result.code).toBe("email_not_confirmed");
  });

  it("keeps rate limiting ahead of message-based matches", () => {
    const result = mapProviderError({
      status: 429,
      message: "Email rate limit exceeded",
    });

    expect(result.code).toBe("rate_limited");
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("logs an unmapped error instead of swallowing it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = mapProviderError({ code: "brand_new_code", status: 500 });

    expect(result.code).toBe("unknown");
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls.flat().join(" ");
    // The code and status are what make a new failure mode identifiable from logs.
    expect(logged).toContain("brand_new_code");

    spy.mockRestore();
  });
});

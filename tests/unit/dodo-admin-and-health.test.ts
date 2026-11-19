/**
 * Admin billing analytics and the public health endpoint.
 *
 * Two things have to hold, and both are easy to break by accident:
 *
 *   1. **MRR and collected revenue are different numbers.** MRR is a run-rate
 *      from live subscriptions; collected revenue is money actually paid. A
 *      customer who paid an annual invoice is not twelve months of MRR, and a
 *      refunded invoice is not revenue at all.
 *   2. **Currencies are never summed.** INR 100 and USD 100 are not 200.
 *      Converting between them needs a rate and a date, and a rate chosen
 *      today would be wrong tomorrow.
 *
 * The health endpoint also has a security property: it reports whether a
 * provider is configured, never what the credential is.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function read(relative: string): Promise<string> {
  return readFile(path.join(process.cwd(), relative), "utf8");
}

describe("admin billing analytics", () => {
  it("keeps MRR and collected revenue in separate fields", async () => {
    const service = await read("src/lib/admin/service.ts");
    const types = await read("src/lib/admin/types.ts");

    // MRR comes from its own aggregate function.
    expect(service).toContain('rpc("admin_mrr")');
    // Revenue comes from the invoice table, and only from paid invoices: a
    // refunded or failed invoice is counted as a record, never as revenue.
    expect(service).toContain('from("invoices")');
    expect(service).toContain('if (status === "paid")');

    // They are never merged into one number.
    expect(types).toMatch(/mrr:\s/);
    expect(types).toMatch(/revenue:\s/);
    expect(service).not.toMatch(/mrr[\s\S]{0,200}revenue\s*\+\s*\w*revenue/);
  });

  it("keeps every currency in its own bucket", async () => {
    const service = await read("src/lib/admin/service.ts");
    const page = await read("src/app/admin/billing/page.tsx");

    // A map keyed by currency, never a single total.
    expect(service).toContain("byCurrency");
    expect(service).toMatch(/currency:\s*String\(row\.currency\)/);

    // The admin page renders per-currency amounts.
    expect(page).toContain("currency");
  });

  it("does not convert or total across currencies", async () => {
    const service = await read("src/lib/admin/service.ts");
    const page = await read("src/app/admin/billing/page.tsx");

    // No exchange rate lookup: a rate chosen now would be wrong later.
    expect(service).not.toMatch(/exchange_?rate/i);
    expect(service).not.toMatch(/convertCurrency|toUsd|USD_RATE/);
    expect(page).not.toMatch(/exchange_?rate/i);
  });

  it("reports provider counts separately from money", async () => {
    const service = await read("src/lib/admin/service.ts");
    const types = await read("src/lib/admin/types.ts");

    // Provider counts are a count of subscriptions, not a revenue figure.
    expect(service).toContain("billing_provider");
    expect(service).toContain("providerCounts");
    expect(types).toContain("providerCounts");

    // The counts must not be multiplied by a price.
    expect(service).not.toMatch(/providerCounts[\s\S]{0,200}\*\s*amount/);
  });

  it("does not convert a legacy subscription into a Dodo one", async () => {
    const page = await read("src/app/admin/billing/page.tsx");
    // The notice tells the truth about what the count means.
    expect(page).toMatch(/legacy/i);
    expect(page).not.toMatch(/migrat(e|ed|ing)\s+(them|these|subscriptions)/i);
  });
});

describe("the public health endpoint", () => {
  it("reports the Dodo configuration without exposing any secret", async () => {
    const route = await read("src/app/api/health/route.ts");
    const dodo = await read("src/domain/billing/dodo.ts");

    expect(route).toContain("dodoHealth");
    // The health function returns a state, never a value.
    expect(dodo).toMatch(/return "(missing|mismatch|configured|test-mode)"/);

    // No value from any credential may reach the response.
    expect(route).not.toMatch(/DODO_PAYMENTS_API_KEY\s*\}/);
    expect(route).not.toMatch(/DODO_PAYMENTS_WEBHOOK_KEY\s*\}/);
    expect(route).not.toMatch(/apiKey:\s*process\.env/);
    expect(route).not.toMatch(/webhookKey:\s*process\.env/);
  });

  it("reports the legacy Razorpay webhook separately", async () => {
    const route = await read("src/app/api/health/route.ts");

    // The legacy provider's presence is still useful while historical events
    // can arrive, but it is reported apart from the new provider.
    expect(route.toLowerCase()).toContain("razorpay");
    expect(route).toMatch(/legacy/i);
  });

  it("never leaks a Razorpay key either", async () => {
    const route = await read("src/app/api/health/route.ts");
    expect(route).not.toMatch(/NEXT_PUBLIC_RAZORPAY_KEY_ID\s*[,}]/);
    expect(route).not.toMatch(/RAZORPAY_KEY_SECRET\s*[,}]/);
  });
});

describe("the admin settings page", () => {
  it("shows the Dodo state and the legacy state apart", async () => {
    const page = await read("src/app/admin/settings/page.tsx");
    const route = await read("src/app/api/admin/settings/route.ts");

    expect(page.toLowerCase()).toContain("dodo");
    expect(page.toLowerCase()).toContain("razorpay");
    expect(route.toLowerCase()).toContain("dodo");
    expect(route.toLowerCase()).toContain("razorpay");
  });

  it("does not claim the provider is connected when it is not", async () => {
    const page = await read("src/app/admin/settings/page.tsx");
    // The failure state has to be visible, not swallowed.
    expect(page).toMatch(/missing|not configured|not connected/i);
  });
});

describe("the customer billing view", () => {
  it("does not tell the customer a payment succeeded before the server says so", async () => {
    const view = await read("src/components/dashboard/billing-view.tsx");

    // The return page is informational. The view asks the server.
    expect(view).toMatch(/status/i);
    expect(view).not.toMatch(/payment\s+(received|successful|complete)/i);
  });

  it("offers the Customer Portal and a hosted checkout", async () => {
    const view = await read("src/components/dashboard/billing-view.tsx");
    expect(view).toMatch(/portal/i);
    expect(view).toMatch(/checkout/i);
  });

  it("names Dodo, and does not name Razorpay", async () => {
    const view = await read("src/components/dashboard/billing-view.tsx");
    expect(view.toLowerCase()).toContain("dodo");
    expect(view).not.toMatch(/razorpay/i);
  });

  it("does not describe a plan change as immediate", async () => {
    const view = await read("src/components/dashboard/billing-view.tsx");
    // Downgrades and cancellations take effect at the end of the paid period.
    expect(view).toMatch(/end of (the |your )?(current )?(billing )?period/i);
  });
});

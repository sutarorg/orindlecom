/**
 * Approved legal documents, transactional email templates, and upload limits.
 *
 * Ensures:
 *  - Every published legal document is approved with zero unresolved placeholders.
 *  - Every registered transactional email template renders both HTML and text and
 *    escapes untrusted user input.
 *  - Upload policy enforces no fixed per-file cap (quota-bound) with dynamic
 *    multipart part sizing respecting R2's 10,000-part limit.
 */
import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_REVIEW_ITEM_COUNT } from "@/config/legal";
import { PLACEHOLDER_VALUES } from "@/config/legal/placeholders";
import { EMAIL_TEMPLATES, renderTemplate } from "@/lib/resend/client";
import { TRASH_RETENTION, UPLOAD_LIMITS } from "@/lib/drive/types";
import { computeMultipartPartSize } from "@/domain/storage/upload-service";

describe("approved legal documents", () => {
  it("marks all five legal documents approved with zero lawyer review flags", () => {
    expect(LEGAL_DOCUMENTS).toHaveLength(5);
    expect(LEGAL_REVIEW_ITEM_COUNT).toBe(0);
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.approved, `${doc.id} should be approved`).toBe(true);
      expect(doc.updated).toBe("2026-11-16");
    }
  });

  it("populates every legal placeholder value with a non-empty approved string", () => {
    for (const [key, value] of Object.entries(PLACEHOLDER_VALUES)) {
      expect(typeof value, key).toBe("string");
      expect((value ?? "").trim().length, `${key} should not be empty`).toBeGreaterThan(0);
    }
  });
});

describe("transactional email templates", () => {
  it("renders every registered template with subject, html, and text", () => {
    expect(EMAIL_TEMPLATES.length).toBeGreaterThanOrEqual(21);
    const sampleData: Record<string, string> = {
      name: "Tejas <script>alert(1)</script>",
      inviter: "Alex & Co",
      actor: "Owner",
      organization: "Orindle Studio",
      role: "admin",
      previousRole: "member",
      newRole: "admin",
      url: "https://orindle.com/dashboard/business?invite=abc123",
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      plan: "Premium",
      amount: "₹1,099",
      currency: "INR",
      period: "Monthly",
      paymentId: "pay_123456",
      nextDate: "2026-12-16",
      endsOn: "2026-12-16",
      daysRemaining: "7",
      usagePct: "85",
      used: "850 GB",
      quota: "1 TB",
      referenceId: "SUP-001",
      originalMessage: "Hello <b>support</b>",
      reply: "Thanks for writing!",
    };

    for (const template of [...EMAIL_TEMPLATES, "subscription-expiring-7"]) {
      const rendered = renderTemplate(template, sampleData);
      expect(rendered, `template "${template}" failed to render`).not.toBeNull();
      expect(rendered!.subject.length, `${template} subject`).toBeGreaterThan(0);
      expect(rendered!.html.length, `${template} html`).toBeGreaterThan(0);
      expect(rendered!.text.length, `${template} text`).toBeGreaterThan(0);
      // Untrusted HTML tags must never appear unescaped in rendered email HTML
      expect(rendered!.html).not.toContain("<script>alert(1)</script>");
      expect(rendered!.html).not.toContain("<b>support</b>");
    }
  });
});

describe("upload & trash policy", () => {
  it("uses quota-bound uploads with approved 30-day trash retention", () => {
    expect(UPLOAD_LIMITS.maxFileSize).toBeNull();
    expect(TRASH_RETENTION.days).toBe(30);
    expect(TRASH_RETENTION.approved).toBe(true);
  });

  it("scales multipart part size to stay within 10,000 parts for multi-TB files", () => {
    const eightMiB = 8 * 1024 * 1024;
    // Small multipart file (100 MB) uses default 8 MiB part size
    expect(computeMultipartPartSize(100 * 1024 * 1024)).toBe(eightMiB);

    // 5 TB file must scale part size so total parts <= 10,000
    const fiveTb = 5_000_000_000_000;
    const partSize = computeMultipartPartSize(fiveTb);
    expect(Math.ceil(fiveTb / partSize)).toBeLessThanOrEqual(10_000);
    expect(partSize).toBeGreaterThanOrEqual(eightMiB);
  });
});

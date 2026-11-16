/**
 * Email queue invariants.
 *
 * These pin three properties the queue got wrong before, each of which failed
 * silently — a warning that was never sent, a retry that rendered an empty
 * template, and a duplicate check that suppressed mail for the wrong people.
 * Silent is the operative word: nothing crashed, no page broke, and the only
 * symptom would have been customers not being told their plan was ending.
 *
 * The database half runs against a real engine because the dedupe guarantee is an
 * index, not a check in application code. A SELECT-then-INSERT can be raced; a
 * unique index cannot.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createTestDb } from "./harness";

const ROOT = path.resolve(__dirname, "..", "..");

async function source(...parts: string[]): Promise<string> {
  return readFile(path.join(ROOT, ...parts), "utf8");
}

/**
 * Source with comments removed.
 *
 * A pattern that looks for a call will otherwise find the comment explaining why
 * that call was removed, and report the opposite of the truth. This happened
 * while writing these tests, which is the argument for the helper.
 */
async function code(...parts: string[]): Promise<string> {
  const raw = await source(...parts);
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("email_log dedupe", () => {
  it("refuses a second row with the same dedupe key", async () => {
    const db = await createTestDb();

    await db.asService(
      `insert into public.email_log (to_address, template, status, dedupe_key)
       values ('a@example.com', 'subscription-expiring-7', 'queued', 'k-1')`,
    );

    await expect(
      db.asService(
        `insert into public.email_log (to_address, template, status, dedupe_key)
         values ('a@example.com', 'subscription-expiring-7', 'queued', 'k-1')`,
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("allows the same notification for two different recipients", async () => {
    const db = await createTestDb();

    // The bug this replaces: dedupe asked "has any row used this template?", so
    // the second customer was suppressed. The key carries the recipient.
    await db.asService(
      `insert into public.email_log (to_address, template, status, dedupe_key)
       values ('a@example.com', 'subscription-expiring-7', 'queued', 'subscription-expiring-7:a')`,
    );
    await db.asService(
      `insert into public.email_log (to_address, template, status, dedupe_key)
       values ('b@example.com', 'subscription-expiring-7', 'queued', 'subscription-expiring-7:b')`,
    );

    const rows = await db.asService<{ count: number }>(
      `select count(*)::int as count from public.email_log
       where template = 'subscription-expiring-7'`,
    );

    expect(rows[0].count).toBe(2);
  });

  it("allows many rows with no dedupe key at all", async () => {
    const db = await createTestDb();

    // Ordinary transactional mail (a password reset someone asked for twice) has
    // no natural key. The partial index must not turn nulls into a collision.
    for (let i = 0; i < 3; i += 1) {
      await db.asService(
        `insert into public.email_log (to_address, template, status)
         values ('a@example.com', 'reset-password', 'sent')`,
      );
    }

    const rows = await db.asService<{ count: number }>(
      `select count(*)::int as count from public.email_log where dedupe_key is null`,
    );

    expect(rows[0].count).toBe(3);
  });

  it("stores the payload a retry needs to render", async () => {
    const db = await createTestDb();

    await db.asService(
      `insert into public.email_log (to_address, template, status, payload)
       values ('a@example.com', 'subscription-expiring-7', 'queued',
               '{"date":"2027-01-14","name":"Asha"}'::jsonb)`,
    );

    const rows = await db.asService<{ payload: Record<string, string> }>(
      `select payload from public.email_log where template = 'subscription-expiring-7'`,
    );

    expect(rows[0].payload).toMatchObject({ date: "2027-01-14", name: "Asha" });
  });

  it("gives a row no payload by default rather than a null", async () => {
    const db = await createTestDb();

    await db.asService(
      `insert into public.email_log (to_address, template, status)
       values ('a@example.com', 'password-changed', 'sent')`,
    );

    const rows = await db.asService<{ payload: unknown }>(
      `select payload from public.email_log where template = 'password-changed'`,
    );

    // `{}` rather than null: the retry job spreads this straight into the template
    // data, and null there is a crash for a row that is otherwise fine.
    expect(rows[0].payload).toEqual({});
  });

  it("only accepts the three documented statuses", async () => {
    const db = await createTestDb();

    await expect(
      db.asService(
        `insert into public.email_log (to_address, template, status)
         values ('a@example.com', 'password-changed', 'pending')`,
      ),
    ).rejects.toThrow(/check constraint|email_log_status_check/i);
  });
});

describe("email jobs", () => {
  it("sends queued rows, not only failed ones", async () => {
    const retry = await code("src", "app", "api", "cron", "email-retry", "route.ts");

    // A queued row that only a failed-row reader ever looks at is never sent.
    // The subscription sweep writes queued rows; this job has to read them.
    expect(retry).toMatch(/\.eq\("status",\s*"queued"\)/);
    expect(retry).toMatch(/\.eq\("status",\s*"failed"\)/);
  });

  it("renders from the stored payload instead of an empty object", async () => {
    const retry = await code("src", "app", "api", "cron", "email-retry", "route.ts");

    expect(retry).toMatch(/row\.payload/);
    // The exact regression: a hard-coded empty payload.
    expect(retry).not.toMatch(/data:\s*\{\s*\}/);
  });

  it("resolves a real address before queueing a warning", async () => {
    const sweep = await code(
      "src", "app", "api", "cron", "subscription-sweep", "route.ts",
    );

    expect(sweep).toMatch(/auth\.admin\.getUserById/);
    // A placeholder address can never be sent to.
    expect(sweep).not.toContain("pending-resolution");
  });

  it("scopes duplicate suppression to the subscriber", async () => {
    const sweep = await code(
      "src", "app", "api", "cron", "subscription-sweep", "route.ts",
    );

    expect(sweep).toMatch(/dedupe_key:/);
    expect(sweep).toMatch(/owner_id/);
    // The old check asked whether anyone had been sent this template.
    expect(sweep).not.toMatch(/\.eq\("template",\s*`subscription-expiring/);
  });

  it("treats a unique violation as an already-sent warning", async () => {
    const sweep = await code(
      "src", "app", "api", "cron", "subscription-sweep", "route.ts",
    );

    // Concurrent runs are expected; 23505 is the index winning the race, and the
    // job should not report a failure for it.
    expect(sweep).toContain("23505");
  });
});

describe("email templates", () => {
  it("renders every built template with a plain-text alternative", async () => {
    const { renderTemplate } = await import("@/lib/resend/client");

    const built = [
      "verify-email",
      "reset-password",
      "password-changed",
      "org-invite",
      "invite-accepted",
      "storage-warning-80",
      "subscription-started",
      "payment-failed",
      "subscription-cancelled",
      "subscription-expiring-7",
      "account-deletion-requested",
      "account-deleted",
      "support-received",
    ];

    for (const template of built) {
      const rendered = renderTemplate(template, { url: "https://example.com/x" });
      expect(rendered, template).not.toBeNull();
      expect(rendered!.subject.length, template).toBeGreaterThan(0);
      expect(rendered!.html.length, template).toBeGreaterThan(0);
      expect(rendered!.text.length, template).toBeGreaterThan(0);
    }
  });

  it("returns null for a template it does not know", async () => {
    const { renderTemplate } = await import("@/lib/resend/client");

    // Returning a half-empty template for an unknown name would send a customer a
    // blank email and log it as delivered.
    expect(renderTemplate("not-a-template", {})).toBeNull();
  });

  it("escapes interpolated values", async () => {
    const { renderTemplate } = await import("@/lib/resend/client");

    const rendered = renderTemplate("invite-accepted", {
      name: '<script>alert(1)</script>',
      organization: "Acme",
    });

    expect(rendered!.html).not.toContain("<script>");
    expect(rendered!.html).toContain("&lt;script&gt;");
  });
});

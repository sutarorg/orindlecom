/**
 * The share-invitation email, as source assertions.
 *
 * The production failure this guards: every invitation reported "Email isn't
 * configured", while `/api/health` said the provider *was* configured. Both cannot be
 * true, and the message sent anyone reading it to the wrong place. Two separate
 * defects had to be fixed, and both are asserted here because both are one line away
 * from coming back:
 *
 *   1. The request carried a `reply_to` on the operator's gmail address while the
 *      sender was `onboarding@resend.dev`. Resend rejects a reply-to domain it has not
 *      verified, so the send failed with a 4xx.
 *   2. The dialog turned every possible failure into the same sentence about
 *      configuration, discarding the provider's actual reason.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

describe("the outbound email request", () => {
  const client = read("src/lib/resend/client.ts");

  it("does not set a reply-to on an unverified domain", () => {
    // A header that bought nothing and broke every send.
    expect(client).not.toMatch(/reply_to:/);
  });

  it("still reports the support address, as text", () => {
    expect(client).toMatch(/SUPPORT_INBOX/);
  });

  it("keeps the provider's own error message", () => {
    // The raw body is the only place the reason appears.
    expect(client).toMatch(/function describeFailure/);
    expect(client).toMatch(/Resend \$\{status\}/);
  });

  it("never returns success without a provider message id", () => {
    expect(client).toMatch(/Resend returned no message id/);
  });
});

describe("what the owner is told when a send fails", () => {
  const dialog = read("src/components/dashboard/share-dialog.tsx");
  const route = read("src/app/api/files/[id]/grants/route.ts");

  it("carries the delivery error through the API", () => {
    expect(route).toMatch(/deliveryError: invitation\.deliveryError/);
  });

  it("does not claim the provider is unconfigured", () => {
    expect(dialog).not.toMatch(/Email isn't configured, so copy/);
    expect(dialog).toMatch(/deliveryError/);
  });

  it("still hands over a working link when the mail did not go", () => {
    expect(route).toMatch(/inviteUrl: invitation\.delivered \? null : invitation\.url/);
  });
});

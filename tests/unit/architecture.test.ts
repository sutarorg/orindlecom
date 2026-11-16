/**
 * Architectural invariants.
 *
 * These are the rules that keep the layering honest over time. They are cheap to
 * check and easy to break by accident — a single `import { headers } from
 * "next/headers"` inside a service would quietly destroy the property that the
 * domain layer cannot see a request at all.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(process.cwd(), "src");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

async function read(file: string): Promise<string> {
  return readFile(file, "utf8");
}

describe("domain layer", () => {
  it("never imports a request object", async () => {
    const files = await walk(path.join(SRC, "domain"));
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = await read(file);
      // The domain layer receives an Actor. It cannot see a request, so it cannot
      // accidentally read a user id out of one.
      expect(source, `${file} must not import next/headers`).not.toMatch(
        /from\s+["']next\/headers["']/,
      );
      expect(source, `${file} must not take a NextRequest`).not.toMatch(
        /\bNextRequest\b/,
      );
    }
  });

  it("never accepts a caller-supplied user id as an authorization input", async () => {
    const files = await walk(path.join(SRC, "domain"));
    for (const file of files) {
      const source = await read(file);
      // A `userId` parameter is only acceptable when it is the *actor* being
      // passed in by the HTTP layer, which is why the Actor type exists. What must
      // not appear is reading one from a request body.
      expect(source, `${file} must not parse userId from a body`).not.toMatch(
        /body\.userId|body\[["']userId["']\]/,
      );
    }
  });
});

describe("server-only boundaries", () => {
  it("every module holding a secret is marked server-only", async () => {
    // These files read privileged credentials. If one loses its marker, Next will
    // happily inline it into a client bundle.
    const files = [
      "src/lib/supabase/service.ts",
      "src/lib/r2/client.ts",
      "src/lib/resend/client.ts",
      "src/domain/billing/razorpay.ts",
      "src/domain/storage/upload-service.ts",
      "src/domain/auth/actor.ts",
      "src/lib/api.ts",
    ];

    for (const relative of files) {
      const source = await read(path.resolve(process.cwd(), relative));
      expect(source, `${relative} must import server-only`).toMatch(
        /import\s+["']server-only["']/,
      );
    }
  });
});

describe("truthfulness in the UI contract", () => {
  it("no component renders a hard-coded success for a write", async () => {
    // The failure mode this guards against is a component that reports success
    // without awaiting a result. Every `toast({ tone: "success"` in the codebase
    // must be reachable only after a resolved call — which is a judgement call,
    // so this asserts the narrower, checkable thing: no component claims a
    // payment went through.
    const files = await walk(path.join(SRC, "components"));
    for (const file of files) {
      const source = await read(file);
      expect(source, `${file} must not claim payment success`).not.toMatch(
        /payment (was )?successful/i,
      );
      expect(source, `${file} must not claim a charge succeeded`).not.toMatch(
        /charge succeeded|payment received/i,
      );
    }
  });
});

describe("expiry never deletes files", () => {
  it("no billing or subscription code sets deleted_at", async () => {
    // The requirement is explicit: never delete on expiry. This is the check that
    // keeps it true as the code grows.
    const candidates = [
      ...(await walk(path.join(SRC, "domain", "billing"))),
      path.resolve(SRC, "app/api/cron/subscription-sweep/route.ts"),
    ];

    for (const file of candidates) {
      const source = await read(file);
      expect(source, `${file} must not delete files on a billing event`).not.toMatch(
        /deleted_at\s*[:=]\s*new Date|deleted_at:\s*now\(\)/,
      );
      expect(source, `${file} must not call from("files").delete`).not.toMatch(
        /from\(["']files["']\)\s*\.delete/,
      );
    }
  });
});

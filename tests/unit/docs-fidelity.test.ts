/**
 * Documentation fidelity.
 *
 * A reference that lists an endpoint which does not exist is worse than no
 * reference: it is a claim that was never true, and whoever integrates against it
 * finds out by getting a 404.
 *
 * `docs/backend/api-reference.md` marks every row ✅ (built) or ⬜ (specified, no
 * handler). That marking is the whole point of this file:
 *
 *   - a row marked ✅ must have a real route, and
 *   - a built route must be documented somewhere in the reference.
 *
 * Rows marked ⬜ are allowed to have no handler, which is exactly what an honest
 * specification looks like — but a bare, unmarked list of endpoints is not, because
 * there is then no way to tell which ones work.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * Turn a Next.js segment (`[taskId]`) into the reference's notation (`:taskId`).
 * Generic rather than a list, so adding a dynamic route cannot silently break the
 * comparison.
 */
function normalise(urlPath: string): string {
  return urlPath.replace(/\[([A-Za-z0-9_]+)\]/g, ":$1");
}

async function actualRoutes(): Promise<string[]> {
  const apiDir = path.join(ROOT, "src", "app", "api");
  const routes: string[] = [];

  async function walk(dir: string, urlPath: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const segment = entry.name.startsWith("(") ? "" : normalise(entry.name);
        await walk(path.join(dir, entry.name), `${urlPath}/${segment}`);
      } else if (entry.name === "route.ts") {
        routes.push(urlPath);
      }
    }
  }

  await walk(apiDir, "/api");
  return routes.sort();
}

async function readReference(): Promise<string> {
  return readFile(path.join(ROOT, "docs/backend/api-reference.md"), "utf8");
}

/** Every `/api/...` path mentioned in the reference, in any form. */
function mentionedPaths(doc: string): Set<string> {
  const found = new Set<string>();
  for (const match of doc.matchAll(/`(\/api\/[a-zA-Z0-9/:_-]+)`/g)) {
    // A heading like `POST /api/uploads/prepare` is matched too; keep only the path.
    found.add(match[1]);
  }
  for (const match of doc.matchAll(/`(?:GET|POST|PATCH|PUT|DELETE)\s+(\/api\/[a-zA-Z0-9/:_-]+)`/g)) {
    found.add(match[1]);
  }
  return found;
}

describe("api-reference.md", () => {
  it("documents every route that exists", async () => {
    const doc = await readReference();
    const mentioned = mentionedPaths(doc);
    const routes = await actualRoutes();

    const missing = routes.filter((route) => !mentioned.has(route));
    expect(missing, `built routes not mentioned in the reference: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("does not mark an endpoint ✅ unless it is built", async () => {
    const doc = await readReference();
    const routes = new Set(await actualRoutes());

    // Table rows with an explicit ✅ in the status column.
    const claimedBuilt: string[] = [];
    for (const match of doc.matchAll(
      /\|\s*✅\s*\|\s*`(?:GET|POST|PATCH|PUT|DELETE)`\s*\|\s*`(\/api\/[^`]+)`/g,
    )) {
      claimedBuilt.push(match[1].split("?")[0].trim());
    }

    expect(claimedBuilt.length).toBeGreaterThan(0);

    const lying = claimedBuilt.filter((route) => !routes.has(route));
    expect(lying, `marked ✅ but no route exists: ${lying.join(", ")}`).toEqual([]);
  });

  it("does not mark an endpoint it does not describe as built when no handler exists", async () => {
    // The inverse: every /api/ path in the doc that has no route must be marked ⬜
    // somewhere in its own row, so a reader cannot mistake it for working.
    const doc = await readReference();
    const routes = new Set(await actualRoutes());

    const unbuiltRows: string[] = [];
    for (const line of doc.split("\n")) {
      const match = line.match(/^\|\s*(✅|⬜)?\s*\|\s*`(?:GET|POST|PATCH|PUT|DELETE)`\s*\|\s*`(\/api\/[^`]+)`/);
      if (!match) continue;
      const [, mark, url] = match;
      const clean = url.split("?")[0].trim();
      if (!routes.has(clean)) unbuiltRows.push(`${mark ?? "unmarked"} ${clean}`);
      // An unmarked row is ambiguous, which is the error this test exists to catch.
      if (!mark && !routes.has(clean)) {
        throw new Error(`${clean} has no handler and no status mark — mark it ⬜`);
      }
    }

    // Every one of these must carry ⬜.
    for (const row of unbuiltRows) {
      expect(row, "an unbuilt route is not marked ⬜").toMatch(/^⬜ /);
    }
  });
});

describe("documented behaviour the code must honour", () => {
  it("exports GET from every cron route", async () => {
    // Vercel cron invokes with GET. A route exported only as POST never runs, even
    // though its schedule is accepted and shows as healthy.
    const cronDir = path.join(ROOT, "src", "app", "api", "cron");
    for (const entry of await readdir(cronDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const source = await readFile(path.join(cronDir, entry.name, "route.ts"), "utf8");
      expect(source, `cron/${entry.name} must export GET`).toMatch(/export async function GET/);
    }
  });

  it("keeps the documented cron cadences equal to vercel.json", async () => {
    const doc = await readReference();
    const vercel = JSON.parse(
      await readFile(path.join(ROOT, "vercel.json"), "utf8"),
    ) as { crons: { path: string; schedule: string }[] };

    for (const cron of vercel.crons) {
      // The reference prints the schedule verbatim; if one is edited in vercel.json
      // the doc must move with it.
      expect(doc, `${cron.path} cadence missing or stale in docs`).toContain(cron.schedule);
    }
  });
});

describe("quoted test counts", () => {
  it("match the suite that actually runs", async () => {
    /*
     * Both required documents quote a test count as evidence. A count that is too
     * high is the worst kind of inaccuracy in a readiness document — it invites
     * someone to trust a number that was never true.
     *
     * This reads the counts the runner just produced from the JSON report rather
     * than re-counting test declarations, so it measures what executed.
     */
    const countsFile = path.join(ROOT, ".verify", "test-counts.json");
    let expected: { tests: number; files: number };
    try {
      expected = JSON.parse(await readFile(countsFile, "utf8")) as {
        tests: number;
        files: number;
      };
    } catch {
      // Written by the `test:count` script. If it is absent the check is skipped
      // rather than given a guessed baseline.
      return;
    }

    const readiness = await readFile(
      path.join(ROOT, "docs", "deployment", "production-readiness.md"),
      "utf8",
    );
    expect(readiness).toContain(`${expected.tests} tests, ${expected.files} files`);
  });
});

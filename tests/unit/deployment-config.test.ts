/**
 * Deployment configuration.
 *
 * These checks exist because both failures they catch are silent:
 *
 *   - A cron path in vercel.json that does not match a route never fires. The
 *     schedule looks healthy in the dashboard and the job simply never runs, so
 *     trash is never cleaned and expired reservations are never released.
 *   - An environment variable the code reads but the example omits is a variable
 *     nobody sets on a new deployment, which surfaces as a feature that quietly
 *     reports "not configured" forever.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

async function listRoutePaths(): Promise<string[]> {
  const apiDir = path.join(ROOT, "src", "app", "api");
  const routes: string[] = [];

  async function walk(dir: string, urlPath: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Route groups and dynamic segments are not used by the cron paths, but
        // handle them so this stays correct if they appear later.
        const segment = entry.name.startsWith("(") ? "" : entry.name;
        await walk(
          path.join(dir, entry.name),
          segment ? `${urlPath}/${segment}` : urlPath,
        );
      } else if (entry.name === "route.ts") {
        routes.push(urlPath);
      }
    }
  }

  await walk(apiDir, "/api");
  return routes;
}

describe("vercel.json", () => {
  it("declares cron jobs for every scheduled route", async () => {
    const raw = await readFile(path.join(ROOT, "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons?: { path: string; schedule: string }[] };

    expect(Array.isArray(config.crons)).toBe(true);
    expect(config.crons!.length).toBeGreaterThan(0);
  });

  it("points every cron schedule at a route that exists", async () => {
    const raw = await readFile(path.join(ROOT, "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons: { path: string; schedule: string }[] };
    const routes = await listRoutePaths();

    for (const cron of config.crons) {
      // A typo here is invisible in production: the schedule is accepted and the
      // invocation 404s.
      expect(routes, `cron path ${cron.path} has no route`).toContain(cron.path);
    }
  });

  it("uses valid five-field cron expressions", async () => {
    const raw = await readFile(path.join(ROOT, "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons: { path: string; schedule: string }[] };

    for (const cron of config.crons) {
      const fields = cron.schedule.trim().split(/\s+/);
      expect(fields, `${cron.path} schedule must have 5 fields`).toHaveLength(5);
      for (const field of fields) {
        expect(field, `${cron.path} has a malformed field: ${field}`).toMatch(
          /^(\*|\d+|\*\/\d+|\d+-\d+|\d+,\d+)$|^\d+-\d+\/\d+$/,
        );
      }
    }
  });

  it("schedules every cron route the codebase provides", async () => {
    // The inverse check: a job that exists but is never scheduled is dead code
    // that looks like a working feature in the docs.
    const raw = await readFile(path.join(ROOT, "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons: { path: string }[] };
    const scheduled = new Set(config.crons.map((c) => c.path));

    const cronRoutes = (await listRoutePaths()).filter((r) => r.startsWith("/api/cron/"));
    expect(cronRoutes.length).toBeGreaterThan(0);

    for (const route of cronRoutes) {
      expect(scheduled, `${route} is not scheduled in vercel.json`).toContain(route);
    }
  });
});

describe(".env.example", () => {
  it("documents every variable the source reads", async () => {
    const sourceFiles: string[] = [];
    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(full);
      }
    }
    await walk(path.join(ROOT, "src"));

    const referenced = new Set<string>();
    for (const file of sourceFiles) {
      const text = await readFile(file, "utf8");
      for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
        referenced.add(match[1]);
      }
    }

    // Provided by the platform, never set by hand.
    const platformProvided = new Set(["NODE_ENV"]);

    const example = await readFile(path.join(ROOT, ".env.example"), "utf8");
    const documented = new Set(
      [...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]),
    );

    const undocumented = [...referenced]
      .filter((name) => !platformProvided.has(name))
      .filter((name) => !documented.has(name));

    expect(undocumented, `undocumented env vars: ${undocumented.join(", ")}`).toEqual([]);
  });

  it("never contains a secret value", async () => {
    const example = await readFile(path.join(ROOT, ".env.example"), "utf8");
    // Every secret must be present but empty. A filled-in value in the example is
    // how a credential reaches a public repository.
    for (const line of example.split("\n")) {
      const match = line.match(/^(SUPABASE_SERVICE_ROLE_KEY|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|RESEND_API_KEY|CRON_SECRET)=(.*)$/);
      if (match) {
        expect(match[2].trim(), `${match[1]} must be empty in .env.example`).toBe("");
      }
    }
  });

  it("enables both approved billing capability flags by default", async () => {
    const example = await readFile(path.join(ROOT, ".env.example"), "utf8");
    // International (8 currencies) and recurring payments are approved for Orindle;
    // either can be flipped to "false" as an emergency kill-switch.
    expect(example).toContain("RAZORPAY_INTERNATIONAL_ENABLED=true");
    expect(example).toContain("RAZORPAY_RECURRING_ENABLED=true");
  });

  it("keeps malware scanning off by default", async () => {
    const example = await readFile(path.join(ROOT, ".env.example"), "utf8");
    // There is no scanner behind the hook. A default of true would let unscanned
    // bytes become downloadable.
    expect(example).toContain("MALWARE_SCAN_ENABLED=false");
  });
});

describe("deployment guide", () => {
  it("states the correct number of migrations", async () => {
    const files = await readdir(path.join(ROOT, "supabase", "migrations"));
    const count = files.filter((f) => f.endsWith(".sql")).length;

    const guide = await readFile(
      path.join(ROOT, "docs", "deployment", "deployment-guide.md"),
      "utf8",
    );

    // Prose numbers drift faster than any other documentation claim, and "apply the
    // nine migrations" is an instruction someone will follow literally.
    const words: Record<number, string> = {
      1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
      7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
      13: "thirteen", 14: "fourteen", 15: "fifteen", 16: "sixteen",
      17: "seventeen", 18: "eighteen", 19: "nineteen", 20: "twenty",
      21: "twenty-one", 22: "twenty-two", 23: "twenty-three", 24: "twenty-four",
      25: "twenty-five", 26: "twenty-six",
    };
    expect(words[count], `add ${count} to the word map`).toBeTruthy();
    expect(guide).toContain(`${words[count]} migrations`);
  });

  it("states the correct number of cron jobs", async () => {
    const raw = await readFile(path.join(ROOT, "vercel.json"), "utf8");
    const config = JSON.parse(raw) as { crons: { path: string }[] };
    const count = config.crons.length;

    const guide = await readFile(
      path.join(ROOT, "docs", "deployment", "deployment-guide.md"),
      "utf8",
    );

    const words: Record<number, string> = {
      6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
    };
    expect(words[count], `add ${count} to the word map`).toBeTruthy();
    expect(guide).toContain(`${words[count]} jobs`);
  });
});

describe("environment-variables.md", () => {
  it("lists every server-only variable the code reads", async () => {
    const doc = await readFile(
      path.join(ROOT, "docs", "deployment", "environment-variables.md"),
      "utf8",
    );

    // The two capability flags were missing from this table while the code read
    // them, which is how a reviewer concludes a switch does not exist.
    for (const name of [
      "RAZORPAY_INTERNATIONAL_ENABLED",
      "RAZORPAY_RECURRING_ENABLED",
      "MALWARE_SCAN_ENABLED",
      "CRON_SECRET",
      "TRASH_RETENTION_DAYS",
      "RECOVERY_WINDOW_DAYS",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      expect(doc, `${name} is undocumented`).toContain(name);
    }
  });
});

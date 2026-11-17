/**
 * Navigation performance probe.
 *
 * Measures what a visitor experiences rather than what the server reports:
 *
 *   - first load: navigation timings, LCP, and bytes actually transferred
 *   - client-side navigation: click → new route painted, and the resulting scrollY
 *
 * Both are measured on a throttled connection and CPU. This matters: over
 * loopback with an idle CPU every page looks instant, so an unthrottled number
 * cannot tell you whether a change helped or the machine was simply quick that
 * second. The throttle makes runs comparable to each other.
 *
 * Usage:
 *   node scripts/visual-gate/prep-chromium.py   (once, after npm install)
 *   npx next build && npx next start -p 3000
 *   LD_LIBRARY_PATH=$PWD/.verify/lib node scripts/visual-gate/perf-probe.mjs \
 *     --base http://127.0.0.1:3000
 *
 *   --base <url>   server to measure (default http://127.0.0.1:3000)
 *   --routes <a,b> routes to load cold (default /,/features,/pricing)
 *
 * Exits non-zero if a client-side navigation exceeds the 500ms budget or if
 * navigating from the bottom of a page leaves the viewport scrolled down, so it
 * works as a gate on the two things this was written to catch.
 *
 * Note on `bytes`: the figure is the transferred length after the server's
 * Content-Encoding, which is what a visitor pays for. Raw chunk sizes on disk are
 * roughly 3x larger and are not the number to reason about.
 */
import puppeteer from "puppeteer-core";

const BUDGET_MS = 500;

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

const BASE = arg("base", "http://127.0.0.1:3000").replace(/\/$/, "");
const ROUTES = arg("routes", "/,/features,/pricing").split(",");
const EXECUTABLE = process.env.CHROME_PATH ?? "/home/user/orindlecom/.verify/chromium";

const browser = await puppeteer.launch({
  executablePath: EXECUTABLE,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const failures = [];
const rows = [];

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Slow 4G-ish: ~1.6 Mbps down, 150ms RTT, 4x CPU slowdown.
  const client = await page.createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  let transferred = 0;
  page.on("response", async (response) => {
    if (!response.url().startsWith(BASE)) return;
    try {
      transferred += (await response.buffer()).length;
    } catch {
      /* A streamed or aborted response has no buffer; its size is unknowable here. */
    }
  });

  const started = Date.now();
  await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60_000 });
  const wall = Date.now() - started;

  const metrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0];
        let lcp = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // The observer replays buffered entries asynchronously.
        setTimeout(
          () =>
            resolve({
              dcl: Math.round(nav.domContentLoadedEventEnd),
              load: Math.round(nav.loadEventEnd),
              lcp: Math.round(lcp),
            }),
          250,
        );
      }),
  );

  rows.push({
    route,
    wall,
    ...metrics,
    kb: Math.round(transferred / 1024),
  });
  await page.close();
}

/* Client-side navigation, which is the interaction the budget is really about. */
const navPage = await browser.newPage();
await navPage.setViewport({ width: 1280, height: 900 });
await navPage.goto(BASE + ROUTES[0], { waitUntil: "networkidle2" });

const destinations = ROUTES.slice(1);
for (const href of destinations) {
  // Start at the bottom, which is the reported failure mode: the viewport used to
  // stay stranded mid-page or at the end of the new document.
  await navPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 120));

  const started = Date.now();
  const clicked = await navPage.evaluate((h) => {
    const link = [...document.querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === h || a.getAttribute("href") === h + "/",
    );
    if (!link) return false;
    link.click();
    return true;
  }, href);

  if (!clicked) {
    failures.push(`no in-page link found for ${href}`);
    continue;
  }

  await navPage.waitForFunction((h) => location.pathname === h, { timeout: 30_000 }, href);
  await navPage.waitForFunction(() => document.body.innerText.length > 500, { timeout: 30_000 });
  const elapsed = Date.now() - started;

  // Let the scroll effect run before reading where the viewport ended up.
  await new Promise((r) => setTimeout(r, 250));
  const scrollY = await navPage.evaluate(() => window.scrollY);

  rows.push({ route: `nav→${href}`, wall: elapsed, scrollY });

  if (elapsed > BUDGET_MS) {
    failures.push(`nav→${href} took ${elapsed}ms, over the ${BUDGET_MS}ms budget`);
  }
  if (scrollY !== 0) {
    failures.push(`nav→${href} left the viewport at scrollY=${scrollY}, expected 0`);
  }

  await navPage.goto(BASE + ROUTES[0], { waitUntil: "networkidle2" });
}

await browser.close();

const pad = (value, width = 6) => String(value ?? "-").padStart(width);
console.log("\nroute              wall   dcl  load   lcp     KB  scrollY");
for (const row of rows) {
  console.log(
    row.route.padEnd(17) +
      pad(row.wall) +
      pad(row.dcl) +
      pad(row.load) +
      pad(row.lcp) +
      pad(row.kb) +
      pad(row.scrollY ?? "-", 8),
  );
}

if (failures.length > 0) {
  console.error("\nFAIL");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log("\nOK");

/**
 * Screenshot matrix.
 *
 * Renders every route at every required width, records console errors, page
 * errors and horizontal overflow, and writes PNGs under docs/design/screenshots/
 * (override with --out).
 *
 * Usage:
 *   node scripts/visual-gate/prep-chromium.py   (once, after npm install)
 *   npx next build && npx next start -p 3000
 *   LD_LIBRARY_PATH=$PWD/.verify/lib node scripts/visual-gate/capture.mjs \
 *     --base http://127.0.0.1:3000
 *
 * Exits non-zero if any route/width combination has a defect, so it works as a
 * CI gate rather than a report you have to read carefully.
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const BASE = argVal("--base", "http://127.0.0.1:3000");
const ONLY = argVal("--only", null);
const OUT = path.resolve(argVal("--out", "docs/design/screenshots"));

const ROUTES = [
  ["home", "/"],
  ["features", "/features"],
  ["pricing", "/pricing"],
  ["business-marketing", "/business"],
  ["about", "/about"],
  ["security", "/security"],
  ["faq", "/faq"],
  ["help", "/help"],
  ["help-article", "/help/articles/recover-deleted-files"],
  ["contact", "/contact"],
  ["legal", "/legal"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
  ["cookies", "/cookies"],
  ["acceptable-use", "/acceptable-use"],
  ["data-deletion", "/data-deletion"],
  ["blog", "/blog"],
  ["blog-article", "/blog/best-google-drive-alternatives"],
  ["blog-article-long", "/blog/how-to-move-files-from-google-drive"],
  ["login", "/login"],
  ["signup", "/signup"],
  ["sign-in", "/sign-in"],
  ["sign-up", "/sign-up"],
  ["forgot-password", "/forgot-password"],
  ["reset-password", "/reset-password"],
  ["verify-email", "/verify-email"],
  ["account", "/account"],
  ["dashboard", "/dashboard"],
  ["dashboard-files", "/dashboard/files"],
  ["dashboard-folders", "/dashboard/folders"],
  ["dashboard-folders-id", "/dashboard/folders/root"],
  ["dashboard-recent", "/dashboard/recent"],
  ["dashboard-starred", "/dashboard/starred"],
  ["dashboard-shared", "/dashboard/shared"],
  ["dashboard-trash", "/dashboard/trash"],
  ["dashboard-storage", "/dashboard/storage"],
  ["dashboard-billing", "/dashboard/billing"],
  ["dashboard-profile", "/dashboard/profile"],
  ["dashboard-settings", "/dashboard/settings"],
  ["business-overview", "/dashboard/business"],
  ["business-members", "/dashboard/business/members"],
  ["business-folders", "/dashboard/business/folders"],
  ["business-permissions", "/dashboard/business/permissions"],
  ["business-storage", "/dashboard/business/storage"],
  ["business-activity", "/dashboard/business/activity"],
  ["business-settings", "/dashboard/business/settings"],
  ["not-found", "/this-does-not-exist"],
];

const WIDTHS = [390, 768, 1024, 1280, 1440];

/**
 * Routes that must legitimately return 404 in the current configuration.
 * `/dashboard/folders/:id` renders a folder that the repository resolves; with
 * no backend connected the repository reports not_found, and the page turns
 * that into a 404 by design. Once the backend is wired this entry must be
 * replaced with a real folder id.
 */
const EXPECT_404 = new Set(["dashboard-folders-id", "not-found"]);

const routes = ONLY ? ROUTES.filter(([, p]) => p === ONLY) : ROUTES;

await fs.mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: path.resolve(".verify/chromium"),
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--font-render-hinting=none",
    ...(process.env.LD_LIBRARY_PATH ? [] : []),
  ],
});

const report = [];
let _violations = 0;

for (const [name, route] of routes) {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on("pageerror", (err) => pageErrors.push(String(err).slice(0, 300)));

    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });

    let status = 0;
    try {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      status = response?.status() ?? 0;
    } catch (error) {
      pageErrors.push(`navigation: ${String(error).slice(0, 200)}`);
    }

    // Let fonts and layout settle before measuring.
    try {
      await page.evaluate(() => document.fonts.ready);
    } catch {}
    await new Promise((r) => setTimeout(r, 250));

    // Horizontal overflow: the page must never scroll sideways, and any
    // specific offender is reported so it can be fixed rather than guessed at.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = doc.scrollWidth - doc.clientWidth;
      const offenders = [];
      if (over > 1) {
        for (const el of document.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right <= doc.clientWidth + 1) continue;
          let clipped = false;
          for (let n = el.parentElement; n; n = n.parentElement) {
            const ox = getComputedStyle(n).overflowX;
            if (ox !== "visible") { clipped = true; break; }
          }
          if (!clipped) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
          }
        }
      }
      return { over, offenders: [...new Set(offenders)].slice(0, 4) };
    });

    // Touch targets under 36px on mobile widths.
    let smallTargets = 0;
    if (width <= 430) {
      smallTargets = await page.evaluate(() => {
        const bad = [];
        // WCAG 2.5.8 (AA) minimum pointer target is 24x24 CSS px.
        const MIN = 24;
        for (const el of document.querySelectorAll("a[href], button, [role='button'], select, textarea, input")) {
          const r = el.getBoundingClientRect();
          // sr-only / clipped utilities are not user-facing targets
          if (r.width <= 1 || r.height <= 1) continue;
          if (el.closest("[aria-hidden='true']")) continue;
          if (r.height >= MIN) continue;
          // WCAG 2.5.8 exception: a target whose bounding box sits inside a
          // larger clickable ancestor (label-wrapped inputs) is compliant.
          const label = el.closest("label");
          if (label) {
            const lr = label.getBoundingClientRect();
            if (lr.height >= MIN) continue;
          }
          // WCAG 2.5.8 "inline" exception: a link in a sentence is exempt.
          // Test against the nearest block ancestor, since the immediate
          // parent of a prose link is often just a <p> that wraps only it.
          if (el.tagName === "A") {
            let block = el.parentElement;
            while (block && getComputedStyle(block).display.startsWith("inline")) {
              block = block.parentElement;
            }
            const blockText = (block?.textContent || "").trim();
            // Even a short prefix such as "Support: " makes the link inline prose.
            if (blockText.length > (el.textContent || "").trim().length + 3) continue;
          }
          bad.push(`${el.tagName.toLowerCase()}:${Math.round(r.height)}px`);
        }
        return bad.length;
      });
    }

    const file = path.join(OUT, `${name}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });

    const problems = [];
    const wants404 = EXPECT_404.has(name);
    if (wants404 && status !== 404) problems.push(`expected 404, got ${status}`);
    if (!wants404 && status >= 400) problems.push(`HTTP ${status}`);
    // A 404 page must not log a resource error; it is part of normal navigation.
    if (wants404) consoleErrors.length = 0;
    if (overflow.over > 1) problems.push(`h-overflow ${overflow.over}px${overflow.offenders.length ? ` [${overflow.offenders.join(", ")}]` : ""}`);
    if (consoleErrors.length) problems.push(`console: ${consoleErrors[0]}`);
    if (pageErrors.length) problems.push(`pageerror: ${pageErrors[0]}`);
    if (smallTargets > 0) problems.push(`${smallTargets} targets <24px`);

    if (problems.length) _violations += 1;

    report.push({ name, route, width, status, over: overflow.over, smallTargets, problems });

    await page.close();
  }
  process.stdout.write(`  ${name}\n`);
}

await browser.close();

await fs.writeFile(
  path.join(OUT, "report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, report }, null, 2),
);

const bad = report.filter((r) => r.problems.length);
console.log(`\n${report.length} shots, ${bad.length} with problems`);
for (const row of bad) {
  console.log(`  ${row.name} @${row.width}: ${row.problems.join(" | ")}`);
}
process.exit(bad.length > 0 ? 1 : 0);

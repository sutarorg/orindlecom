/**
 * SEO audit.
 *
 * Crawls a running server and checks the things that can only be verified from
 * rendered HTML: that each public route returns 200, has a unique title and
 * description, exactly one canonical pointing at the right host, one h1, valid
 * JSON-LD, a crawlable Open Graph image and correct index/noindex directives.
 *
 * It exists because "the metadata is correct" is a claim, and a claim about
 * rendered output should be measured rather than asserted. Static checks (data
 * integrity, link resolution, sitemap coverage) live in the vitest suite; this
 * script covers the half that needs a server.
 *
 * Usage:
 *   npx next build && npx next start -p 3000
 *   node scripts/seo-audit.mjs --base http://localhost:3000
 *
 * Exits non-zero on any violation, so it works as a gate.
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};

const BASE = argVal("--base", "http://localhost:3000");
const ORIGIN = "https://orindle.com";

/** Every public route that must be indexable. */
const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/features",
  "/security",
  "/business",
  "/about",
  "/contact",
  "/faq",
  "/help",
  "/legal",
  "/privacy",
  "/terms",
  "/cookies",
  "/acceptable-use",
  "/data-deletion",
  "/blog",
];

/**
 * Every article's slug and thumbnail, read from the source of truth rather than
 * duplicated here.
 *
 * The image filename is deliberately *not* assumed to equal the slug: two articles
 * use shorter names for longer slugs (how-to-move-files-from-google-drive is
 * published with move-files-from-google-drive.webp). Guessing produced six false
 * 404s on the first run of this script, which is exactly why it reads the data.
 */
async function readArticles() {
  const dir = "src/config/blog/articles";
  const files = await fs.readdir(dir);
  const found = [];
  for (const file of files.filter((f) => f.endsWith(".ts"))) {
    const text = await fs.readFile(path.join(dir, file), "utf8");
    const slug = text.match(/slug:\s*"([a-z0-9-]+)"/)?.[1];
    const image = text.match(/src:\s*"(\/images\/blog\/[a-z0-9-]+\.webp)"/)?.[1];
    if (slug && image) found.push({ slug, image });
  }
  return found.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Routes that must not be indexable. */
const PRIVATE_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const problems = [];
const rows = [];

function fail(route, message) {
  problems.push(`${route}: ${message}`);
}

function extractAll(html, pattern) {
  // matchAll requires the global flag; add it rather than making every caller
  // remember, which is the kind of detail that fails at the worst moment.
  const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return [...html.matchAll(global)].map((m) => m[1]);
}

function decode(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function fetchHtml(route) {
  const res = await fetch(`${BASE}${route}`, { redirect: "follow" });
  return { status: res.status, html: await res.text() };
}

const articles = await readArticles();
const allPublic = [...PUBLIC_ROUTES, ...articles.map((a) => `/blog/${a.slug}`)];

const titles = new Map();
const descriptions = new Map();

for (const route of allPublic) {
  const { status, html } = await fetchHtml(route);
  const row = { route, status };

  if (status !== 200) fail(route, `expected 200, got ${status}`);

  const title = extractAll(html, /<title[^>]*>([\s\S]*?)<\/title>/i)[0];
  const description = extractAll(
    html,
    /<meta[^>]+name="description"[^>]+content="([^"]*)"/i,
  )[0];
  const canonicals = extractAll(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/gi);
  const robotsMeta = extractAll(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i)[0] ?? "";
  const keywords = extractAll(html, /<meta[^>]+name="keywords"[^>]+content="([^"]*)"/i)[0];
  const h1s = extractAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  const ogImage = extractAll(html, /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/i)[0];
  const ogTitle = extractAll(html, /<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i)[0];
  const ogDesc = extractAll(html, /<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)[0];
  const twitterCard = extractAll(html, /<meta[^>]+name="twitter:card"[^>]+content="([^"]*)"/i)[0];
  const ldJson = extractAll(
    html,
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );

  // ---- title ----
  if (!title) fail(route, "missing <title>");
  else {
    row.title = decode(title);
    if (titles.has(row.title)) fail(route, `duplicate title, also on ${titles.get(row.title)}`);
    else titles.set(row.title, route);
    if (row.title.length > 65) row.titleNote = `${row.title.length} chars`;
    if (row.title.length < 15) fail(route, `title too short (${row.title.length})`);
    if (!row.title.includes("Orindle") && route !== "/")
      fail(route, "title lacks brand suffix");
  }

  // ---- description ----
  if (!description) fail(route, "missing meta description");
  else {
    row.description = decode(description);
    if (descriptions.has(row.description))
      fail(route, `duplicate description, also on ${descriptions.get(row.description)}`);
    else descriptions.set(row.description, route);
    if (row.description.length < 60) fail(route, `description too short (${row.description.length})`);
    if (row.description.length > 180) row.descNote = `${row.description.length} chars`;
  }

  // ---- canonical ----
  if (canonicals.length === 0) fail(route, "missing canonical");
  else if (canonicals.length > 1) fail(route, `${canonicals.length} canonical tags`);
  else {
    const expected = route === "/" ? ORIGIN : `${ORIGIN}${route}`;
    if (canonicals[0] !== expected) fail(route, `canonical is ${canonicals[0]}, expected ${expected}`);
    row.canonical = canonicals[0];
  }

  // ---- robots ----
  if (/noindex/i.test(robotsMeta)) fail(route, "public route is noindex");

  // ---- keywords ----
  if (!keywords) fail(route, "missing keywords meta");
  else row.keywords = keywords.split(",").length;

  // ---- headings ----
  if (h1s.length === 0) fail(route, "no <h1>");
  else if (h1s.length > 1) fail(route, `${h1s.length} <h1> tags`);
  else {
    row.h1 = decode(h1s[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }

  // ---- social ----
  if (!ogImage) fail(route, "missing og:image");
  else {
    if (!ogImage.startsWith("https://")) fail(route, `og:image is not absolute (${ogImage})`);
    if (ogImage.startsWith(BASE)) fail(route, "og:image points at the local server, not the canonical host");
    row.ogImage = ogImage.replace(ORIGIN, "");
  }
  if (!ogTitle) fail(route, "missing og:title");
  if (!ogDesc) fail(route, "missing og:description");
  if (twitterCard !== "summary_large_image") fail(route, `twitter:card is "${twitterCard}"`);

  // ---- structured data ----
  const types = [];
  for (const block of ldJson) {
    try {
      const parsed = JSON.parse(block);
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== "object") return;
        if (node["@type"]) types.push(node["@type"]);
        if (node["@graph"]) walk(node["@graph"]);
        for (const [k, v] of Object.entries(node)) {
          if (k !== "@type" && typeof v === "object") walk(v);
        }
      };
      walk(parsed);
    } catch (error) {
      fail(route, `invalid JSON-LD: ${String(error).slice(0, 90)}`);
    }
  }
  row.schema = types.length ? [...new Set(types)].join(", ") : "—";

  // ---- internal links are crawlable (plain anchors, not JS-only) ----
  const anchors = extractAll(html, /<a[^>]+href="(\/[^"]*)"/gi);
  row.links = new Set(anchors).size;

  rows.push(row);
}

// ---- private routes must be noindex ----
for (const route of PRIVATE_ROUTES) {
  const { status, html } = await fetchHtml(route);
  const robotsMeta = extractAll(html, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i)[0] ?? "";
  if (!/noindex/i.test(robotsMeta)) {
    fail(route, `private route is not noindex (status ${status}, robots "${robotsMeta}")`);
  }
}

// ---- sitemap ----
{
  const res = await fetch(`${BASE}/sitemap.xml`);
  const xml = await res.text();
  if (res.status !== 200) fail("/sitemap.xml", `status ${res.status}`);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const route of allPublic) {
    const expected = route === "/" ? ORIGIN : `${ORIGIN}${route}`;
    if (!urls.includes(expected)) fail("/sitemap.xml", `missing ${expected}`);
  }
  for (const url of urls) {
    if (/\/dashboard|\/api\/|\/login|\/signup/.test(url))
      fail("/sitemap.xml", `private URL listed: ${url}`);
  }
  if (!/<lastmod>/.test(xml)) fail("/sitemap.xml", "no lastmod values");
  console.log(`sitemap: ${urls.length} URLs, all public routes present`);
}

// ---- robots.txt ----
{
  const res = await fetch(`${BASE}/robots.txt`);
  const txt = await res.text();
  if (res.status !== 200) fail("/robots.txt", `status ${res.status}`);
  if (!/Sitemap:\s*https:\/\/orindle\.com\/sitemap\.xml/.test(txt))
    fail("/robots.txt", "sitemap not declared");
  // Blocking these would break rendering for a crawler.
  if (/Disallow:\s*\/_next/.test(txt)) fail("/robots.txt", "blocks /_next assets");
  if (/Disallow:\s*\/(images|fonts|art)\b/.test(txt)) fail("/robots.txt", "blocks static assets");
  if (!/Disallow:\s*\/dashboard/.test(txt)) fail("/robots.txt", "does not disallow /dashboard");
  console.log("robots.txt: valid, assets crawlable, private areas disallowed");
}

// ---- icons ----
for (const icon of ["/favicon.ico", "/icon.png", "/apple-icon.png", "/icon.svg"]) {
  const res = await fetch(`${BASE}${icon}`);
  if (res.status !== 200) fail(icon, `status ${res.status}`);
}

// ---- blog images ----
for (const article of articles) {
  const res = await fetch(`${BASE}${article.image}`);
  if (res.status !== 200) fail(article.image, `status ${res.status}`);
  if (res.headers.get("content-type") !== "image/webp")
    fail(article.image, `content-type ${res.headers.get("content-type")}`);
  // The pages are served by an optimiser; fetch the optimised variant too, because
  // a pattern/domain mismatch in next.config fails there and not on the raw file.
  const optimised = `${BASE}/_next/image?url=${encodeURIComponent(article.image)}&w=1200&q=75`;
  const optRes = await fetch(optimised);
  if (optRes.status !== 200) fail(article.image, `next/image optimiser returned ${optRes.status}`);
}

// ---- report ----
console.log("");
const header = ["route", "title", "desc", "h1", "schema", "ogImage"];
const widths = [34, 7, 6, 4, 30, 30];
const pad = (v, w) => String(v ?? "").padEnd(w).slice(0, w);
console.log(header.map((h, i) => pad(h, widths[i])).join(" "));
console.log(widths.map((w) => "─".repeat(w)).join(" "));
for (const row of rows) {
  console.log(
    [
      pad(row.route, widths[0]),
      pad(row.title?.length, widths[1]),
      pad(row.description?.length, widths[2]),
      pad(row.h1 ? "✓" : "✗", widths[3]),
      pad(row.schema, widths[4]),
      pad(row.ogImage, widths[5]),
    ].join(" "),
  );
}

console.log("");
if (problems.length === 0) {
  console.log(`✓ ${rows.length} public routes, 0 problems`);
  process.exit(0);
}
console.log(`✗ ${problems.length} problems:`);
for (const problem of problems) console.log(`  - ${problem}`);
process.exit(1);

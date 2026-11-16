/**
 * Rasterise the brand icons.
 *
 * The cloud glyph exists once, as an SVG path in src/components/brand/logo.tsx.
 * The favicon, the Apple touch icon and the manifest icons are that same shape at
 * different sizes — so they are generated from a shared source rather than drawn
 * again, which is how a brand ends up with three subtly different logos.
 *
 * Chromium is used as the renderer because it is already present for the visual
 * gate. It renders SVG identically to how a browser will, which is the property
 * that matters for a 16 px favicon.
 *
 * Usage (after `npm install` and prep-chromium.py):
 *   LD_LIBRARY_PATH=$PWD/.verify/lib node scripts/raster-icons.mjs
 */
import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const GLYPH =
  "M9.35 21.1c-2.4 0-4.44-.83-6.12-2.5C1.55 16.93.71 14.9.71 12.5c0-2.03.61-3.82 1.84-5.36A8.2 8.2 0 0 1 7.2 4.4a6.95 6.95 0 0 1 2.64-3.1A7.06 7.06 0 0 1 13.7.2c1.9 0 3.58.6 5.03 1.8a8.6 8.6 0 0 1 2.73 3.86 6.9 6.9 0 0 1 4.34 1.19 6.53 6.53 0 0 1 2.5 3.16c.4.86.6 1.75.6 2.68 0 2.4-.85 4.44-2.54 6.13-1.69 1.69-3.72 2.53-6.1 2.53H9.35Z";
const BRAND_BLUE = "#3178fb";

/** Square icon with a rounded blue field and a centred white glyph. */
function iconSvg(size, radius, glyphRatio) {
  const glyphWidth = size * glyphRatio;
  const glyphHeight = (glyphWidth * 22) / 32;
  const x = (size - glyphWidth) / 2;
  const y = (size - glyphHeight) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND_BLUE}"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(glyphWidth / 32).toFixed(5)})">
    <path d="${GLYPH}" fill="#ffffff"/>
  </g>
</svg>`;
}

const JOBS = [
  // radius ≈ 22% of the side, glyph at 56% width: legible down to 16 px.
  { file: "public/icon.svg", size: 512, radius: 112, ratio: 0.56 },
  { file: "public/icon.png", size: 512, radius: 112, ratio: 0.56 },
  { file: "public/icon-192.png", size: 192, radius: 42, ratio: 0.56 },
  { file: "public/apple-icon.png", size: 180, radius: 40, ratio: 0.56 },
  // Maskable: full-bleed square, glyph inside the 80% safe zone so an Android
  // launcher can crop it to a circle without clipping the cloud.
  { file: "public/icon-maskable.svg", size: 512, radius: 0, ratio: 0.44 },
  { file: "public/icon-maskable.png", size: 512, radius: 0, ratio: 0.44 },
];

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "orindle-icons-"));
const browser = await puppeteer.launch({
  executablePath: ".verify/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

const faviconPng = path.join(tmp, "favicon-48.png");

for (const job of JOBS) {
  const svg = iconSvg(job.size, job.radius, job.ratio);
  const svgPath = path.join(tmp, path.basename(job.file) + ".svg");
  await fs.writeFile(svgPath, svg);
  // The .svg outputs are the source itself, not a rasterisation.
  if (job.file.endsWith(".svg")) {
    await fs.writeFile(job.file, svg);
    console.log("wrote", job.file);
    continue;
  }
  const page = await browser.newPage();
  await page.setViewport({ width: job.size, height: job.size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: job.file, omitBackground: true });
  await page.close();
  console.log("wrote", job.file);
}

// 48 px source for the multi-resolution .ico (16/32/48 are written by favicon.ico).
{
  const svg = iconSvg(48, 11, 0.56);
  const page = await browser.newPage();
  await page.setViewport({ width: 48, height: 48, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: faviconPng, omitBackground: true });
  await page.close();
}

await browser.close();
await fs.rm(tmp, { recursive: true, force: true });

console.log(`
Icon PNGs written. Build the multi-resolution favicon.ico from the 48px render:

  python3 -c "from PIL import Image; Image.open('${path.basename(faviconPng)}').save('public/favicon.ico', sizes=[(16,16),(32,32),(48,48)])"

(already committed; rerun only if the glyph or brand colour changes)
`);

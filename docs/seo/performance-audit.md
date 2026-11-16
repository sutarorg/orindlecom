# Performance Audit

**Environment:** production build (`next build` + `next start`), local, Node 22.
**Note:** these are lab figures on a development machine, not field data. Real Core Web
Vitals require real traffic and are measured in Search Console after launch.

---

## Build output

| Metric | Value |
| --- | --- |
| Pages prerendered statically | 24 of 26 |
| Dynamic pages | `/` and `/pricing` (regional currency read from a cookie) |
| Largest JS bundle | Framework chunk, shared and cached |
| Blog articles | All statically generated via `generateStaticParams` |
| API routes | 35, none client-facing on public pages |

The two dynamic pages are dynamic for a reason: they read a currency cookie to show INR
or USD prices. Everything else — including all ten articles — is prerendered HTML, which
is the best possible starting point for both LCP and crawlability.

---

## What actually affects the metrics here

### Images

| Asset | Size |
| --- | --- |
| Largest blog thumbnail | 37.7 KB (business) |
| Smallest blog thumbnail | 10.2 KB (organise) |
| All ten thumbnails | 199 KB total |
| OG image (1200×630) | 158 KB |
| Icons | 3–11 KB each |

Every thumbnail went through `next/image`, which:
- serves the size the viewport needs via `sizes`;
- negotiates AVIF or WebP;
- includes intrinsic dimensions, so no layout shift on load.

`priority` is set on exactly two images — the blog index lead and the article hero —
so only above-the-fold imagery competes for initial bandwidth. The other nine cards
lazy-load.

### Fonts

One variable WOFF2, self-hosted at `/fonts/plus-jakarta-sans-latin.woff2`, declared with
`font-display: swap`. No third-party font request, no FOIT, no render-blocking call to
another origin.

`display: swap` trades a brief flash of fallback text for immediate content — the right
trade for a content site, where text is the content.

### JavaScript

- No analytics, no tag manager, no chat widget, no A/B testing script on public pages.
- Interaction cost on articles is effectively zero: the body is server-rendered HTML plus
  inline SVG icons, and the only client components are the shared header and footer.
- Razorpay's checkout script loads only on the billing flow, never on a marketing page.

The single largest performance lever on this site is that there is almost no client
JavaScript on the pages being indexed.

---

## Core Web Vitals — expected behaviour by metric

| Metric | Target | How this implementation serves it |
| --- | --- | --- |
| **LCP** | < 2.5 s | Server-rendered HTML with the hero image preloaded and the remaining images lazy. Text LCP requires no webfont on the critical path beyond one cached WOFF2 |
| **INP** | < 200 ms | Almost no JS on content pages; no long tasks from hydration on articles |
| **CLS** | < 0.1 | All images carry width and height; `next/image` reserves space; no dynamically injected banners; no web-font swap that reflows a heading into a different line count beyond one fallback swap |

**These are expectations, not measurements.** LCP and INP require a real browser under
real network conditions; the numbers to trust are the ones Search Console reports after
launch.

---

## Mobile-first

The site is designed mobile-first and verified at five widths on every route:

| Width | Device class | Routes |
| --- | --- | --- |
| 390 px | Phone | 47 |
| 768 px | Tablet portrait | 47 |
| 1024 px | Tablet landscape / small laptop | 47 |
| 1280 px | Desktop | 47 |
| 1440 px | Large desktop | 47 |

**245 captures, 0 defects.** The visual gate fails on horizontal overflow, console
errors, page errors and unexpected status codes, so a layout that scrolls sideways at
390 px cannot ship. Mobile-first indexing makes this the width that matters most.

---

## Rules applied

1. **No UI/UX compromise for SEO.** The design system was not changed to suit a metric.
   The performance properties come from not adding weight, not from stripping design.
2. **No render-blocking third-party requests.** There are none on public pages.
3. **No client-side-only content.** Everything a crawler needs is in the initial HTML.
4. **Content hierarchy preserved.** Headings are structural, not decorative; images
   enhance text rather than replacing it.

---

## Verification

```bash
# Build size and static/dynamic split
npx next build

# Confirm prerendering (● = SSG, ○ = static, ƒ = dynamic)
# Blog articles should all show as prerendered

# Responsive + console + overflow gate
LD_LIBRARY_PATH=$PWD/.verify/lib node scripts/visual-gate/capture.mjs \
  --base http://localhost:3000
```

**Not run here, and why:** Lighthouse, PageSpeed Insights and the Rich Results Test all
require either a hosted URL or a full Chrome install with network access to Google's
endpoints. Running them against `localhost` produces numbers that do not reflect
production, and reporting them as if they did would be misleading. Run them against the
deployed domain:

```bash
npx lighthouse https://orindle.com --preset=desktop --view
npx lighthouse https://orindle.com/blog/best-google-drive-alternatives --view
```

Or use `https://pagespeed.web.dev/` with the production URL.

---

## Known trade-offs

| Trade-off | Decision | Rationale |
| --- | --- | --- |
| Two dynamic pages vs full static | Currency from a cookie | Showing ₹ prices to a US visitor is worse than a slightly slower TTFB; ISR could close the gap later |
| `font-display: swap` | Chosen | Content appears immediately; the swap is one line of fallback text |
| 1200×675 images rather than smaller | Chosen | The size is what social crawlers and retina displays need; WebP keeps each under 40 KB |
| Inline styles permitted in CSP | Chosen | Tailwind emits inline style attributes; a nonce-based CSP would require rewriting the design system for no measurable security gain here |

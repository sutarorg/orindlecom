# Canonical URL Map

**Canonical origin:** `https://orindle.com` — apex host, HTTPS, no `www`.

Every indexable URL, its canonical, and the rule that generates it.

---

## Rules

1. **One origin.** `https://orindle.com`. The constant is `CANONICAL_ORIGIN` in
   `src/config/seo.ts`; nothing computes it from the request.
2. **No trailing slash** except none required — the root resolves to
   `https://orindle.com` without a slash, because Next normalises it that way and the
   sitemap is held to the same string.
3. **Lowercase, hyphenated, no parameters.** No indexable page uses a query string.
4. **No duplicate paths.** Each route has exactly one URL that returns 200 and is
   canonical; no route is reachable at two paths.
5. **Self-referencing canonicals.** Every page's canonical points at itself. A page
   whose canonical points elsewhere should not be in the sitemap.

---

## The map

| Route | Canonical URL | In sitemap | Indexable |
| --- | --- | --- | --- |
| `/` | `https://orindle.com` | ✓ | ✓ |
| `/pricing` | `https://orindle.com/pricing` | ✓ | ✓ |
| `/features` | `https://orindle.com/features` | ✓ | ✓ |
| `/security` | `https://orindle.com/security` | ✓ | ✓ |
| `/teams` | `https://orindle.com/teams` | ✓ | ✓ |
| `/business` | signed-in team workspace — `noindex` | — | — |
| `/about` | `https://orindle.com/about` | ✓ | ✓ |
| `/contact` | `https://orindle.com/contact` | ✓ | ✓ |
| `/faq` | `https://orindle.com/faq` | ✓ | ✓ |
| `/help` | `https://orindle.com/help` | ✓ | ✓ |
| `/help/articles/{slug}` | `https://orindle.com/help/articles/{slug}` | ✗ | ✓ |
| `/legal` | `https://orindle.com/legal` | ✓ | ✓ |
| `/privacy` | `https://orindle.com/privacy` | ✓ | ✓ |
| `/terms` | `https://orindle.com/terms` | ✓ | ✓ |
| `/cookies` | `https://orindle.com/cookies` | ✓ | ✓ |
| `/acceptable-use` | `https://orindle.com/acceptable-use` | ✓ | ✓ |
| `/data-deletion` | `https://orindle.com/data-deletion` | ✓ | ✓ |
| `/blog` | `https://orindle.com/blog` | ✓ | ✓ |
| `/blog/best-google-drive-alternatives` | `https://orindle.com/blog/best-google-drive-alternatives` | ✓ | ✓ |
| `/blog/google-drive-vs-dropbox-vs-onedrive` | `https://orindle.com/blog/google-drive-vs-dropbox-vs-onedrive` | ✓ | ✓ |
| `/blog/best-free-cloud-storage` | `https://orindle.com/blog/best-free-cloud-storage` | ✓ | ✓ |
| `/blog/how-much-cloud-storage-do-you-need` | `https://orindle.com/blog/how-much-cloud-storage-do-you-need` | ✓ | ✓ |
| `/blog/cloud-storage-vs-cloud-backup` | `https://orindle.com/blog/cloud-storage-vs-cloud-backup` | ✓ | ✓ |
| `/blog/how-to-share-large-files-online` | `https://orindle.com/blog/how-to-share-large-files-online` | ✓ | ✓ |
| `/blog/best-cloud-storage-for-small-business` | `https://orindle.com/blog/best-cloud-storage-for-small-business` | ✓ | ✓ |
| `/blog/is-cloud-storage-safe` | `https://orindle.com/blog/is-cloud-storage-safe` | ✓ | ✓ |
| `/blog/how-to-organize-digital-files` | `https://orindle.com/blog/how-to-organize-digital-files` | ✓ | ✓ |
| `/blog/how-to-move-files-from-google-drive` | `https://orindle.com/blog/how-to-move-files-from-google-drive` | ✓ | ✓ |

**Note on `/help/articles/{slug}`:** the 22 help articles are indexable and carry
self-referencing canonicals, but are deliberately excluded from the sitemap. They are
reachable from `/help` in two clicks, and a sitemap of 48 URLs dilutes the crawl budget
for a new site. Revisit once the blog is established.

---

## Assets on the canonical host

| Asset | URL |
| --- | --- |
| Open Graph default | `https://orindle.com/images/og/orindle-og.png` (1200×630) |
| Blog thumbnails | `https://orindle.com/images/blog/{name}.webp` (1200×675, ×10) |
| Favicon | `https://orindle.com/favicon.ico` |
| Icon | `https://orindle.com/icon.png` (512×512) |
| Apple icon | `https://orindle.com/apple-icon.png` (180×180) |
| SVG icon | `https://orindle.com/icon.svg` |
| Manifest | `https://orindle.com/manifest.webmanifest` |
| Sitemap | `https://orindle.com/sitemap.xml` |
| robots.txt | `https://orindle.com/robots.txt` |

---

## Known variants to consolidate at the host level

These cannot be resolved in application code and must be configured at the DNS or
hosting provider:

| Variant | Required behaviour |
| --- | --- |
| `http://orindle.com` | 301 → `https://orindle.com` |
| `http://www.orindle.com` | 301 → `https://orindle.com` |
| `https://www.orindle.com` | 301 → `https://orindle.com` |
| `https://orindle.com/` | Serves content; canonical says the no-slash form. Both are one page to a crawler |
| Any `*.vercel.app` preview URL | Must never be indexed — `metadataBase` prevents the canonical from ever pointing at it, and preview deployments should carry `X-Robots-Tag: noindex` |

**Not yet verified in production.** Nothing in this repository can confirm the host-level
redirect actually exists. It is listed as an open item in `technical-seo-audit.md` and
must be checked with `curl -I` against the live domain before launch.

---

## Change policy

If a URL must change:

1. Never reuse an old URL for different content.
2. Serve a **301** from the old path to the new one — not a 302, and not only a
   canonical tag.
3. Update the route, the `INDEXABLE_PAGES` entry, and the sitemap together; the test
   suite fails if they disagree.
4. Keep the redirect for at least a year, and longer if the page had links.

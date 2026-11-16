# Favicon and Search Eligibility

**Assets shipped:** 6 files, all square, all crawlable, all the genuine Orindle glyph.

---

## What Google actually requires for a favicon to be eligible

Google's documented requirements, and how this implementation meets each:

| Requirement | Google's rule | Implementation |
| --- | --- | --- |
| Crawlable | Must not be blocked by robots.txt | `Allow: /` with no icon disallow; verified by audit |
| Square | 1:1 aspect ratio | All six assets are square |
| Size | At least 48 × 48 px, multiples of 48 preferred | 512, 192, 180, 48 (via ICO) |
| Format | ICO, PNG, SVG or GIF supported | ICO, PNG, SVG all shipped |
| Stable URL | Must not change per request | Static files under `/public` |
| One per hostname | Google uses one favicon per host | The same files are used site-wide; no subdirectory overrides |
| Homepage reference | Google looks for the icon declaration on the homepage | Declared in root metadata, inherited by `/` |

**Eligibility is not appearance.** Google states plainly that a favicon meeting these
requirements *may* be shown; it is not guaranteed, and it can take days or weeks to
appear after a change. Nothing in this document promises the icon will display.

---

## The assets

| File | Size | Purpose | Bytes |
| --- | --- | --- | --- |
| `/favicon.ico` | 16, 32, 48 multi-res | Tabs, bookmarks, legacy browsers | 3,219 |
| `/icon.png` | 512 × 512 | Google Search, manifest | 10,737 |
| `/icon-192.png` | 192 × 192 | PWA manifest | 3,731 |
| `/icon-maskable.png` | 512 × 512 | Android launcher (safe-zone glyph) | 4,912 |
| `/apple-icon.png` | 180 × 180 | iOS home screen | 3,505 |
| `/icon.svg` | Vector | Modern browsers, any DPI | 582 |

### Design

- **Field:** brand blue `#3178fb`, rounded square (radius ≈ 22% for the non-maskable
  variants; the maskable variant is full-bleed so a launcher can crop it).
- **Glyph:** the Orindle cloud, in white, at 56% width — centred and optically balanced.
- **Contrast:** white on `#3178fb` is a luminance ratio of about 3.9:1, which reads
  clearly at 16 px. The glyph is a solid silhouette with no interior detail, so it does
  not turn to mush below 32 px.
- **Maskable safe zone:** the maskable variant reduces the glyph to 44% width so it
  survives a circular crop without clipping.

Rasterised from the same SVG path the site header uses (`CloudGlyph` in
`src/components/brand/logo.tsx`), so the mark in the tab, the mark in the header and the
mark in the structured data are provably the same shape.

---

## Declaration

In `src/app/layout.tsx`:

```ts
icons: {
  icon: [
    { url: "/favicon.ico", sizes: "48x48" },
    { url: "/icon.svg", type: "image/svg+xml" },
    { url: "/icon.png", type: "image/png", sizes: "512x512" },
  ],
  apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  shortcut: ["/favicon.ico"],
}
```

Rendered output includes:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icon.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180">
<link rel="shortcut icon" href="/favicon.ico">
```

The manifest (`/manifest.webmanifest`) declares the 192 and 512 icons with
`purpose: "any"`, plus the maskable variant.

---

## Consistency with the rest of the brand

| Surface | Logo used |
| --- | --- |
| Site header | `CloudGlyph` — same SVG path |
| Site footer | `Wordmark` with the same glyph |
| Favicon and icons | The same path, rasterised |
| `Organization` structured data | `https://orindle.com/icon.png` |
| Open Graph image | The same glyph, drawn in the same colour |

There is no second logo anywhere in the codebase. A second mark in a tab strip is the
fastest way to make a brand unmemorable, and a mismatch between the header logo and the
`Organization.logo` URL is an entity-confusion signal.

---

## Verification

```bash
for f in favicon.ico icon.png apple-icon.png icon.svg; do
  curl -s -o /dev/null -w "$f %{http_code} %{content_type}\n" https://orindle.com/$f
done
```

The audit checks all four return 200. A test asserts the files exist in `public/` and
that the root layout declares `metadataBase`, `favicon.ico` and `apple-icon.png`.

---

## What this does not guarantee

- **That Google will display the icon.** It is a required condition, not a sufficient one.
- **When.** Appearance after a change commonly lags days to weeks.
- **That a browser will choose the one you expect.** Some browsers prefer the SVG, some
  the ICO; all six files are present so every browser has a suitable option.

If the icon does not appear in results a few weeks after launch, the useful checks are:
`robots.txt` is not blocking `/favicon.ico`, the homepage declares an icon, the image is
square and at least 48 × 48, and the URL returns 200 without a redirect.

# Orindle — Reference Analysis

Source of truth: `google_drive/Orindle Cloud Storage Landing Page.png`
(named "Orindle Cloud Storage Landing Page.png" in Google Drive).

**Inspection method:** the file was downloaded at original resolution and analysed with
ImageMagick crops, per-region colour histograms, and a scripted luminance-band scanner
that measures cap-height, baseline and element bounding boxes in image pixels. Every
number below is a measurement, not an estimate, unless marked *(estimated)*.

---

## 1. Canvas

| Property | Measured value |
|---|---|
| Pixel dimensions | **941 × 1672** |
| Aspect ratio | 0.5628 (portrait) |
| Colour profile | sRGB |
| Design density | 1 design unit = 1 image pixel at 941px viewport width |
| Content left edge | x = 36px |
| Content right edge | x = 905px (CTA band, footer social icons) |
| Page side gutter | 36px |
| Rendered page background | `#FFFFFF`, with pastel atmosphere panels behind the hero, mid-page and CTA |

The reference is a **mobile-width marketing page**, not a 1440 desktop capture. It is
therefore treated as the *primary* viewport (941px) that must be reproduced faithfully,
and the layout is then extended upward to 1280/1440/1920 and downward to 360–430 by
reflowing the same composition rather than by inventing a second design.

---

## 2. Section order and vertical rhythm

Measured vertical bands (image px). Gaps are measured between the last visual edge of
one block and the first visual edge of the next.

| # | Section | y-range | Height | Gap above |
|---|---|---:|---:|---:|
| 1 | Header | 0 – 58 | 58 | — |
| 2 | Hero (copy + product mockup) | 58 – 405 | 347 | 0 |
| 3 | Feature trio ("Everything you need…") | 455 – 782 | 327 | 50 |
| 4 | Storage band ("A little more room…") | 812 – 968 | 156 | 30 |
| 5 | Plans ("Room for every kind of digital life.") | 1000 – 1274 | 274 | 32 |
| 6 | CTA band | 1292 – 1429 | 137 | 18 |
| 7 | Footer | 1455 – 1672 | 217 | 26 |

Notes that drove the implementation:

- The hero is **not** vertically centred; the copy block hugs the header and the
  product mockup overlaps the pastel atmosphere panel.
- Sections 3 and 4 are tightly coupled (30px gap): the storage band is a continuation
  of the feature composition, sitting to the right of a left-aligned headline.
- Section 5 is centred; sections 3 and 4 are asymmetric with left-aligned type.
- The footer is the tallest band and holds the densest typography.

---

## 3. Header — measured

| Property | Measurement |
|---|---|
| Header band | y 0 – 58; content optically centred on y ≈ 30 |
| Header height | **58px** (no bottom border, no drop shadow) |
| Background | Transparent, sits on the page's pastel wash |
| Logo cloud | x 33 – 52 (19px wide), y 21 – 37 |
| Wordmark "Orindle" | x 60 – 118, cap band y 26 – 39, **14px cap height → 20px type**, weight 700, tracking −0.02em, colour near-black ink |
| Nav group | "Features" x 324 – 364 · "Pricing" x 395 – 426 · "Business" x 456 – 497 · "About" x 526 – 560 |
| Nav type | 14px, weight 500, colour `#333A5C`-equivalent, ~30px gaps between items |
| Nav block position | Nav starts at 34.4% of width, ends at 59.5% — optically centred, not flush |
| "Sign in" | right-aligned text link, x ≈ 773 – 803, 14px, weight 500 |
| "Get started" | pill, x 827 – 887 (**60px wide**), y 18 – 47 (**30px tall**), radius 999px, fill `#3178FB`, label 12.5px/600 white |
| Gap | 24px between "Sign in" and the pill |

---

## 4. Hero — measured

### 4.1 Copy column

| Property | Measurement |
|---|---|
| Copy block left edge | x = 37 |
| Copy block right edge | x ≈ 384 (longest line, "One simple place.") |
| Column width used | 347px |
| Headline line 1 "Your files." | cap band y 121 – 144 (**24px cap height**) |
| Headline line 2 "Your world." | y 169 – 211 (cap band 169 – 192, descender to 211) |
| Headline line 3 "One simple place." (blue) | y 230 – 272 |
| Baseline pitch | **≈ 55px between line tops** → line-height 1.10 at 56px |
| Headline size | 56px, weight 800, tracking −0.031em |
| Headline ink | `#0F1537` – `#202649` sampled → **#171D3A** |
| Headline blue | `#3275F6` sampled, anti-aliased edges to `#528DF9` → **#3178FB** |
| Line breaks | Hard breaks after "Your files." and "Your world." — three lines total |
| Body | y 260 – 275 and y 292 – 306 → two lines, **17px**, line-height 1.62, colour `#6A6F8B` |
| Body line 1 | "Store, access and share your files from anywhere." |
| Body line 2 | "A simpler way to keep everything together." |
| Body wrap width | ≈ 400px |
| Gap headline → body | 23px (descender of line 3 to first body cap) |
| Primary button | x 36 – 177 (**141 × 44**), y 335 – 379, radius 14px, fill `#3178FB`, shadow `0 8px 20px −8px rgba(49,120,251,.55)` |
| Primary label | "Get 10 GB Free" 15px/600 + trailing 16px arrow, 14px inner gaps |
| Gap body → CTA | 29px |
| Secondary button | x 191 – 300 (**109 × 44**), y 335 – 379, 1px border `#E1E5F0`, white fill, radius 14px, label "Explore Plans" 15px/600 ink |
| Gutter between CTAs | 14px |
| Assurance line | "No credit card required", y ≈ 402, 13px, colour `#8B90A8`, preceded by a 14px crossed-circle glyph |
| Gap CTA → assurance | 22px |

### 4.2 Hero backdrop

Three overlapping organic blobs, each a very soft radial wash with **no visible edge**:

1. Large lavender-periwinkle wash entering from the top-left corner behind the copy,
   peaking around `#EFE9FD` / `#E3E6FE`, fading to white by y ≈ 300.
2. Mint-cyan wash at the top-right, `#DFF4F4`, strongest at x 741–941, y 0–100.
3. Peach-blush wash at the far right edge, `#FFE6DC` → `#FFE4EE`, y 90 – 200.
4. A soft blue-tinted floor under the mockup, fading down from around `#ECF1FE`.

Two floating decorative tiles in the same blue family:

- Filled blue rounded-square tile at approximately (365, 160), **22 × 22**, rotated ≈ 20°,
  fill `#8CB8FB`, opacity ≈ 0.9.
- A second, paler tile behind the mockup's top-right corner (~x 700, y 60).

Additionally a thin lavender arc passes behind the wordmark area (visible as a large,
very low-contrast circle whose top edge crosses x 0 – 300 at y ≈ 40).

### 4.3 Product mockup

This is the single most important visual and it is **built in code, not generated**.

| Property | Measurement |
|---|---|
| Panel bounds | x 398 – 902, y 96 – 373 |
| Size | **504 × 277** |
| Aspect ratio | 1.82 : 1 |
| Rotation | ≈ −2.2° (top edge rises to the right) |
| Radius | 18px outer |
| Fill | `#FFFFFF` at 94% with a 10px backdrop blur |
| Border | 1px `rgba(255,255,255,0.9)` outer + 1px `rgba(23,29,58,0.06)` inner |
| Shadow | Wide, soft, low-opacity: `0 40px 80px −32px rgba(30,40,90,.28)` |
| Sidebar width | 116px of the 504px panel (23%) |
| Sidebar background | Transparent on the panel body; separated by a 1px hairline |
| Sidebar logo row | cloud glyph + "Orindle" wordmark, 11px/700, at the top of the sidebar |
| Sidebar nav items | Home · My Files · Shared · Recent · Trash — 10px labels, 16px leading icon, 30px row height, 6px radius |
| Active nav item | "Home" — fill `#EAF1FF`, label + icon `#3178FB` |
| Sidebar storage card | Bottom of sidebar: "Storage" label 8px, track 3px, fill 24%, caption "2.4 GB / 10 GB" 8px, card fill `#F7F9FD`, radius 8px |
| Main toolbar row | Search field (radius 8px, 1px `#EEF1F7`, placeholder "Search files…", magnifier icon), then a view-toggle pair (grid / list), then a second segmented group (list / grid), then a 22px pink avatar circle "S" |
| Section title | "My Files", 20px/700, ink |
| Folder grid | 5 columns of folder tiles, each tile ≈ 76 × 62 with a 10px radius and a very light `#FBFCFE` fill, containing a 44px gradient folder glyph and a 10px label below |
| Folder names | Documents · Photos · Projects · Designs (4 tiles) |
| Folder glyph colours | blue `#5B9BF8`→`#3B7DE8`; green `#6FD8AE`→`#3FC08E`; orange/amber `#FFB259`→`#FB8F3D`; violet `#A78BFA`→`#8B5CF6` |
| "Upload" button | Top-right of the content area, 74 × 26, radius 8px, fill `#3178FB`, label 10px/600 + upload glyph |
| Drop zone | Full width of the content area, 1px dashed `#D8DEEB`, radius 12px, height 96px, centred cloud-upload glyph 28px `#3178FB`, title "Drag & drop files here" 11px/600, sub "or browse from your device" 9px subtle |

The mockup is decorative (aria-hidden) but must remain crisp, responsive and truly
composed — it is a rendered React component, never a screenshot.

---

## 5. Feature trio — measured

| Property | Measurement |
|---|---|
| Section heading | "Everything you need. Nothing you don't." centred, cap band y 500 – 509 → **31px type**, weight 800, tracking −0.024em |
| Heading centred on x = 470 | yes |
| Column 1 x | 52 – 300 |
| Column 2 x | 357 – 570 |
| Column 3 x | 656 – 866 |
| Column gap | ≈ 57px |
| Step badge | 22px circle, fill `#EAF1FF`, label "01" 10px/600 `#3178FB`; badge colour shifts per column (01 blue, 02 blue, 03 violet `#8B5CF6` on `#F1ECFE`) |
| Badge → h3 | 22px |
| h3 | 19px, weight 700, tracking −0.014em |
| h3 → body | 8px |
| Body | 15px, line-height 1.6, colour `#6A6F8B`, wraps to 2 lines at 210px |
| Heading → column top | 32px |
| Illustration height | 200px, full column width, cropped at the section's bottom edge |

Illustration treatments (all built in code):

1. *Store without the clutter* — a floating file-manager panel at a slight angle with a
   left rail of 4 icons and a "Storage" donut reading **2.4 GB of 10 GB**, plus a
   legend of three progress rows. A mint circle sits behind its top-right and a peach
   circle behind its bottom-right.
2. *Access from anywhere* — three overlapping device frames (laptop, tablet, phone),
   each showing the same folder grid, standing on a shared soft shadow. A mint circle
   sits behind them.
3. *Share with simplicity* — a "Share folder" card with an email input, a "Can view"
   select and a blue "Share" button, with a linking glyph in a tile overlapping the
   card's top-right corner. Peach circle behind.

The pastel circles are 96–140px, positioned to bleed past the column edges, filled with
`#DFF4F2`, `#FFE6DC` and `#F1ECFE` respectively.

---

## 6. Storage band — measured

| Property | Measurement |
|---|---|
| Headline | "A little more / room for everything." left-aligned, two lines, cap band y 838 – 862 and y 928 – 952 → **31px type**, weight 800, tracking −0.024em; line-height 1.22 |
| Headline colour | ink |
| Headline → underline | 26px |
| Underline | 3px tall, 76px wide, radius 999px, gradient left→right `#8B6DF6` → `#F7A8B8` → `#FFC9A8` |
| Card | x 420 – 902, y 812 – 928 (**482 × 116**), radius 16px, white 92%, hairline border, soft shadow |
| Card contents | 6 equal chips, each a 46px tinted-square (radius 10px) holding a 30px database glyph, with a 12px/600 label beneath (10 GB · 100 GB · 500 GB · 1 TB · 5 TB · 10 TB), 6px gaps |
| Glyph tints | mint `#34C77B`, amber `#F9A53B`, sky `#3178FB`, violet `#8B5CF6`, mint `#34C77B`, coral `#FB7A5F` |
| Backdrop | A large periwinkle→lavender swoosh sits behind the card, bleeding from x 400 to 941, y 790 – 1000, plus a second swoosh below the card in a deeper periwinkle `#C9CDFB` at low opacity |
| Decorative tiles | one blue rounded tile at (655, 792) rotated −25°; a second at (897, 818) |

---

## 7. Plans — measured

| Property | Measurement |
|---|---|
| Heading | "Room for every kind of digital life." centred, 31px/800, y 1020 – 1044 |
| Subhead | "Start free. Find the space that feels right." centred, 15px, colour `#6A6F8B`, y 1052 – 1064 |
| Subhead → toggle | 16px |
| Toggle | 127 × 28 pill: track white with 1px border, active segment pill 62 × 28 fill `#3178FB`, labels "Monthly" (white/600 11px) and "Yearly" (ink 11px/500) |
| Toggle → cards | 24px |
| Cards row | x 32 – 908, six cards |
| Card width | ≈ 134px |
| Card gap | 14px |
| Card height | 156px |
| Card padding | 14px |
| Card radius | 14px |
| Card fill | white 70% → transparent, 1px `#E6E9F2` border, no shadow (only the highlighted card gets a shadow) |
| Card layout | icon (20px, tinted per plan) → plan name 11px/600 muted → storage 15px/800 ink → price 17px/800 ink → CTA pill, bottom-aligned |
| CTA pill | 104 × 25, radius 999px, 1px `#D5DAEA` border, 10.5px/600 ink label; the highlighted card's CTA is filled `#3178FB` with white text and no border |
| Highlighted card | "Plus" — 2px `#3178FB` border, white fill, shadow `0 18px 36px −20px rgba(49,120,251,.55)`, and a "Most Popular" pill floated on top centre (fill `#3178FB`, 9.5px/600 white, 62 × 17, radius 999px) |
| Plan icon tints | Free cloud `#3178FB` · Basic leaf `#34C77B` · Plus star `#3178FB` · Premium gem `#8B5CF6` · Ultra bolt `#FB5F8A` · Max crown `#F9A53B` |
| Prices shown | ₹0 · ₹79 · ₹199 · ₹349 · ₹999 · ₹1,999 (INR locale) |

Card order is fixed: Free, Basic, Plus, Premium, Ultra, Max. There is **no 2 TB tier**.

---

## 8. CTA band — measured

| Property | Measurement |
|---|---|
| Band | x 32 – 908 (**876 × 137**), y 1292 – 1429, radius 20px, overflow hidden |
| Background | Layered pastel gradient: lavender `#EDE9FE` at the left, periwinkle→sky `#DCE7FD` centre, peach `#FFE3D5` and mint `#DFF1F7` toward the right and bottom |
| Headline | "Your next home for files starts here." centred, 23px/800, ink |
| Subhead | "Get started with 10 GB of free cloud storage." 14px, colour `#5A6080` |
| Button | 158 × 38 pill, fill `#3178FB`, label "Create Your Free Account" 12.5px/600 + arrow, shadow |
| Contents vertical rhythm | headline y 1310, subhead y 1340, button y 1362 – 1400 |
| Left artwork | A 3D-ish glassy blue folder stack, occupying x 50 – 190, y 1305 – 1420, tilted, with a soft shadow — **generated raster asset**, cropped by the band |
| Right artwork | A soft white 3D cloud at x 800 – 900, y 1355 – 1420 — **generated raster asset** |
| Decorative tiles | small rotated blue squares at (700, 1345) and (843, 1375) plus tiny dots |

Text and button are real DOM; only the folder stack, cloud and tiles are imagery.

---

## 9. Footer — measured

| Property | Measurement |
|---|---|
| Footer band | y 1455 – 1672 |
| Background | white, separated by a 1px `#EEF1F7` hairline at y ≈ 1455 |
| Wordmark | cloud glyph + "Orindle" 20px/700, at x 30 – 120, y 1522 – 1540 |
| Link columns | 4 columns at x 228, 364, 500, 635; a 1px vertical rule at x ≈ 763 |
| Column heading | 11px/600 ink |
| Column links | 11px/400, colour `#6A6F8B`, 20px row pitch |
| Product column | Features · Pricing · Business |
| Company column | About · Contact |
| Resources column | Help Center · FAQ |
| Legal column | Privacy · Terms |
| Social block | x 800 – 908: three 18px circular glyph buttons (Instagram, X, LinkedIn) with a 16px gap, tinted `#5A6080` |
| Link block top | y 1514 (headings) |
| Footer bottom padding | ≈ 40px below the longest column |

No fake customer logos, no testimonial row, no trust badge strip anywhere in the page.

---

## 10. Colour summary

| Token | Value | Where it appears |
|---|---|---|
| Brand blue | `#3178FB` | Primary CTA, active nav pill, headline line 3, links, Upload, toggles, highlight border |
| Brand blue hover | `#1E64E6` | Button hover |
| Brand blue soft | `#EAF1FF` | Active nav item, step badges, icon chips |
| Ink | `#171D3A` | Headlines, nav labels, plan names/prices |
| Ink strong | `#0E1430` | Hero headline |
| Body | `#333A5C` | Navigation, secondary labels |
| Muted | `#6A6F8B` | Paragraphs, footer links |
| Subtle | `#8B90A8` | Assurance line, mockup captions |
| Border | `#E6E9F2` | Cards, dividers |
| Border strong | `#D5DAEA` | Secondary button borders |
| Surface | `#FFFFFF` | Page, panels |
| Surface muted | `#F7F9FD` | Sidebar storage card, chips |
| Pastel mint | `#DFF4F2` | Feature circles, header wash |
| Pastel lavender | `#EFE9FD` | Hero top-left wash, CTA band |
| Pastel periwinkle | `#E3E6FE` | Storage band swoosh |
| Pastel peach | `#FFE6DC` | Hero right, CTA band |
| Pastel blush | `#FFE4EE` | Hero far right |
| Accent green | `#34C77B` | Basic leaf, storage chip |
| Accent violet | `#8B5CF6` | Premium gem, step 03, storage chip |
| Accent coral | `#FB5F8A` | Ultra bolt |
| Accent amber | `#F9A53B` | Max crown, storage chip |

**Colour balance rule observed in the reference:** blue is used for *action and one
headline line only*. Everything else is ink, grey and pastel. Accents appear as small
icon tints (≤ 24px) and chip backgrounds, never as large fills.

---

## 11. Typography summary

| Role | Size | Weight | Line-height | Tracking |
|---|---:|---:|---:|---:|
| Hero display | 56px | 800 | 1.10 | −0.031em |
| Page h1 | 48px | 800 | 1.12 | −0.028em |
| Section h2 | 31px | 800 | 1.22 | −0.024em |
| Card/feature h3 | 19px | 700 | 1.32 | −0.014em |
| Body | 17px | 400 | 1.62 | −0.006em |
| Body small | 15px | 400 | 1.60 | 0 |
| Nav | 14px | 500 | 1.2 | −0.004em |
| Button | 15px | 600 | 1 | −0.005em |
| Caption | 13px | 400 | 1.5 | 0.01em |
| Micro label | 10–11px | 600 | 1.3 | 0.01em |

**Typeface:** Plus Jakarta Sans. Verified by the single-storey `a`, the flat-cut `l`,
the geometric `o`, the short descender on `y`, the open `r` arm, and the boxy
apostrophe in "don't" — all distinctive Jakarta features. The reference is *not*
Inter (Inter's `a` is double-storey and its `l` has a tail).

---

## 12. Reference analysis table

| Element | Position | Relative size | Appearance | Implementation |
|---|---|---|---|---|
| Navigation | y 0–58, logo x 33, nav x 324–560, CTA right x 827 | 58px tall; 60×30 CTA | Transparent, no border; 14px/500 links; blue pill CTA | HTML/CSS, sticky-on-scroll variant |
| Hero headline | x 37, y 115–276 | 347px wide, 3 lines, 56px | Ink lines 1–2, blue line 3, weight 800, tight tracking | HTML/CSS — real text |
| Hero visual | x 398–902, y 96–373 | 504×277, −2.2° | Glass file-manager panel with sidebar, folder grid, drop zone | **React component** (not an image) |
| Primary CTA | x 36, y 335 | 141×44, r14 | Blue fill, 15px/600 white label, arrow, soft blue shadow | `Button` component |
| Secondary CTA | x 191, y 335 | 109×44, r14 | White, 1px border, ink label | `Button` variant |
| Feature sections | y 455–782 | 3 columns, 200px art | Step badge, h3, 2-line body, custom coded illustration | HTML/CSS + inline SVG |
| Storage band | y 812–968 | 482×116 card | Headline left, 6-chip capacity card right on a swoosh | HTML/CSS |
| Pricing | y 1000–1274 | 6 × 134px cards | Icon/name/storage/price/CTA; Plus highlighted | HTML/CSS, config-driven |
| CTA band | y 1292–1429 | 876×137, r20 | Pastel gradient, centred copy, 3D folder + cloud art | DOM + generated assets |
| Footer | y 1455–1672 | 4 link columns + social | White, hairline top, small type | HTML/CSS |

---

## 13. How the reference extends to wider viewports

The reference is a 941px capture of a design whose natural desktop container is
1280px. Extending it means:

- **Container** grows to 1280px with 40px gutters; the hero's copy column and mockup
  become a 2-column split (≈ 1fr / 1.15fr) with the mockup bleeding slightly past the
  container's right edge, exactly as it bleeds past x = 902 in the reference.
- **Hero type** stays at 56–64px; the mockup scales with the column, never below 0.85×.
- **Feature trio** becomes 3 columns at ≥ 1024px (matching the reference), stacks to
  one column below 768px with the illustration *below* the copy and reduced to 160px.
- **Storage band** keeps its asymmetric two-part composition at ≥ 1024px and stacks
  headline-over-card below.
- **Plans** keep all six in one row at ≥ 1280px, become a 3×2 grid at 768–1279px, and a
  single-column list with a compact horizontal card at < 640px.
- **CTA band** keeps the 20px radius and pastel gradient at all widths; artwork is
  cropped rather than scaled down to nothing.
- **Header** collapses to logo + menu button at < 900px with a full-height sheet.

---

## 14. Things deliberately *not* in the reference

To avoid adding template furniture the reference does not contain:

- No testimonial section, no customer logo strip, no G2/rating badges.
- No "trusted by" marquee.
- No animated counters or fabricated statistics.
- No 2 TB pricing tier.
- No dark-mode marketing variant.
- No auto-playing video.

Any content of that sort would represent claims Orindle has not verified, which the
project's content rules forbid.

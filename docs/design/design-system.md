# Orindle — Design System

Derived from `docs/design/reference-analysis.md`. The implementation source of truth is
`src/styles/tokens.css`; this document explains intent, so a future contributor can
extend the system without drifting.

**Rule:** no component may introduce a colour, radius, shadow or type size that is not
defined in the token layer. If a new value is needed, it is added to
`src/styles/tokens.css` first and documented here.

---

## 1. Principles

1. **Ink and pastel, not gradient soup.** The reference is 90% white, ink and grey. Blue
   is reserved for action and a single headline line. Pastel washes create atmosphere in
   the background only.
2. **Delicate geometry.** 1px hairlines at low contrast, radii between 6 and 20px, and
   elevation that is felt rather than seen. Nothing is pill-shaped unless the reference
   makes it pill-shaped (buttons, badges, toggles).
3. **Type does the work.** Weight 800 display type at tight tracking, paired with
   generous 1.6 line-height body copy. Hierarchy comes from scale and weight, not colour.
4. **Real interfaces, not pictures of interfaces.** Every product surface is React.
   Imagery is reserved for atmospheric artwork (hero backdrop, CTA band art).
5. **One system across marketing and product.** The marketing site, auth screens and
   dashboards share these tokens.

---

## 2. Colour

### 2.1 Brand

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#3178FB` | Primary buttons, links, active states, focus ring |
| `--color-primary-hover` | `#1E64E6` | Hover on primary fills |
| `--color-primary-active` | `#1A57C9` | Pressed state |
| `--color-primary-soft` | `#EAF1FF` | Active nav item, step badges, icon chips |
| `--color-primary-soft-2` | `#DAE7FF` | Selection, stronger chips |
| `--color-primary-ink` | `#1B4FBD` | Blue text on soft blue surfaces (contrast ≥ 4.5:1) |

### 2.2 Text

| Token | Value | Contrast on white | Use |
|---|---|---:|---|
| `--color-ink-strong` | `#0E1430` | 16.9:1 | Hero display type |
| `--color-ink` | `#171D3A` | 15.6:1 | Headings, plan prices, nav |
| `--color-text` | `#333A5C` | 11.4:1 | Default body, nav links |
| `--color-text-muted` | `#6A6F8B` | 5.4:1 | Paragraphs, footer links |
| `--color-text-subtle` | `#8B90A8` | 3.4:1 | **Non-essential only** (assurance line, captions). Never used for body copy or links. |

### 2.3 Surfaces and borders

| Token | Value |
|---|---|
| `--color-background` | `#FFFFFF` |
| `--color-canvas` | `#FBFBFF` |
| `--color-surface-muted` | `#F7F9FD` |
| `--color-border` | `#E6E9F2` |
| `--color-border-strong` | `#D5DAEA` |
| `--color-border-soft` | `#EEF1F7` |

### 2.4 Pastel atmosphere

`--pastel-lavender #EFE9FD` · `--pastel-periwinkle #E3E6FE` · `--pastel-mint #DFF4F2` ·
`--pastel-sky #DCEAFD` · `--pastel-peach #FFE6DC` · `--pastel-blush #FFE4EE`

These may only be applied through a blur/blurred radial gradient or as a background
behind a white panel. **Never** as a text background, never as a button fill.

### 2.5 Plan accents

`#3178FB` Free · `#34C77B` Basic · `#3178FB` Plus · `#8B5CF6` Premium · `#FB5F8A` Ultra ·
`#F9A53B` Max.

Accent usage is restricted to: plan icons, storage-chip glyphs, step badges 02/03, and the
feature illustration circles. An accent is never used for a large fill or for body text.

---

## 3. Typography

**Family:** Plus Jakarta Sans (variable, weights 200–800), self-hosted from
`public/fonts/plus-jakarta-sans-latin.woff2` with `font-display: swap`.

Why it is the correct face is argued in the reference analysis §11. The nearest system
fallbacks are `system-ui, -apple-system, "Segoe UI", Roboto, Arial`.

### 3.1 Scale

| Role | Token | Size | Weight | LH | Tracking |
|---|---|---:|---:|---:|---:|
| Hero display | `--text-display-*` | 56px | 800 | 1.10 | −0.031em |
| Page h1 | `--text-h1-*` | 48px | 800 | 1.12 | −0.028em |
| Section h2 | `--text-h2-*` | 31px | 800 | 1.22 | −0.024em |
| Card h3 | `--text-h3-*` | 19px | 700 | 1.32 | −0.014em |
| Body | `--text-body-*` | 17px | 400 | 1.62 | −0.006em |
| Body small | `--text-body-sm-*` | 15px | 400 | 1.60 | 0 |
| Caption | `--text-caption-*` | 13px | 400 | 1.50 | 0.01em |
| Nav | `--text-nav-*` | 14px | 500 | 1.20 | −0.004em |

### 3.2 Rules

- Exactly one display element per page.
- Display type is never smaller than 34px at desktop, never below 30px at mobile.
- Heading tracking is always negative; body tracking is neutral or slightly negative.
- Paragraph measure: 60–72 characters. The hero body is capped at 400px.
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.
- Numerals in pricing use `font-variant-numeric: tabular-nums` so the six columns align.
- No all-caps headings. Micro labels may be uppercase with 0.06em tracking, but the
  reference does not use them, so they are limited to eligibility/status pills.

---

## 4. Spacing

4px base scale: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 112 · 128`.

Section vertical rhythm (desktop):

| Gap | Value |
|---|---:|
| Header → hero content | 40px |
| Hero → next section | 88px |
| Between feature and storage band | 56px |
| Storage band → plans | 88px |
| Plans → CTA band | 72px |
| CTA band → footer | 80px |
| Footer padding | 64px top / 48px bottom |

The reference's own gaps (50px, 30px, 32px, 18px, 26px at 941px) scale up by roughly
1.6–1.8× at 1280px, which is what the table above encodes.

---

## 5. Layout

| Token | Value |
|---|---|
| `--container-max` | 1280px |
| `--container-pad` | 24px, 40px at ≥ 1024px |
| `--header-height` | 76px desktop, 72px tablet, 64px mobile |

Grid usage:

- Hero: `1fr 1.12fr` at ≥ 1024px, single column below.
- Feature trio: 3 equal columns ≥ 1024px, 1 column below 768px.
- Storage band: `minmax(0,0.95fr) minmax(0,1.05fr)` ≥ 1024px.
- Plans: 6 columns ≥ 1280px, 3 × 2 at 768–1279px, 2 columns at 640–767px,
  1 column below 640px.
- Footer: brand + 4 link columns + social, collapsing to 2 columns below 768px.

---

## 6. Geometry

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Nav items, tiny chips |
| `--radius-sm` | 8px | Inputs, small buttons, mockup toolbar fields |
| `--radius-md` | 12px | Folder tiles, drop zone |
| `--radius-lg` | 16px | Cards, storage card |
| `--radius-xl` | 20px | CTA band, large panels |
| `--radius-2xl` | 28px | Modals |
| `--radius-pill` | 999px | Buttons in the reference, badges, toggle |

Buttons in the reference are pill-shaped (full radius). Cards are 14–16px. Nothing in
between is used.

Border widths: 1px decoration, 2px for the highlighted pricing card and focus rings.

---

## 7. Elevation

| Token | Value | Use |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(23,29,58,.04)` | Hairline cards |
| `--shadow-sm` | `0 1px 3px …, 0 6px 16px −8px …` | Pricing cards on hover |
| `--shadow-md` | `0 2px 6px …, 0 14px 32px −14px …` | Dropdowns, mockup chrome |
| `--shadow-lg` | `0 6px 18px …, 0 32px 60px −28px …` | Feature panels |
| `--shadow-xl` | `0 10px 30px …, 0 48px 90px −40px …` | Hero product mockup |
| `--shadow-primary` | `0 8px 20px −8px rgba(49,120,251,.55)` | Primary buttons only |

Shadows are always cool-tinted (`23,29,58`) and alpha ≤ 0.28. No pure-black shadows, no
inset glows, no multi-layer neon.

---

## 8. Components

### 8.1 Buttons

| Variant | Height | Padding-x | Radius | Fill | Border | Label |
|---|---:|---:|---:|---|---|---|
| Primary | 48px (44px compact) | 24px | pill | `--color-primary` | none | 15px/600 white |
| Secondary | 48px | 22px | pill | white | 1px `--color-border-strong` | 15px/600 ink |
| Ghost | 40px | 12px | 8px | transparent | none | 14px/500 ink, hover `--color-surface-muted` |
| Quiet | 40px | 16px | pill | `--color-primary-soft` | none | 14px/600 `--color-primary-ink` |

Hover: primary darkens to `--color-primary-hover` and lifts 1px. Secondary gains
`--color-border` → `--color-border-strong` and `--shadow-xs`. Active: translate-y 0.
Disabled: 45% opacity, no transform, `cursor: not-allowed`.

Focus: 2px white inner ring + 2px `--color-primary` outer ring, offset 2px. Always
visible on keyboard focus, never on mouse click (`:focus-visible`).

### 8.2 Inputs

Height 44px, radius 8px, 1px `--color-border`, white fill, 15px body copy, placeholder
`--color-text-subtle`, focus border `--color-primary` + 3px soft ring
`rgba(49,120,251,.18)`. Labels are 13px/600 ink, above the field, 6px gap. Errors use
`#D6455D` text below the field with `role="alert"`.

### 8.3 Cards

White, 1px `--color-border`, radius 16px, 24–28px padding, no shadow by default.
Interactive cards may lift to `--shadow-sm` on hover with a 200ms ease-out transition.
Never nest a shadowed card inside a shadowed card.

### 8.4 Navigation

Desktop: logo left, centre links at 14px/500 with 8px x-padding and a pill hover fill
(`--color-primary-soft` at 60%), right cluster "Sign in" text + primary pill.
Active link colour: ink; hover: ink with pill. Header is transparent over the hero and
becomes white/`backdrop-blur` with a hairline after 12px of scroll.

Mobile: logo + 40px menu button, full-height sheet sliding from the right with staggered
link reveals, `aria-expanded`, focus trap, Escape to close, body scroll lock.

### 8.5 Pricing card

Fixed internal order: icon → plan name → storage → price → CTA pinned to the bottom.
The highlighted card gets a 2px primary border, `--shadow-md` and a "Most Popular" pill
centred on its top edge. Prices use tabular numerals. The CTA is full-width.

### 8.6 FAQ accordion

Rows separated by 1px hairlines, no boxes. 17px/700 question, chevron rotates 180°,
`grid-template-rows` height animation (no `max-height` hacks), 15px muted answer with
72ch measure. Built on Radix Accordion for keyboard semantics.

### 8.7 Chips and badges

Height 22px, radius pill, 11px/600, `--color-primary-soft` fill with
`--color-primary-ink` text. Step badges in the reference are 22px circles with a
per-column tint.

### 8.8 Icons

Lucide, 1.6–1.75px stroke, sized 16/18/20/24. Never filled except for decorative
duotone folder glyphs in the product mockups, which are custom SVG with two-stop
gradients taken from the plan accent palette.

### 8.9 Illustration treatment

All in-code illustrations follow: soft pastel circle behind, white panel at radius 16px
with `--shadow-lg`, 1px hairline, one accent hue per illustration, and a single
decorative tile breaking the panel's silhouette. Illustrations never carry real user data.

---

## 9. Motion

| Purpose | Duration | Easing |
|---|---|---|
| Hover / colour | 130ms | `--ease-out` |
| Layout / reveal | 200ms | `--ease-out` |
| Accordion / sheet | 420ms | `--ease-out` |
| Playful pop (badge) | 420ms | `--ease-spring` |

Only opacity and transform are animated for reveal effects. No parallax on scroll, no
infinite decorative loops. `prefers-reduced-motion` disables all of it.

---

## 10. Accessibility baseline

- Text contrast ≥ 4.5:1 for all copy; ≥ 3:1 for large display type and icons.
- Focus-visible ring on every interactive element.
- All illustrations that convey meaning get `role="img"` and an `aria-label`; purely
  decorative product mockups are `aria-hidden` with a text alternative nearby.
- Interactive targets ≥ 44 × 44px on touch.
- Forms have real `<label>`s, `aria-describedby` for help/error text, and
  `aria-invalid` on error.
- Accordions, tabs, selects and the mobile sheet use the Radix primitives, so arrow-key
  and Escape semantics come standard.
- Colour is never the only carrier of meaning (the active plan also carries a border and
  a "Most Popular" label).

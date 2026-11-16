# Orindle — Responsive Behaviour

The reference is a **941px-wide** capture. It is reproduced faithfully at that width and
extended to the required test widths without shrinking the desktop composition.

Test widths: **360 · 390 · 430 · 768 · 1024 · 1280 · 1440 · 1920** (+ the reference
941px viewport for comparison).

Breakpoints (Tailwind defaults, all `min-width`):
`sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`.

---

## 1. Type scaling

| Role | 360–429 | 430–767 | 768–1023 | 1024–1279 | ≥ 1280 |
|---|---:|---:|---:|---:|---:|
| Display (hero) | 34px | 40px | 48px | 52px | 56px |
| h1 (page) | 34px | 34px | 40px | 40px | 48px |
| h2 section | 22px | 24px | 28px | 28px | 31px |
| h3 | 17px | 17px | 19px | 19px | 19px |
| Body | 16px | 16px | 17px | 17px | 17px |

Display line-height stays 1.10 at all sizes; at 34px the tracking relaxes from
−0.031em to −0.02em so small text does not collide.

Side gutters: 16px (≤ 429) · 20px (430–767) · 24px (768–1023) · 40px (≥ 1024).

---

## 2. Header

| Range | Behaviour |
|---|---|
| ≥ 1024 | Full nav inline; 76px height; transparent → frosted on scroll |
| 900–1023 | Full nav inline; 72px height; gap tightens to 20px |
| < 900 | Logo + "Get started" pill + 40px menu button; 64px height; sheet navigation |

The mobile sheet: right-anchored, `min(88vw, 380px)`, links 20px/700 with 56px rows,
"Sign in" and "Get started" stacked full-width at the bottom, scrim behind, Escape and
scrim-tap close, focus trapped.

---

## 3. Hero

| Range | Layout |
|---|---|
| ≥ 1280 | Two columns `1fr / 1.12fr`, mockup 620px wide, bleeds 40px past container right, overlaps the pastel panel |
| 1024–1279 | Two columns, mockup 520px, no bleed |
| 768–1023 | Two columns `1fr / 1fr`, mockup 420px, hero padding reduced |
| 640–767 | Single column, copy centred? **No** — copy stays left-aligned (reference is left-aligned), mockup below at full width, rotated −1.5° |
| < 640 | Single column, mockup full width at `scale(1)`, rotation removed for legibility |

Headline breaks: preserved as three lines down to 430px (the copy fits because the type
scales); below 430px it becomes line 1 / line 2 / line 3 with the same hard breaks, since
"One simple place." still fits at 34px within 328px.

CTAs: side-by-side ≥ 430px; stacked full-width below 430px with 10px gap. The assurance
line stays below, left-aligned, at 12px.

Mockup internals use `clamp()` for padding and a container-scaled font size so the
sidebar labels and folder captions remain ≥ 9px at 360px.

---

## 4. Feature trio

| Range | Layout |
|---|---|
| ≥ 1024 | 3 columns, 56px gap, illustrations 200px tall, pastel circles bleed across column edges |
| 768–1023 | 3 columns, 28px gap, illustrations 160px |
| 640–767 | 2 columns, third item spans full width below |
| < 640 | 1 column, stacked; each item: badge, h3, body, then a 180px illustration **below** the copy; circles reduce to 88px and are clipped by the section |

---

## 5. Storage band

| Range | Layout |
|---|---|
| ≥ 1024 | Headline left (max 420px), capacity card right (482–560px), swoosh bleeds right |
| 768–1023 | Headline above, card below full width, chips in 6 columns |
| 430–767 | Chips in 3 columns × 2 rows |
| < 430 | Chips in 2 columns × 3 rows |

The underline gradient rule sits 20px below the headline and stays 76 × 3px; it scales to
64 × 3px below 430px.

---

## 6. Pricing

| Range | Layout |
|---|---|
| ≥ 1280 | 6 equal columns, 14px gap, card height 156px+ |
| 1024–1279 | 3 columns × 2 rows |
| 768–1023 | 3 columns × 2 rows, card content left-aligned |
| 640–767 | 2 columns × 3 rows |
| < 640 | 1 column; cards become horizontal rows: icon+name left, capacity+price right, CTA full width beneath; the highlighted card keeps its 2px border and the "Most Popular" pill moves inline next to the plan name |

The highlighted card never changes grid position — it stays in plan order (Plus is 3rd),
exactly as in the reference.

`/pricing` also renders a comparison table: below 768px the table becomes one stacked
card per plan (each plan's feature list), avoiding horizontal scroll.

---

## 7. CTA band

| Range | Behaviour |
|---|---|
| ≥ 1024 | 137–180px tall, radius 20px, artwork at both ends, copy centred |
| 768–1023 | 160px tall, artwork reduces to 60% and moves behind the copy |
| < 768 | Auto height with 40px padding, artwork becomes a low-opacity background at 30% so text keeps contrast; the folder art and cloud are hidden below 480px |

The band is never full-bleed to the screen edge — it keeps the container gutter, as in the
reference (32px inset at 941px).

---

## 8. Footer

| Range | Layout |
|---|---|
| ≥ 1024 | Brand block left, 4 link columns, vertical rule, social right |
| 768–1023 | Brand on its own row, then 4 link columns in one row |
| < 768 | Brand row, then 2 × 2 link columns, social row beneath |

Footer link tap targets are padded to ≥ 40px height on touch.

---

## 9. Touch and input

- Minimum interactive size 44 × 44px on touch widths.
- Inputs use `font-size: 16px` at mobile to prevent iOS zoom.
- The pricing toggle and currency selector are ≥ 40px tall on mobile.
- Hover-only affordances are duplicated with focus/active states.

---

## 10. Verification

Screenshots are captured at all eight widths plus 941px and stored in
`docs/design/screenshots/`. Each capture is checked for:

1. No horizontal overflow (`scrollWidth === innerWidth`).
2. No element overlapping text at any breakpoint.
3. Buttons not clipped and wrapping cleanly.
4. Illustration aspect ratios preserved.
5. Header state correct at top and scrolled.
6. The mobile sheet opens, traps focus and closes on Escape.
7. Plan cards keep the same order at all sizes.

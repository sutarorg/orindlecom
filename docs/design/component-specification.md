# Orindle — Component Specification

Every public component lives under `src/components`. Components are server components
unless marked **client**. All styling comes from the token layer through Tailwind
utilities generated in `src/app/globals.css`.

Naming: `site-header`, `site-footer`, `hero`, `product-mockup`, `feature-trio`, … —
kebab-case files, PascalCase exports.

---

## Layout shell

### `SiteHeader` (client)

| Prop | Type | Notes |
|---|---|---|
| `variant` | `"marketing" \| "minimal"` | `minimal` hides the marketing nav (auth/policy pages) |

Structure: `<header>` → logo link → `<nav aria-label="Primary">` → right cluster
(Sign in link, Get started button) → `MobileNav` trigger below 900px.

States:
- **top** — transparent, over the page pastel wash.
- **scrolled** — `bg-white/80 backdrop-blur-md` + bottom hairline + `--shadow-xs`.
  Triggered at `scrollY > 12`.
- **mobile-open** — trigger becomes a close icon, sheet is rendered in a portal.

The sticky header is `position: sticky; top: 0; z-index: 60` so page content scrolls
beneath it. It does not shift layout on scroll (no height change).

### `MobileNav` (client)

Full-height sheet from the right, width `min(86vw, 380px)`, white, `--shadow-xl`, with a
backdrop scrim at `rgba(14,20,48,.32)`. Contents: close button, primary links at 20px/700,
divider, Sign in, Get started. Behaviour: focus trap, Escape closes, body scroll lock,
restores focus to the trigger.

### `SiteFooter`

Grid: brand block (cloud glyph + wordmark, one-line positioning statement) then four link
columns (Product / Company / Resources / Legal) and a social cluster with a vertical rule
between columns and social at ≥ 1024px. Hairline top border. No newsletter capture (the
reference has none and Orindle has no verified mailing list).

---

## Marketing sections

### `Hero`

Two-column at ≥ 1024px (`grid-template-columns: minmax(0,1fr) minmax(0,1.12fr)`,
56px gap), stacked below with the mockup after the copy.

| Sub-part | Spec |
|---|---|
| `h1` | 3 lines, hard breaks preserved with `<br>` at ≥ 640px, natural wrap below. Line 3 in `--color-primary`. `text-balance` off (the reference breaks are intentional). |
| Body | 400px max-width, two sentences |
| CTA row | primary + secondary, 14px gap, wraps to full-width stacked below 420px |
| Assurance | 13px subtle with a 15px crossed-circle icon, `No credit card required`. **Hidden below `sm`** — on a phone it pushed the product mockup below the fold, and the same reassurance sits on the pricing page and in signup |

### `HeroBackdrop`

Absolutely positioned decorative layer, `aria-hidden`, `pointer-events-none`, clipped by
`overflow-hidden` on the hero. Layers in paint order:
1. `radial-gradient` lavender blob, top-left, 720 × 620, blur not needed (already radial).
2. Mint-cyan blob, top-right, 560 × 420.
3. Peach-blush blob, right edge, 420 × 340.
4. Blue floor wash under the mockup: linear gradient to transparent.
5. Two floating rounded tiles (22px, `--primary` at 40% and 22% opacity, rotated).
6. A 1200px circle outline at 1px `rgba(49,120,251,.10)` arcing behind the wordmark.

All blobs use `filter: blur(...)` only where a hard radial edge would show.

### `ProductMockup` (the hero file-manager panel)

Rendered at an intrinsic 504 × 277 design size and scaled with a CSS transform or
`clamp()` typography so text never becomes illegible. Rotated `-2.2deg`. Contains:

- `MockupSidebar`: logo row, 5 nav rows (Home active), storage card.
- `MockupToolbar`: search field, view toggles, segmented group, avatar.
- `MockupFolderGrid`: 4 folder tiles with gradient glyphs.
- `MockupDropZone`: dashed border, upload glyph, two-line caption.
- `MockupUploadButton`: primary small button.

This is the "showcase" variant. A **real** file-manager component
(`FileManager`) with working selection, view toggle and an honest empty state is used on
`/features` and in the authenticated shell later.

Content policy: the mockup shows an **empty-state library** (folders only, no files, no
user names, no timestamps). The storage caption reads `6 GB / 10 GB` only inside the
decorative hero composition, which is labelled as illustrative; the `/features` preview
uses a true empty state with `0 B / 10 GB`.

### `FeatureTrio`

Three columns. Each column: `StepBadge` (22px circle, `01/02/03`, per-column tint) →
`h3` → `p` (2 lines max at reference width) → `IllustrationSlot` (200px tall, art anchored
to the bottom so the section crops it, matching the reference).

Illustrations are separate components: `StorePanelArt`, `DevicesArt`, `ShareCardArt`.
Each renders one inline `<svg viewBox="0 0 290 200" preserveAspectRatio="xMidYMax meet">`
that fills the slot, so the slot's height changes the scale and never the composition.
They are `aria-hidden` and carry no text alternative: everything they say is said by the
`h3` and `p` beside them.

### `StorageBand`

Asymmetric: headline (2 lines, `h2` scale) + gradient underline rule on the left;
capacity card on the right. `PlanCapacityCard` renders six chips in a 6/3/2 column grid.
The periwinkle swoosh is a background layer with `clip-path` so it bleeds to the viewport
edge on the right.

### `PlanCapacityCard`

| Prop | Type |
|---|---|
| `plans` | `Plan[]` (from `src/config/pricing.ts`) |

Chips show glyph + capacity label only. Tints come from the plan's `accent` field.

### `PricingSection`, `PlanCard`, `BillingToggle`, `CurrencySelector`

`PlanCard` props: `plan`, `billing` (`"monthly" | "yearly"`), `currency`, `highlighted`,
`href`. Renders icon, name, capacity, formatted price, period suffix, CTA.

`BillingToggle` — **client**. A real radio group rendered as a segmented pill:
`role="radiogroup"`, arrow-key navigation, `aria-checked`. When a yearly price is not
configured the yearly option still exists but shows the monthly price with an explicit
"Annual pricing not yet announced" note rather than inventing a discount.

`CurrencySelector` — **client**. Native `<select>` styled to match (native keeps mobile
picker UX and full a11y for free), `aria-label="Display currency"`. Options come from
`src/config/pricing.ts`; only INR and USD carry prices. Selecting GBP/EUR/AED/SGD/AUD/CAD
shows "Pricing for this region is being finalised" instead of a fabricated number.

Both persist their choice in a cookie and re-render server-side on next request.

### `CtaBand`

Full-bleed container with a 20px-radius pastel gradient panel, 137px min-height at
desktop. Left/right generated artwork positioned absolutely and cropped by
`overflow-hidden`. Centre column: `h2` (23px at reference, 32px desktop), subhead,
primary pill CTA with arrow.

### `FaqAccordion` (client)

Radix Accordion, `type="single"`, `collapsible`. Items from config. A searchable variant
(`FaqSearch`) is used on `/faq`, filtering by question + answer text and announcing the
result count via `aria-live="polite"`.

### `ContactForm` (client)

React Hook Form–free, plain controlled state to keep bundle lean. Fields: name, email
(validated), subject (select: Sales / Support / Billing / Privacy / Other), message
(10–2000 chars). Submits to a server action `submitContact()` in
`src/app/contact/actions.ts` with a honeypot field + timestamp check. Success and error
states are inline, announced with `role="status"`. The action currently validates and
returns a structured result; Resend delivery is wired behind
`process.env.RESEND_API_KEY` and reports "not configured" when absent rather than
pretending to send.

---

## Product components (reused by /features and later phases)

### `FileManager` (client)

Real, working manager over an **empty** library.

- Toolbar: breadcrumb, search input (filters folders), view toggle (grid/list),
  New folder button (disabled with an explanatory tooltip until storage is connected).
- Sidebar: Home, My Files, Shared, Recent, Trash, storage meter.
- Body: grid or list. Falls back to `EmptyState` when the library is empty.
- Keyboard: roving tabindex over tiles, Enter opens, Space selects.

### `StorageMeter`

Props: `used`, `total`, `label?`. Renders a 6px track, a filled bar, and a right-aligned
caption. Colour: primary fill; `> 80%` switches to amber; `≥ 100%` to red. Always paired
with a text value — never colour-only.

### `EmptyState`

Illustration slot + heading + one sentence + primary action. Used for an empty file
library, empty trash, empty search results and 404.

---

## Page-level composition

| Route | Sections in order |
|---|---|
| `/` | Header · Hero(+backdrop+mockup) · FeatureTrio · StorageBand · Pricing · CtaBand · Footer |
| `/pricing` | Header · PageIntro · Billing+Currency controls · Pricing grid · ComparisonTable · FAQ · CtaBand · Footer |
| `/features` | Header · PageIntro · Feature deep-dives (alternating) with real FileManager previews · StorageBand · FAQ (subset) · CtaBand · Footer |
| `/security` | Header · PageIntro · Security pillar list · Data-flow diagram (code) · Practices table · FAQ · Footer |
| `/business` | Header · PageIntro · Team capabilities · Admin controls · Business pricing note · CtaBand · Footer |
| `/about` | Header · PageIntro · What Orindle is / principles · Where it is built · Contact pointer · Footer |
| `/contact` | Header · PageIntro · ContactForm + support details · Response-time note · Footer |
| `/faq` | Header · PageIntro · FaqSearch + categorised accordion · Still-need-help card · Footer |

Every page ends with the same footer and uses the same header.

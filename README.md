# Orindle — Public Website

The marketing site and product frontend for **Orindle**, a personal and business cloud
storage product. This repository currently contains **PROMPT 1 only**: the public
website. There is no application backend, no authentication, and no file storage here —
every account-related surface is an honest "not open yet" panel rather than a dead form.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

Node 20+. Built and verified on Next.js 16.4.6 / React 19.3.1 / Tailwind CSS 4.3.5.

---

## Routes

| Route | Rendering | What it is |
|---|---|---|
| `/` | dynamic (ƒ) | Landing page — hero, feature trio, storage band, product preview, pricing, FAQ, CTA |
| `/features` | static | Feature detail, storage and sharing explainers |
| `/pricing` | dynamic (ƒ) | Six plans, monthly/yearly toggle, 8-currency selector, comparison table |
| `/business` | static | Team accounts — one pool, roles, folder permissions, centralised billing |
| `/security` | static | Encryption, access and the explicit "what Orindle does not claim" panel |
| `/about` | static | Why it exists, company principles, "where we are" status |
| `/contact` | dynamic (ƒ) | Contact form (server action) + direct email and response expectations |
| `/faq` | static | 20 answers across 7 categories, searchable and filterable |
| `/privacy` | static | Privacy policy (7 sections, review notice) |
| `/terms` | static | Terms of service (8 sections, review notice) |
| `/sign-in`, `/sign-up` | static | "Accounts open with the first release" — no dead form |
| `/_not-found` | static | 404 |
| `/sitemap.xml`, `/robots.txt` | static | 10 indexable URLs; `/sign-in` and `/sign-up` disallowed |

`/` and `/pricing` are dynamic because they read the `orindle_currency` cookie on the
server so the first paint already shows the right currency — no layout shift, no
client-side currency flash.

## Layout

```
src/
  app/                  routes, globals.css, sitemap.ts, robots.ts, not-found.tsx
  components/
    marketing/          hero, feature-trio, storage-band, product-preview, cta-band, faq-section
    layout/             site-shell, site-header (mobile drawer), site-footer, legal-page
    pricing/            pricing-section, plan-card, pricing-controls, comparison-table
    product/            product-mockup, file-manager, storage-meter, empty-library-preview
    brand/              logo, plan-icon
    ui/                 button and primitives
  config/               site.ts, pricing.ts, faq.ts  ← all copy and numbers live here
  lib/                  seo.ts (pageMetadata), cn, utils
  styles/tokens.css     design tokens — the single source of truth
```

Copy, prices and FAQs are data, not markup. Change `src/config/*.ts` rather than the
components where possible.

## Configuration

Copy `.env.example` to `.env.local`. Nothing is required to render the site:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for metadata, the sitemap and robots.
- `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` — contact form delivery. **Without the key
  the form still validates and tells the visitor the deployment is not configured**,
  pointing them at the support address. It never claims a message was sent when it
  was not.

Region is detected in `src/middleware.ts` from `x-vercel-ip-country` / `cf-ipcountry` /
`x-country-code` and written to an `orindle_region` cookie; an existing cookie is never
overwritten. Currency choice is separate (`orindle_currency`) and always wins.

## Content policy

This site is deliberately conservative about claims. It does **not** publish invented
testimonials, customer logos, user counts, file-size or timestamp examples dressed up as
real data, security certifications, a refund policy, a founder story or a team roster.
Where the reference design implied such content, the page says the thing is *not
published yet* and points at the support address instead. Business plans and annual
pricing are likewise marked as not announced. Keep this rule when editing copy.

## Verification

Screenshots of every page at nine viewport widths (360 · 390 · 430 · 768 · 941 · 1024 ·
1280 · 1440 · 1920) live in `docs/design/screenshots/` — 90 full-page PNGs, generated
and checked for horizontal overflow. Design rationale, tokens and reference
measurements are in `docs/design/`.

The scripts that produced those screenshots and the interaction checks are local
tooling and are not committed (see `.gitignore`). To re-verify after a build:

```bash
npx tsc --noEmit && npx next build     # types + all 14 routes
```

Then load each route at 360px and 1280px and confirm: no horizontal scrollbar, the
mobile drawer opens with Escape to close, the yearly toggle shows the "not announced
yet" notice, the currency selector shows the "not yet published" state for £/€, FAQ
search filters, and the contact form keeps typed values after a failed submit.

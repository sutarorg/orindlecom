# Orindle — Website & Authentication

The marketing site and authentication screens for **Orindle**, a personal and business
cloud storage product. This repository currently contains **PROMPT 1** (the public
website) and **PROMPT 2** (authentication UI/UX and frontend integration contracts).
There is no file storage here — the account page confirms identity and says plainly
that nothing uploaded is stored.

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
| `/login` | dynamic | Sign in — email/password, OAuth, remember-me |
| `/signup` | dynamic | Create account — name, email, password, confirm, terms |
| `/forgot-password` | dynamic | Request a reset link |
| `/reset-password` | dynamic | Choose a new password (requires a recovery session) |
| `/verify-email` | dynamic | Explain confirmation + resend the link |
| `/auth/callback` | route handler | Exchanges a code/token for a session, then redirects |
| `/api/auth/oauth/[provider]/start` | route handler | POST — returns the provider consent URL |
| `/account` | dynamic | Where a confirmed session lands |
| `/sign-in`, `/sign-up` | static | 308 to `/login`, `/signup` (query string preserved) |
| `/_not-found` | static | 404 |
| `/sitemap.xml`, `/robots.txt` | static | 10 indexable URLs; `/sign-in` and `/sign-up` disallowed |

`/` and `/pricing` are dynamic because they read the `orindle_currency` cookie on the
server so the first paint already shows the right currency — no layout shift, no
client-side currency flash. The auth routes are dynamic because they read the session.

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
  components/auth/      auth layout, card, inputs, strength meter, alerts, 5 forms
  config/               site.ts, pricing.ts, faq.ts  ← all copy and numbers live here
  lib/                  seo.ts (pageMetadata), cn, utils
  lib/auth/             types.ts (contract), validation.ts (shared), service.ts,
                        supabase/ (adapter, errors, cookies), redirect.ts
  app/(auth)/           login, signup, forgot-password, reset-password, verify-email
                        + actions.ts (all auth server actions)
  styles/tokens.css     design tokens — the single source of truth
```

Copy, prices and FAQs are data, not markup. Change `src/config/*.ts` rather than the
components where possible.

## Configuration

Copy `.env.example` to `.env.local`. Nothing is required to render the site:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for metadata, the sitemap and robots.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — authentication.
  **Without them every auth form still renders and validates, then says plainly that
  accounts aren't connected.** Nothing is created and nothing is sent.
- `NEXT_PUBLIC_AUTH_PROVIDERS` — comma list of providers actually enabled in the
  Supabase dashboard (e.g. `google`). A social button appears only for those.
- `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` — contact form delivery. **Without the key
  the form still validates and tells the visitor the deployment is not configured**,
  pointing them at the support address. It never claims a message was sent when it
  was not.

The Supabase **service-role key must never be added to this repository** — it bypasses
row-level security, and nothing here reads it.

Region is detected in `src/middleware.ts` from `x-vercel-ip-country` / `cf-ipcountry` /
`x-country-code` and written to an `orindle_region` cookie; an existing cookie is never
overwritten. Currency choice is separate (`orindle_currency`) and always wins.

## Authentication

Screens are built to the same token layer as the marketing site — same pastels, radii,
type scale and button geometry — on a card-on-wash composition rather than a
stock-photo split screen, because the reference has no photography.

Two rules the code enforces rather than documents:

1. **No success the backend didn't confirm.** There is no optimistic state anywhere.
   An unconfigured deployment explains itself instead of pretending to sign you in.
2. **No account enumeration.** Password recovery responds identically whether or not
   the address exists, and never echoes the address back.

Architecture: components call `getAuthService()`, which returns a typed contract
(`src/lib/auth/types.ts`). The Supabase adapter is one implementation behind it and is
`server-only` — the provider SDK never reaches the browser. Every method returns a
result object; nothing throws. Errors map to stable codes, never provider strings.

See `docs/auth/` for the flow, screen spec, contract and state handling.

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
npx tsc --noEmit && npx next build     # types + all routes
```

Then load each route at 360px and 1280px and confirm: no horizontal scrollbar, the
mobile drawer opens with Escape to close, the yearly toggle shows the "not announced
yet" notice, the currency selector shows the "not yet published" state for £/€, FAQ
search filters, and the contact form keeps typed values after a failed submit.

Authentication screens were verified the same way — 63 additional full-page screenshots
(7 routes × 9 widths) with zero overflow, plus scripted checks for validation timing,
the loading state, password reveal, strength scoring, callback error codes, keyboard
focus rings and mobile input size (16px, so iOS doesn't zoom). See
`docs/auth/auth-state-handling.md` §11 for the log.

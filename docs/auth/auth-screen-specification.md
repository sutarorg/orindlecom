# Orindle — Auth Screen Specification

The visual contract for every authentication screen. Values are inherited from
`docs/design/design-system.md` and `src/styles/tokens.css`; nothing here
introduces a colour, radius or type size that isn't in the token layer.

**The governing rule:** these screens must read as the same product as the
marketing site. No default Supabase appearance, no generic split-screen template
with a stock photo. The reference has no full-height photograph, so neither do we.

---

## 1. Composition

### Why not a split screen

The reference design is a card on a pastel wash. Its atmosphere comes from three
soft radial gradients over white, not from photography. An auth screen built as
"form on the left, lifestyle photo on the right" would be a different product.

So the layout is:

- **One centred card**, 420–440px wide, on the same pastel wash the hero uses.
- On wide viewports (≥ 1024px) a **quiet aside column** fills the space the card
  would otherwise leave empty. It restates the product promise — it is not a
  testimonial, a logo wall or a metric, because the site publishes none of those.
- Below 1024px the aside is hidden and the card centres. Nothing is lost that a
  phone user needs.

### Grid

```
≥1024px   container 1280  ·  [ 420px card ] [ gap 48 ] [ 1fr aside ]  max 920
<1024px   container 1280  ·  [ 440px centred ]
<640px    no card chrome   ·  full-bleed form on the wash
```

### Header and footer

A **minimal header**: wordmark left, "Back to site →" right. No primary nav — a
visitor halfway through sign-up should not be handed a bar that invites them to
leave. The footer carries the copyright, Privacy, Terms and Support only.

---

## 2. The card

| Property | Value |
|---|---|
| radius | `20px` (`--brand-radius-xl`) |
| border | `1px` `--brand-border` `#E6E9F2` |
| background | `#FFFFFF` |
| shadow | `--brand-shadow-lg` |
| padding | `20px` (phone) · `32px` (sm) vertical `28px`/`36px` |

**Below 640px the card dissolves.** Border, background and shadow are removed so
the form becomes the page. A floating panel 16px from each edge reads as a widget;
a full-bleed form reads as the thing you came to do.

### Inside the card

Order is fixed across all screens:

1. **Eyebrow** — 11px, 600, uppercase, `0.12em` tracking, primary blue.
   `WELCOME BACK` · `GET STARTED` · `PASSWORD HELP` · `ONE STEP LEFT` · `ALMOST THERE`
2. **Title** — 19px (22px ≥ 640), weight 800, `-0.035em`. One `h1` per page.
3. **Description** — 13px, `--brand-text-muted`, max ~2 lines.
4. **Body** — form or state panel, `24px` below the description.

---

## 3. Type scale

| Role | Size | Weight | Tracking | Colour |
|---|---|---|---|---|
| Eyebrow | 11px | 600 | `0.12em` | `--brand-primary` |
| Title | 19 → 22px | 800 | `-0.035em` | `--brand-ink` |
| Description | 13px | 400 | default | `--brand-text-muted` |
| Label | 12.5px | 600 | `-0.01em` | `--brand-ink` |
| Input text | 14px (**16px < 640px**) | 400 | default | `--brand-ink` |
| Hint | 11.5px | 400 | default | `--brand-text-subtle` |
| Error | 11.5px | 500 | default | `#C93B2B` |
| Button | 14px | 600 | default | white on primary |
| Legal/footnote | 11.5px | 400 | default | `--brand-text-subtle` |

**The 16px mobile input is not cosmetic.** Anything smaller makes iOS Safari zoom
the viewport on focus, which shifts the layout mid-typing and often leaves the
field half off-screen.

---

## 4. Controls

### Text input

| State | Border | Ring |
|---|---|---|
| Default | `1px #D5DAEA` | — |
| Hover | `1px #C3CADE` | — |
| Focus | `1px #3178FB` | `3px rgba(49,120,251,.16)` |
| Error | `1px #D6455D` | `3px rgba(214,69,93,.16)` on focus |
| Disabled | `#D5DAEA`, `--brand-surface-muted` fill | — |

Height `44px`, radius `12px`, padding `0 14px` (`pr 44px` when a trailing control
exists), `--brand-shadow-xs` at rest.

### Password input

Identical shell plus a reveal button at the right:

- `type="button"`, so it never submits the form.
- `aria-pressed` reflects the state; `aria-label` flips between "Show password"
  and "Hide password".
- `onMouseDown` is prevented so the caret stays where the visitor left it.
- Revealing changes `type` only. `autocomplete` stays `current-password` /
  `new-password` — switching to `text` makes some managers offer to save the
  value as a username.
- 32px button inside 44px field; does not sit before the input in tab order.

### Checkbox

24px box (WCAG 2.5.8 minimum target), radius 6px, `#317FEB` when checked, white
check at stroke width 3. The native input stays in the DOM and keeps focus, so
keyboard and password managers see a real checkbox. The label extends the
clickable area across the whole row.

### Submit button

`44px` tall, full width, radius `12px`, `--brand-primary` fill,
`--brand-shadow-primary`.

| State | Treatment |
|---|---|
| Hover | `--brand-primary-hover`, `translateY(-1px)` |
| Active | `--brand-primary-active`, `translateY(0)` |
| Focus | `2px` primary ring, `2px` offset |
| Disabled | `opacity .6`, no shadow, `pointer-events: none` |
| **Loading** | spinner + label swaps to present participle ("Signing in…"), `disabled`, `aria-busy="true"` |

During loading the button keeps its width by swapping only the label. A button
that resizes mid-click moves the target out from under the pointer.

### Social button

Only rendered for providers the deployment has actually enabled — a button that
always errors is worse than no button. Height 44px, white fill, `1px #D5DAEA`,
radius 12px, official four-colour Google mark at 17px, 13.5px/600 label.
While pending it shows a spinner and "Opening Google…" and keeps that state
through the redirect.

---

## 5. States, per screen

Every interaction has all nine states defined. Where a screen has no meaningful
rendering for one, that is stated rather than left ambiguous.

| State | Rendering |
|---|---|
| Default | As specified above |
| Hover | Border darkens; primary fill darkens |
| Focus | 3px halo + solid blue border; **never removed** |
| Active | 1px press on buttons |
| Disabled | 45–60% opacity, no pointer events, `cursor: not-allowed` on inputs |
| Loading | Spinner, label to present participle, `aria-busy`, all inputs disabled |
| Validation error | Red border + inline message with icon; `aria-invalid`, `aria-describedby`, `role="alert"` |
| Success | Form replaced by `SuccessPanel` with a green check; `role="status"` |
| Network error | `Alert tone="error"` above the form, inputs re-enabled, values kept |

### Error message style

Sentence case, ends with a full stop, says what to do:

| Instead of | We write |
|---|---|
| "Invalid input" | "Enter an email address we can reply to." |
| "Required field" | "Enter your name." |
| "Passwords do not match" | "Those passwords don't match yet." |
| "Authentication failed" | "That email and password don't match an account." |

Nothing blames the visitor for a server failure, and nothing says "Oops".

---

## 6. Screen-by-screen

### `/login`

Eyebrow `WELCOME BACK` · title "Sign in to your files" · description "Everything
you saved is where you left it — on every device you use."

Order: deployment notice (if unconfigured) → callback error (if present) → OAuth
+ divider (if any provider enabled) → email → password + reveal → remember-me ↔
forgot-password row → Sign in → footer "New to Orindle? Create a free account".

Remember-me and Forgot-password share one row: checkbox left, link right. The
link uses primary blue and is 12.5px/600 — visually a peer of the checkbox, not a
footnote.

### `/signup`

Eyebrow `GET STARTED` · title "Start with 10 GB free".

Fields: Full name → Email (hint "We'll send a confirmation link. No marketing
unless you ask.") → Password + strength meter → Confirm password → Terms
checkbox with inline links to `/terms` and `/privacy` → Create account.

Closing line: "10 GB free. No credit card, and nothing to cancel." — the same
promise the pricing page makes.

When `?plan=<id>` matches a real plan the description changes to "Create the
account first — you can move to a paid plan whenever you're ready." An
unrecognised value is dropped.

### Password strength meter

Four 4px segments above a label. Fills left to right; colours
`#E0644A` → `#E9A13B` → `#3F8FEB` → `#2FA76B`.

| Level | Score | Meaning |
|---|---|---|
| Weak | 1 | Under 12 characters, or a known/common pattern |
| Fair | 2 | Decent length, low variety |
| Good | 3 | Long, or good variety |
| Strong | 4 | Long *and* varied |

Colour is never the only signal: the label names the level and one suggestion says
what to change. Exposed as `role="progressbar"` with `aria-valuenow` 0–4 and
`aria-valuetext`. Deliberately **advisory** — the only hard rule is the
8-character minimum. Character-class rules push people toward `Password1!` without
adding real entropy.

### `/forgot-password`

Eyebrow `PASSWORD HELP` · title "Reset your password" · description "Enter the
email address on your account and we'll send a link to choose a new password."

One field, one button ("Send reset link"), one footnote explaining the link is
single-use, expires in an hour, and that we don't say whether an address has an
account.

**Success state** replaces the form entirely with `SuccessPanel` titled "Check
your inbox". It does not echo the address. It mentions spam, and it explains the
rate limit before the visitor hits it.

### `/reset-password`

Two possible renders, decided **on the server**:

- **With a recovery session** — New password + strength → Confirm new password →
  "Update password". Success replaces the form with "Password updated" and a
  primary button through to `/login`.
- **Without** — title becomes "This link has expired"; a warning alert explains
  links are single-use and expire after an hour; one primary button to request a
  new one.

Rendering the form without a session and failing on submit would waste the
visitor's time and their new password.

### `/verify-email`

Eyebrow `ONE STEP LEFT` · title "Confirm your email address".

- Description names the address when we know it, stays general when we don't.
- An info panel: "The link works once — it expires after 24 hours. Until you
  confirm, your library stays empty and you can't sign in."
- Resend form: email field (prefilled or honestly blank) + "Resend verification
  email". Success shows a green "Link sent" alert and disables the button so a
  second click can't burn the rate limit.
- Footnote covers spam and the support address.
- `?error=link_expired` adds a warning panel above the form.

### `/auth/callback`

Never renders. See `authentication-flow.md` §7.

### `/account`

Not part of the auth UI proper, but it is where every success lands, so it has to
exist and be honest. Shows the first name, the confirmed email, whether the email
is confirmed, and a panel stating that the file library isn't built yet and that
nothing uploaded is stored. Sign-out in the header.

---

## 7. Component inventory

| Component | File | Client? |
|---|---|---|
| `AuthLayout` | `components/auth/auth-layout.tsx` | no |
| `AuthCard` | `components/auth/auth-card.tsx` | no |
| `AuthAside` | `components/auth/auth-aside.tsx` | no |
| `FormField` + `controlClass` | `components/auth/form-field.tsx` | yes (shared) |
| `TextInput` | `components/auth/text-input.tsx` | yes |
| `PasswordInput` | `components/auth/password-input.tsx` | yes |
| `PasswordStrength` | `components/auth/password-strength.tsx` | yes |
| `Checkbox` | `components/auth/checkbox.tsx` | yes |
| `SubmitButton` | `components/auth/submit-button.tsx` | yes |
| `SocialSignIn` | `components/auth/social-sign-in.tsx` | yes |
| `Divider` | `components/auth/divider.tsx` | no |
| `Alert` / `SuccessPanel` | `components/auth/alert.tsx` | yes |
| `LoginForm` | `components/auth/login-form.tsx` | yes |
| `SignupForm` | `components/auth/signup-form.tsx` | yes |
| `ForgotPasswordForm` | `components/auth/forgot-password-form.tsx` | yes |
| `ResetPasswordForm` | `components/auth/reset-password-form.tsx` | yes |
| `ResendVerificationForm` | `components/auth/resend-verification-form.tsx` | yes |

Every form component follows the same shape: `useActionState` over a server
action, local mirror of field errors so they clear on the next edit, and a single
`clearOnEdit` helper.

---

## 8. Responsive behaviour

| Width | Layout |
|---|---|
| 360–429 | Full-bleed form, 16px gutters, 16px input text, stacked remember/forgot not needed (they fit) |
| 430–639 | Full-bleed form, 20px gutters |
| 640–1023 | Card returns (border, white, shadow) at 440px centred, 32px padding |
| 1024–1279 | Card + aside, 920px grid, card 420px |
| ≥ 1280 | Card + aside, 920px grid, container padding 40px |

Verified across 360 · 390 · 430 · 768 · 941 · 1024 · 1280 · 1440 · 1920 — 63
full-page screenshots in `docs/design/screenshots/`, **zero horizontal overflow,
zero elements past the viewport**.

---

## 9. Accessibility

| Requirement | Implementation |
|---|---|
| Keyboard | Every control reachable; logical order; no positive tabindex |
| Visible focus | 3px halo + solid border on inputs, 2px ring on buttons/links. Verified by computing `box-shadow` on real focus. |
| Labels | Persistent `<label for>` on every field. No placeholder-as-label. |
| Password managers | Correct `autocomplete` on every field: `username`, `current-password`, `new-password`, `name`, `email`. Verified by script. |
| Screen readers | `aria-invalid` + `aria-describedby` wired from the same source as the visible error; errors carry `role="alert"`, successes `role="status"` |
| Touch targets | 44px controls, 32px minimum for small buttons, 24px checkbox (WCAG 2.5.8). Inline text links are exempt by the same criterion. |
| Reduced motion | Transitions collapse to `1e-06s` under `prefers-reduced-motion` |
| Language | `<html lang="en">`; one `h1` per page; `main` landmark present |
| Zoom | 16px inputs on mobile prevent Safari's focus zoom |

Verified with `tsc --noEmit`, a scripted accessibility pass over all four main
screens, and a keyboard-only traversal capturing `:focus-visible` state at every
tab stop.

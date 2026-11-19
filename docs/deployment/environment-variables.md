# Environment Variables

**Rule:** a variable exists to switch a feature *on*. With it unset the feature
degrades honestly rather than silently pretending to work. No variable is required
for the site to render.

Names and purposes only — never values. Values live in the platform's secret store.

---

## 1. Public (safe to ship in the browser bundle)

| Name | Purpose | Unset behaviour |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, sitemap, robots | Defaults to the production origin |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Auth returns `not_configured`; auth screens render and explain |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key, RLS-scoped | Same |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | Comma list of providers **actually enabled** in the dashboard | No social buttons shown |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | Master switch for browser analytics collection | `false` — no analytics script loads at all |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement id (`G-…`), for collection | No collection; admin analytics reports "not connected" |

**The `NEXT_PUBLIC_` prefix is a claim that the value is safe to publish.** Nothing
secret may ever carry it. A deployed bundle is public; treat every `NEXT_PUBLIC_*`
value as if it were printed on the site.

`NEXT_PUBLIC_AUTH_PROVIDERS` is deliberately not a feature toggle but a *statement of
fact*: listing `google` asserts the provider is configured in Supabase. A button that
always fails is worse than no button, which is why this is manual rather than derived.

---

## 2. Server-only

| Name | Purpose | Unset behaviour |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged client for jobs and webhooks | Background work reports `not_configured`; nothing bypasses RLS |
| `R2_ACCOUNT_ID` | Cloudflare account | Uploads unavailable |
| `R2_ACCESS_KEY_ID` | R2 credential | Same |
| `R2_SECRET_ACCESS_KEY` | R2 credential | Same |
| `R2_BUCKET` | Bucket name, per environment | Same |
| `R2_ENDPOINT` | S3-compatible endpoint | Same |
| `R2_PUBLIC_BASE_URL` | Public base for **`avatars/` only** | No public asset URLs; private files unaffected |
| `BILLING_PROVIDER` | Which provider takes **new** checkouts (`dodo`) | Defaults to `dodo`; any value other than `dodo` disables paid checkout rather than falling back to a second provider |
| `DODO_PAYMENTS_API_KEY` | Server-side Dodo API credential | Checkout returns `not_configured`; paid plans cannot be bought |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Dodo Standard Webhooks signing key | `/api/webhooks/dodo` returns `503 not_configured` and activates nothing |
| `DODO_PAYMENTS_ENVIRONMENT` | Which Dodo environment the credentials belong to (`test` or `live`) | Defaults to `test`; a disagreement with the deployment target is reported as `mismatch` |
| `RAZORPAY_KEY_SECRET` | **Legacy.** Signature verification for in-flight historical Razorpay payments | The legacy verify route refuses; no new checkout is affected |
| `RAZORPAY_WEBHOOK_SECRET` | **Legacy.** Webhook HMAC for historical Razorpay events | The legacy webhook route returns `not_configured`; no new checkout is affected |
| `RESEND_API_KEY` | Transactional email | Contact form returns `unconfigured` with a fallback address |
| `RESEND_FROM_ADDRESS` | Verified sender | Dev sandbox address; delivery only to the account owner |
| `CRON_SECRET` | Bearer check on cron routes | Cron routes 404 |
| `MALWARE_SCAN_ENABLED` | Whether a scanner is wired | `false`; nothing may claim scanning |
| `RAZORPAY_INTERNATIONAL_ENABLED` | **Legacy.** Whether the old merchant account may charge non-INR cards | `true`; no new checkout is affected |
| `RAZORPAY_RECURRING_ENABLED` | **Legacy.** Whether auto-renewing subscriptions were enabled on the old account | `true`; no new checkout is affected |
| `TRASH_RETENTION_DAYS` | Trash retention | 30 |
| `RECOVERY_WINDOW_DAYS` | Post-expiry recovery window | 90 |
| `ANALYTICS_PROVIDER` | Which reporting adapter to use | `ga4`; an unknown value falls back to GA4 |
| `GA_PROPERTY_ID` | GA4 numeric property id, for **reporting** | Admin analytics reports "not connected" and names this variable |
| `GA_SERVICE_ACCOUNT_EMAIL` | Service-account identity with Analytics Data API access | Same |
| `GA_SERVICE_ACCOUNT_PRIVATE_KEY` | Service-account private key (PEM, newlines as `\n`) | Same |
| `GA_LIVE_QUERIES` | Whether this build may call the GA4 Data API | `false`; with credentials present the admin page reports that live queries are switched off rather than inventing numbers |
| `GSC_SITE_URL` | Search Console property (e.g. `sc-domain:orindle.com`) | Search Console reports "not connected" |
| `GSC_SERVICE_ACCOUNT_EMAIL` | Service-account identity with Search Console access | Same |
| `GSC_SERVICE_ACCOUNT_PRIVATE_KEY` | Service-account private key | Same |

### 2.0 Analytics needs four things, and three of them are secrets

Collection and reporting are separate systems and neither works alone:

| What | Variable | Public? | If missing |
| --- | --- | --- | --- |
| Consent + master switch | `NEXT_PUBLIC_ENABLE_ANALYTICS` | public | No script loads |
| Browser collection | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | public | No pageviews are sent |
| Reporting identity | `GA_SERVICE_ACCOUNT_EMAIL` | **secret** | Server cannot query |
| Reporting credential | `GA_SERVICE_ACCOUNT_PRIVATE_KEY` | **secret** | Server cannot query |
| Which property | `GA_PROPERTY_ID` | config | Server does not know what to query |

The private key never reaches the browser: it is read inside a module marked
`server-only`, and a unit test asserts that. **Do not reuse the Google sign-in OAuth
client for analytics** — it is a different credential with different scopes, and a login
client has no Analytics Data API grant.

With credentials present but `GA_LIVE_QUERIES` unset, the admin analytics page reports
that live reporting is switched off. It does not show zeroes, which would read as "no
traffic", and it does not show estimates.

### 2.1 Dodo is the payment provider; Razorpay is legacy only

New checkouts go through Dodo Payments' hosted checkout. The Razorpay module, its key
pair and its webhook route remain only so historical subscriptions and delayed events
keep working; none of them can create a new order.

Three properties follow, and each is enforced in code rather than in a runbook:

1. **No fallback.** If Dodo is not configured, or a Dodo call fails, paid checkout is
   refused. It never routes a customer to a second provider.
2. **No browser-published credential.** `DODO_PAYMENTS_API_KEY` and
   `DODO_PAYMENTS_WEBHOOK_KEY` are server-only. Nothing Dodo-related carries a
   `NEXT_PUBLIC_` prefix, and a unit test asserts that.
3. **The environment is explicit.** `DODO_PAYMENTS_ENVIRONMENT` (`test` or `live`) is
   the source of truth. Test credentials in production and live credentials in
   development are both reported as `mismatch` by `/api/health`.

### 2.2 The legacy capability flags no longer gate anything

`RAZORPAY_INTERNATIONAL_ENABLED` and `RAZORPAY_RECURRING_ENABLED` used to refuse
orders before Razorpay was called. They no longer gate any new checkout, because
there is no Razorpay checkout left. They remain in `.env.example` so an operator can
see what the old account had configured, and they can be deleted once the legacy
arrangements are retired.

### 2.3 A correction that matters

The existing `.env.example` says the service-role key must never be added because
"nothing in this codebase reads it". That was true and is now obsolete: trash cleanup,
quota reconciliation, webhook processing and invite lookups genuinely need to bypass
RLS.

The invariant is not "the key does not exist", it is **"the key exists only in the
server environment, is read in exactly one module marked `server-only`, and never
appears in a client bundle — proven by a test that greps the build output"**. Stating
the weaker, true invariant is better than keeping a stronger, false one.

### 2.4 `R2_PUBLIC_BASE_URL` is narrower than its name suggests

It builds URLs for `avatars/` only. The helper throws for any other prefix. Private
files are served exclusively through short-lived presigned URLs, because a permanent
public URL to a private file is exactly what the requirements forbid. The `.env.example`
comment is corrected to say this rather than implying a general-purpose public base.

---

## 3. Environment separation

| Variable group | Dev | Preview | Production |
| --- | --- | --- | --- |
| Supabase | local / dev project | dev project | **production project** |
| `R2_BUCKET` | `orindle-dev` | `orindle-dev` | `orindle-prod` |
| Dodo credentials | test key | test key | **live key** |
| Dodo environment | `test` | `test` | `live` |
| Razorpay credentials (legacy) | `rzp_test_…` | `rzp_test_…` | `rzp_live_…` |
| Resend | test address | test address | verified domain |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | deployment URL | production origin |

Preview deployments point at the **dev** Supabase project. A preview that writes to
production data is how a review comment deletes a customer's files.

### 3.1 Guards the application enforces

1. **Live Dodo credentials refused outside production.** If `NODE_ENV !==
   "production"` and `DODO_PAYMENTS_ENVIRONMENT=live`, `/api/health` reports
   `mismatch` and paid checkout refuses to run.
2. **Test Dodo credentials refused in production.** The mirror image: a production
   deployment configured with `DODO_PAYMENTS_ENVIRONMENT=test` also reports
   `mismatch`, so a deployment can never silently take no money.
3. **Bucket prefix check.** A production deployment whose `R2_BUCKET` contains `dev`
   logs a startup error.

These are the three mistakes that cost real money or real data, so they are code, not
runbook steps.

---

## 4. Configuration health

`GET /api/health` reports presence — never values:

```json
{ "supabase": "configured", "r2": "missing", "billingProvider": "dodo",
  "dodo": "test-mode", "legacyRazorpay": "configured",
  "resend": "sandbox", "jobs": "configured" }
```

| State | Meaning |
| --- | --- |
| `configured` | Present and usable |
| `missing` | Absent; the feature reports `not_configured` |
| `test-mode` | Test keys in a non-production environment (correct) |
| `sandbox` | Email key present but the sender is the provider sandbox |
| `mismatch` | Present but wrong for this environment — a defect |

`dodo` reports `configured` for live mode, `test-mode` for test mode, `missing` when
the API key is absent, and `mismatch` when the configured environment disagrees with
the deployment target. `legacyRazorpay` reports only whether the historical webhook
secret is present; it never claims that the old provider can take a payment.

`mismatch` is the one worth alerting on. Everything else is a normal state the product
already handles in its UI.

---

## 5. Adding a variable

1. Add it to `.env.example` with a comment stating what unset means.
2. Add it to the server or public table above.
3. If it is a secret, confirm it cannot reach a client component.
4. If unset must break something, make the failure explicit (`not_configured`), not
   silent.
5. Set it in all three environments, or document why one differs.

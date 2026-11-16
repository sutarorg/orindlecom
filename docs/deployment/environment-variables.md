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
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Checkout key id | Billing says payments are not connected |

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
| `RAZORPAY_KEY_SECRET` | Signature verification | Checkout refuses to create an order |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook HMAC | Webhooks return `not_configured` and activate nothing |
| `RESEND_API_KEY` | Transactional email | Contact form returns `unconfigured` with a fallback address |
| `RESEND_FROM_ADDRESS` | Verified sender | Dev sandbox address; delivery only to the account owner |
| `CRON_SECRET` | Bearer check on cron routes | Cron routes 404 |
| `MALWARE_SCAN_ENABLED` | Whether a scanner is wired | `false`; nothing may claim scanning |
| `RAZORPAY_INTERNATIONAL_ENABLED` | Whether the merchant account may charge non-INR cards | `false`; an international order is **refused before it is created** |
| `RAZORPAY_RECURRING_ENABLED` | Whether auto-renewing subscriptions are enabled on the account | `false`; a recurring order is refused likewise |
| `TRASH_RETENTION_DAYS` | Trash retention | 30 |
| `RECOVERY_WINDOW_DAYS` | Post-expiry recovery window | 90 |

### 2.1 The two capability flags are refusals, not defaults

`RAZORPAY_INTERNATIONAL_ENABLED` and `RAZORPAY_RECURRING_ENABLED` both default to
`false`, and while false the server **refuses** the matching order instead of creating
one Razorpay will reject. That is deliberate: promising a payment method the merchant
account has not been approved for is the failure mode the price list forbids, and a
refused order charges nothing and says so.

Turning either on is a deliberate act, taken only after confirming the capability on
the actual account. Neither is confirmed today — see `production-readiness.md` §6.

### 2.2 A correction that matters

The existing `.env.example` says the service-role key must never be added because
"nothing in this codebase reads it". That was true and is now obsolete: trash cleanup,
quota reconciliation, webhook processing and invite lookups genuinely need to bypass
RLS.

The invariant is not "the key does not exist", it is **"the key exists only in the
server environment, is read in exactly one module marked `server-only`, and never
appears in a client bundle — proven by a test that greps the build output"**. Stating
the weaker, true invariant is better than keeping a stronger, false one.

### 2.2 `R2_PUBLIC_BASE_URL` is narrower than its name suggests

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
| Razorpay keys | `rzp_test_…` | `rzp_test_…` | `rzp_live_…` |
| Resend | test address | test address | verified domain |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | deployment URL | production origin |

Preview deployments point at the **dev** Supabase project. A preview that writes to
production data is how a review comment deletes a customer's files.

### 3.1 Guards the application enforces

1. **Live keys refused outside production.** If `NODE_ENV !== "production"` and the
   Razorpay key id does not start with `rzp_test_`, startup fails loudly.
2. **Key/environment mismatch refused in production.** A live deployment configured
   with test keys fails health rather than silently taking no money.
3. **Bucket prefix check.** A production deployment whose `R2_BUCKET` contains `dev`
   logs a startup error.

These are the three mistakes that cost real money or real data, so they are code, not
runbook steps.

---

## 4. Configuration health

`GET /api/health` reports presence — never values:

```json
{ "supabase": "configured", "r2": "missing", "razorpay": "test-mode",
  "resend": "sandbox", "jobs": "configured" }
```

| State | Meaning |
| --- | --- |
| `configured` | Present and usable |
| `missing` | Absent; the feature reports `not_configured` |
| `test-mode` | Test keys in a non-production environment (correct) |
| `sandbox` | Email key present but the sender is the provider sandbox |
| `mismatch` | Present but wrong for this environment — a defect |

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

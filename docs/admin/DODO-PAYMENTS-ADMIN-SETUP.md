# Dodo Payments — Administrator Setup Guide

**Who this is for:** the Orindle account owner. It assumes you can use a browser,
the Dodo Payments dashboard, the Supabase SQL editor and the Vercel dashboard. It
does **not** assume you can read the application's source code.

**What this document covers:** everything that has to happen in a Dodo account, in
Vercel and in Supabase before Orindle can take a payment through Dodo Payments.

**What this document does not claim:** that Dodo has approved Orindle's business
model, or that live payments work. Neither is true until you have done the steps
in §2 and §7 yourself and verified them. Code that compiles is not a payment
system.

---

## Table of contents

1. [What the coding agent has already completed](#1-what-the-coding-agent-has-already-completed)
2. [What only you can do](#2-what-only-you-can-do)
3. [Production verification](#3-production-verification)
4. [Legacy Razorpay customer transition](#4-legacy-razorpay-customer-transition)
5. [A — Dodo business account and approval](#a--dodo-business-account-and-approval)
6. [B — Create the Dodo product catalogue](#b--create-the-dodo-product-catalogue)
7. [C — Create test API credentials](#c--create-test-api-credentials)
8. [D — Configure Dodo webhooks](#d--configure-dodo-webhooks)
9. [E — Configure Customer Portal policies](#e--configure-customer-portal-policies)
10. [F — Test and production credentials](#f--test-and-production-credentials)
11. [G — Vercel and Supabase setup](#g--vercel-and-supabase-setup)
12. [H — Existing Razorpay customers](#h--existing-razorpay-customers)
13. [Troubleshooting](#troubleshooting)

---

## 1. What the coding agent has already completed

Everything in this section is **done in code** and is in the repository on the
branch `arena/f9f28e62-orindlecom`. You do not need to write any code.

### 1.1 The payment integration

| What | Where |
| --- | --- |
| The Dodo SDK client, price resolution, product validation, checkout sessions, plan changes, cancellation, customer portal | `src/domain/billing/dodo.ts` |
| Pending checkout records and the provider customer mapping | `src/domain/billing/checkout-session.ts` |
| Checkout endpoint | `src/app/api/billing/checkout/route.ts` |
| Dodo webhook endpoint | `src/app/api/webhooks/dodo/route.ts` |
| Customer Portal endpoint | `src/app/api/billing/portal/route.ts` |
| Checkout/subscription status endpoint | `src/app/api/billing/status/route.ts` |
| Provider-aware cancellation | `src/app/api/billing/cancel/route.ts` |
| Provider-aware plan change | `src/app/api/billing/change-plan/route.ts` |

### 1.2 The database

Migration `supabase/migrations/0027_dodo_billing_provider.sql` adds:

| Object | What it does |
| --- | --- |
| `subscriptions.billing_provider` | Labels every subscription `razorpay` or `dodo`. Existing rows are backfilled to `razorpay`. |
| `invoices.billing_provider` | The same for invoices. |
| Provider-scoped unique indexes | Two providers may hold the same external id; one provider may not hold it twice. |
| `public.billing_provider_prices` | **The table you fill in.** Maps (provider, environment, plan, currency, period) → a Dodo product id, its interval and its amount. |
| `public.billing_checkout_sessions` | Server-created pending checkout records. Holds the approved price and the plan, so a webhook can be reconciled to the right customer. |
| `public.billing_customers` | Maps an Orindle account to a Dodo customer id. |
| `public.apply_renewal(...)` | Records a renewal in one transaction: one invoice, provider-supplied period dates. |
| `public.apply_scheduled_plan_change(...)` | Applies a provider-confirmed downgrade. |

All three new tables have row-level security with **no** policies, so no
authenticated user can read them. They are server-only.

### 1.3 What is deliberately still there

- `src/app/api/webhooks/razorpay/route.ts` — the legacy Razorpay webhook handler.
  It stays mounted so historical subscriptions and delayed events keep working.
  It can no longer create a payment, and it only touches rows whose provider is
  `razorpay`.
- `src/domain/billing/razorpay.ts` — the legacy Razorpay module. It can no longer
  create an order.
- Every historical Razorpay subscription, invoice, payment id, subscription id and
  webhook event. **Nothing was deleted.**

### 1.4 What is deliberately gone

- Razorpay checkout. `POST /api/billing/checkout` creates a Dodo checkout session
  and nothing else.
- Razorpay from the customer-facing copy. The billing page, the help centre, the
  security page, the about page, the privacy policy and the terms all now name
  Dodo Payments.
- The Razorpay key pair from the *new* payment path. `NEXT_PUBLIC_RAZORPAY_KEY_ID`
  and `RAZORPAY_KEY_SECRET` are only read by the legacy module, so an in-flight
  historical payment can still be verified.

---

## 2. What only you can do

This is the list of everything in this guide that no code change can perform.

| # | Task | Section |
| --- | --- | --- |
| 1 | Create or access the Dodo Payments business account | [A](#a--dodo-business-account-and-approval) |
| 2 | Complete business verification, KYC and beneficial-owner details | [A](#a--dodo-business-account-and-approval) |
| 3 | Get Dodo to confirm the cloud-storage SaaS model is acceptable | [A](#a--dodo-business-account-and-approval) |
| 4 | Configure the business profile, branding, support details and customer-facing information | [A](#a--dodo-business-account-and-approval) |
| 5 | Review tax, refund, chargeback and merchant-of-record settings | [A](#a--dodo-business-account-and-approval) |
| 6 | Create 80 Dodo products (5 paid plans × 8 currencies × 2 periods) | [B](#b--create-the-dodo-product-catalogue) |
| 7 | Import the product ids into `public.billing_provider_prices` | [B](#b--create-the-dodo-product-catalogue) |
| 8 | Create a test API key and add it to Vercel | [C](#c--create-test-api-credentials) |
| 9 | Create the Dodo webhook endpoint and select the event list | [D](#d--configure-dodo-webhooks) |
| 10 | Copy the webhook signing secret into Vercel | [D](#d--configure-dodo-webhooks) |
| 11 | Set the Customer Portal cancellation and update policies | [E](#e--configure-customer-portal-policies) |
| 12 | Run the test-mode verification | [F](#f--test-and-production-credentials) |
| 13 | Create live credentials, live webhook and live product imports | [F](#f--test-and-production-credentials) |
| 14 | Apply migration `0027` to Supabase and import the mapping | [G](#g--vercel-and-supabase-setup) |
| 15 | Decide and execute the legacy Razorpay customer transition | [H](#h--existing-razorpay-customers) |

---

## 3. Production verification

**Orindle does not take live payments until every line below is true.** The code
is ready; the account is not.

- [ ] Dodo has approved the Orindle business account and live payments are enabled.
- [ ] The test-mode checkout completed end to end and a **real recurring
      subscription object** exists in the Dodo dashboard.
- [ ] The renewal, failed-renewal, scheduled-cancellation, scheduled-downgrade and
      customer-portal scenarios were each exercised in test mode.
- [ ] Webhook delivery was confirmed, signatures verified, events stored and
      duplicate deliveries proven idempotent.
- [ ] The local invoice history matches what Dodo shows.
- [ ] Live credentials, live environment and live product mappings are in place.
- [ ] A **controlled low-value live transaction** was completed, its webhook
      processed, and the local subscription and invoice are correct.
- [ ] `GET https://orindle.com/api/health` reports `"dodo": "configured"` and
      `"billingProvider": "dodo"`.

Until then, the honest status of Orindle's billing is **"code complete, account
not yet configured"**, and the admin console's Dodo row will say `Missing`.

---

## 4. Legacy Razorpay customer transition

See [§H](#h--existing-razorpay-customers) for the full procedure. The short
version:

- **Nothing has been cancelled.** No existing subscription, invoice or mandate was
  touched by this migration.
- **No existing customer has been moved to Dodo.** The migration is additive.
- **No existing customer will be charged twice.** The checkout route refuses to
  create a second subscription for an account that already has a live one, and
  the migration does not create Dodo subscriptions for anyone.
- The transition is a decision you make, per cohort, after you have read §H.

---

## A — Dodo business account and approval

### A.1 Create or access the account

1. Go to **https://dashboard.dodopayments.com** and sign in, or create an
   account.
2. Confirm you are in the **correct business**. The dashboard lets you switch
   between businesses; a test key created under one business cannot read products
   created under another.
3. Work in **Test Mode** until §F says otherwise. The test/live toggle is in the
   top-left of the Dodo dashboard.

### A.2 Complete business verification and KYC

Dodo is a merchant of record: it takes the payment, issues the receipt, and
remits the funds to you. That means it needs to know who you are before it can
take live payments.

1. Open **Settings → Business details** (some accounts show it under
   **Onboarding** or **Business profile**).
2. Fill in, accurately:
   - Legal business name, as registered.
   - Business type (individual / company).
   - Registration or tax identifier, if you have one.
   - Business address, country and postal code.
   - A contact email and a contact phone number.
   - **Beneficial owner details.** Every person who owns or controls 25% or more
       of the business, or who is otherwise in control, must be named. Do not
       leave this blank and do not put a placeholder in it — an incomplete KYC
       submission is the most common reason a live-activation request stalls.
   - A description of what you sell and how customers find you.
3. Upload the requested identity documents (business registration, and proof of
   address or identity for the beneficial owners, as prompted).
4. Save. Dodo may ask follow-up questions by email; answer them in the dashboard
   or by email as instructed.

> **Be accurate.** Mismatched details between your Dodo account, your website and
> your tax registration are the most likely cause of a verification failure.

### A.3 Describe the business honestly

Dodo will look at your website and decide whether the business model is one it
can underwrite. Orindle is **cloud storage SaaS**: customers pay a recurring
subscription for a storage allowance and can store, access and share files.

Write the description in those terms. Include:

- The real URL of the product (`https://orindle.com`).
- What the customer gets for their money, in plain language.
- That it is a **recurring subscription** billed monthly or annually.
- The refund and cancellation policy you actually apply — cancellation takes
  effect at the end of the paid period, and files are never deleted because a
  subscription is cancelled or expires.
- Where the product is promoted (your own marketing, your pricing page).

Do not describe the product as something it is not. If Dodo asks a question you
are unsure about, answer it in a support ticket rather than guessing.

> **This is a commercial decision, not a technical one.** If Dodo declines the
> cloud-storage model, no amount of code changes makes Orindle payable through
> Dodo. Read the rejection carefully and decide whether to appeal, to change the
> description, or to use a different provider.

### A.4 Business profile, branding and support details

1. **Settings → Business profile / Branding.** Upload your logo (the same mark
   used on the site), set the brand colour, and set the business name that
   appears on the hosted checkout page and on customer receipts.
2. **Support details.** Set the support email and the support URL. Orindle's
   published support address is in `src/config/site.ts` under `supportEmail` —
   use the same one, so a customer who reads it on the checkout page and then on
   the site finds the same place.
3. **Customer-facing information.** Set what the customer sees on the hosted
   checkout page: the business name, the terms/privacy links and the refund
   policy summary. These are the links Dodo renders next to the pay button.
4. **Settings → Domains / Allowed origins** (if the dashboard offers it). Add
   `https://orindle.com`. This is what stops the hosted checkout being usable
   from a site that is not yours.

### A.5 Tax, refunds, chargebacks and merchant-of-record settings

| Setting | What to check | Where |
| --- | --- | --- |
| Tax category on products | Choose the category that matches a digital storage subscription (Dodo's catalogue calls this out on product creation; the SDK's `tax_category` values include `digital_products`). | **Products → product → Tax category** |
| Tax inclusive or exclusive | Decide whether your listed prices include tax. Orindle's published prices in `public.plan_prices` are **tax exclusive** — they are the exact amounts charged. If Dodo adds tax on top, the customer's total will exceed the published price, which contradicts the pricing page. | **Settings → Taxes** |
| Refund policy | Match what the Terms page says: a refund marks the invoice refunded and **does not** delete the customer's files. | **Settings → Refunds / Policies** |
| Chargeback / dispute handling | Read the fee and the timeline. A dispute is recorded against the invoice; Orindle does not delete files over it. | **Settings → Risk / Disputes** |
| Payout schedule | Choose how often funds are remitted and to which bank account. | **Settings → Payouts** |
| Adaptive pricing | **Leave it off** unless you have decided otherwise. | **Settings → Pricing** |

> **Adaptive pricing — read this carefully.** With adaptive pricing **enabled**,
> Dodo may charge the customer in a currency derived from their billing country
> and convert the amount. With it **disabled** (the default, and what Orindle is
> configured for), Dodo charges the product's own price in the product's own
> currency, and `billing_currency` on a checkout session is ignored.
>
> Orindle publishes a specific approved amount in each of eight currencies. The
> integration therefore depends on adaptive pricing being **off**, so the amount
> charged is the amount on the product, which is the amount in
> `public.plan_prices`. If you enable adaptive pricing, a customer in one country
> could be charged a converted amount that differs from the published price, and
> the price validation in the application would reject the checkout. Do not
> enable it without changing the pricing model and the code together.

### A.6 Verify

- [ ] The business profile shows no outstanding action items.
- [ ] Live payments show as enabled for the business.
- [ ] Test payments work (continue to §B).

---

## B — Create the Dodo product catalogue

### B.1 What has to exist

Orindle sells **five paid plans** — Basic, Plus, Premium, Ultra, Max — in
**eight currencies** (INR, USD, GBP, EUR, AED, SGD, AUD, CAD) on **two billing
periods** (monthly and yearly).

That is:

```
5 paid plans × 8 currencies × 2 periods = 80 Dodo products
```

The Free plan is not a product: it costs nothing and must never create a
checkout session.

### B.2 The approved prices

These come from `public.plan_prices` (seeded by migration `0019`) and are the
commercial source of truth. The amounts below are in **minor units** — paise for
INR, cents for the others — which is what Dodo's API uses.

#### Basic (100 GB)

| Currency | Monthly | Yearly (the full annual charge) |
| --- | --- | --- |
| INR | 9900 | 94800 |
| USD | 109 | 1044 |
| GBP | 99 | 948 |
| EUR | 99 | 948 |
| AED | 399 | 3828 |
| SGD | 149 | 1428 |
| AUD | 159 | 1524 |
| CAD | 159 | 1524 |

#### Plus (500 GB)

| Currency | Monthly | Yearly |
| --- | --- | --- |
| INR | 54900 | 526800 |
| USD | 599 | 5748 |
| GBP | 449 | 4308 |
| EUR | 549 | 5268 |
| AED | 2199 | 21108 |
| SGD | 749 | 7188 |
| AUD | 899 | 8628 |
| CAD | 849 | 8148 |

#### Premium (1 TB)

| Currency | Monthly | Yearly |
| --- | --- | --- |
| INR | 109900 | 1054800 |
| USD | 1199 | 11508 |
| GBP | 899 | 8628 |
| EUR | 1099 | 10548 |
| AED | 4299 | 41268 |
| SGD | 1499 | 14388 |
| AUD | 1749 | 16788 |
| CAD | 1699 | 16308 |

#### Ultra (2 TB)

| Currency | Monthly | Yearly |
| --- | --- | --- |
| INR | 219900 | 2110800 |
| USD | 2399 | 23028 |
| GBP | 1799 | 17268 |
| EUR | 2149 | 20628 |
| AED | 8599 | 82548 |
| SGD | 3099 | 29748 |
| AUD | 3499 | 33588 |
| CAD | 3399 | 32628 |

#### Max (5 TB)

| Currency | Monthly | Yearly |
| --- | --- | --- |
| INR | 559900 | 5374800 |
| USD | 5999 | 57588 |
| GBP | 4499 | 43188 |
| EUR | 5499 | 52788 |
| AED | 21999 | 211188 |
| SGD | 7699 | 73908 |
| AUD | 8999 | 86388 |
| CAD | 8499 | 81588 |

> **The yearly figure is the full annual charge**, not a monthly rate. Dodo
> charges it once per year. Orindle's admin MRR divides it by 12 to normalise
> it, and the display on the pricing page shows the yearly per-month equivalent
> with the 20% discount — but the product price itself must be the annual total
> above, or the customer is charged twelve times the approved amount.

### B.3 How to create each product

For each of the 80 combinations:

1. **Products → Create product.**
2. **Name.** Use a name that identifies the combination unambiguously, e.g.
   `Orindle Premium — Monthly — USD`. You will be reading these names when you
   import the ids, so make them sortable and obvious.
3. **Description.** `Orindle {Plan} plan — {Storage} of storage, billed {monthly|yearly}.`
4. **Price → Recurring.** This is the important choice. Select a **recurring**
   price, not a one-time price. A one-time price is not a subscription and the
   application refuses to sell it.
   - **Payment frequency:** `1` × `Month` for a monthly product; `1` × `Year` for
     a yearly product.
   - **Subscription period:** `20` × `Year`. This is Dodo's recommended value and
     its maximum, and it means the subscription renews until the customer
     cancels rather than expiring after one charge.
     > **Do not set the subscription period to `1` month for a monthly plan.** A
     > subscription whose period equals its payment frequency expires after a
     > single charge. It would look correct in the dashboard and then stop
     > renewing.
   - **Amount:** the value from the table in §B.2, in minor units.
   - **Currency:** the currency from the same table.
5. **Tax category:** the digital-goods category you chose in §A.5.
6. Save. Copy the product id — it looks like `pdt_XXXXXXXXXXXXXXXXXX` and appears
   at the top of the product's page.

> **The amount and currency must match the table exactly.** The application
> re-reads the product from Dodo's catalog before every checkout and refuses the
> sale if the currency, the interval or the amount differs from the approved
> price by even one minor unit. This is deliberate: a product configured with the
> wrong amount would silently charge the wrong price.

### B.4 Localized prices — read this before deciding

Dodo supports **localized pricing**: a product can carry a rule that sets the
price for a specific country, rather than for a currency.

**Orindle does not use localized price rules.** Each combination of plan,
currency and period is a separate product with its own single price, which is
exactly what the mapping table and the price validation expect. If you configure
localized price rules on a product *in addition* to its base price, the amount
Dodo charges can depend on the customer's country rather than on the approved
price for their currency.

Use localized prices only if you have decided to replace the one-product-per-
combination model. If you do, the application's validation must change with it.

### B.5 Combinations that Dodo may not represent exactly

All eight currencies are supported by Dodo's API — INR, USD, GBP, EUR, AED, SGD,
AUD and CAD are all in Dodo's currency list. The prices above are all whole
minor units, so none of them needs rounding.

Two things can still stop you:

1. **Your account's settlement currencies.** Dodo may restrict which currencies
   a business can *settle* in even where the API can *charge* in them. If a
   currency is unavailable to your account, you cannot create the product for it.
2. **A minimum amount.** Some payment methods have a floor (a card will not
   charge less than a few tens of minor units). Basic at $0.99 is 99 cents, which
   is above any floor Dodo applies, but check the amount Dodo shows as invalid
   when you try to save the product.

**If a combination cannot be represented exactly, do not substitute another
currency or another price.** The application will refuse the checkout anyway,
because it validates the product against `plan_prices`. Instead:

1. Leave that combination **out of the mapping table**. Its checkout will fail
   closed with "That plan isn't available for purchase right now", which is
   honest.
2. Hide that currency for that plan in the Orindle pricing display, so the
   customer is never offered a combination that cannot be bought.
3. Record the decision — which combination, why, and what the commercial
   alternative is — in your own notes. A price that cannot be sold is a pricing
   decision, and it needs an owner.

The Free plan at zero is not affected: it never creates a checkout.

### B.6 Import the product ids

The mapping lives in the database, **not in the source code**. There is no
`pdt_...` string anywhere in the repository.

1. Fill in the template at **`docs/admin/dodo-product-mapping-template.csv`**.
   Columns:
   `environment, plan_id, currency, period, product_id, interval, amount_minor`
   - `environment` — `test_mode` or `live_mode`.
   - `plan_id` — `basic`, `plus`, `premium`, `ultra`, `max`.
   - `currency` — one of the eight codes.
   - `period` — `monthly` or `yearly`.
   - `product_id` — the `pdt_...` id from the dashboard.
   - `interval` — `Month` or `Year`, matching the period.
   - `amount_minor` — the amount from §B.2, in minor units.
2. Import it with the Supabase SQL editor, using the **Service role** connection
   (Supabase → Project Settings → Database → Connection string). Run:

   ```sql
   -- Preview first: this shows what would be written.
   select * from public.billing_provider_prices order by environment, plan_id, currency, period;

   -- Then load. Re-running this is safe: it replaces the mapping for the
   -- environment being loaded and leaves the other environment alone.
   insert into public.billing_provider_prices
     (provider, environment, plan_id, currency, period, product_id, interval, amount_minor, active, updated_at)
   values
     -- one row per line of the CSV, e.g.
     -- ('dodo', 'test_mode', 'basic', 'USD', 'monthly', 'pdt_XXXX', 'Month', 109, true, now()),
     -- ('dodo', 'test_mode', 'basic', 'USD', 'yearly',  'pdt_YYYY', 'Year',  1044, true, now())
   on conflict (provider, environment, plan_id, currency, period)
   do update set
     product_id   = excluded.product_id,
     interval     = excluded.interval,
     amount_minor = excluded.amount_minor,
     active       = excluded.active,
     updated_at   = now();
   ```

   A faster route for all 80 rows: generate the `values` list from the CSV with
   any spreadsheet tool, or use the Supabase dashboard's table editor
   (**Table Editor → billing_provider_prices → Insert rows**), which accepts a
   pasted CSV.
3. Verify the count and the coverage:

   ```sql
   -- Should be 80 for a fully populated environment.
   select environment, count(*)
   from public.billing_provider_prices
   where provider = 'dodo' and active
   group by environment;

   -- Should return no rows: every mapping must match the approved price.
   select p.provider, p.environment, p.plan_id, p.currency, p.period,
          p.amount_minor as mapping_amount, pp.amount_minor as approved_amount
   from public.billing_provider_prices p
   join public.plan_prices pp
     on pp.plan_id = p.plan_id
    and pp.currency = p.currency
    and pp.period = p.period
    and pp.approved
   where p.provider = 'dodo'
     and p.amount_minor <> pp.amount_minor;

   -- Should return no rows: every combination must be mapped.
   select pp.plan_id, pp.currency, pp.period
   from public.plan_prices pp
   left join public.billing_provider_prices p
     on p.provider = 'dodo'
    and p.environment = 'test_mode'
    and p.plan_id = pp.plan_id
    and p.currency = pp.currency
    and p.period = pp.period
    and p.active
   where pp.approved
     and pp.plan_id <> 'free'
     and p.id is null;
   ```

### B.7 Verify

- [ ] 80 test-mode products exist, each **recurring**, each with the right
      interval and amount.
- [ ] `select count(*) … group by environment` returns 80 for `test_mode`.
- [ ] The "mapping must match the approved price" query returns no rows.
- [ ] The "every combination must be mapped" query returns no rows.

---

## C — Create test API credentials

### C.1 Create the key

1. In the Dodo dashboard, go to **Developer → API Keys**.
2. Make sure you are in **Test Mode** (the toggle at the top-left of the
   dashboard). The key you create here is a test key.
3. Click **Create API Key** (or the equivalent button).
4. Give it a name that says what it is for, e.g. `orindle-production-app` —
   but if you are creating the test key now, name it `orindle-test-app`. Dodo
   lets you name keys so you can tell them apart later.
5. Copy the key. It is shown once.

> **The key is a secret.** Never paste it into a chat message, a GitHub issue, a
> pull request, a document, or the repository. Never prefix it with
> `NEXT_PUBLIC_` — that would put it in the browser bundle.

### C.2 Add it to Vercel

1. Open your Vercel project → **Settings → Environment Variables**.
2. Add the following. Note the environment selection carefully:

   | Variable | Value | Preview | Production |
   | --- | --- | --- | --- |
   | `BILLING_PROVIDER` | `dodo` | ✅ | ✅ |
   | `DODO_PAYMENTS_API_KEY` | the test key | ✅ | ❌ (live key instead) |
   | `DODO_PAYMENTS_WEBHOOK_KEY` | the webhook secret from §D | ✅ | ❌ (live secret instead) |
   | `DODO_PAYMENTS_ENVIRONMENT` | `test` | ✅ | ❌ (`live` instead) |

3. Leave `NEXT_PUBLIC_SITE_URL` at its existing value for each environment. It
   is the canonical origin used for the checkout return and cancel URLs.
4. Save.

> **Preview deployments must never hold live credentials.** The application
> refuses to run paid checkout when `DODO_PAYMENTS_ENVIRONMENT` disagrees with
> the deployment target, and `/api/health` reports it as `mismatch`. A preview
> build with live credentials would show `mismatch` and refuse checkout — which
> is the intended behaviour, not a bug to work around.

### C.3 Verify

- [ ] The test key is in Vercel for Preview.
- [ ] `DODO_PAYMENTS_ENVIRONMENT` is `test` in Preview.
- [ ] `NEXT_PUBLIC_SITE_URL` is set for each environment.
- [ ] No Dodo credential carries a `NEXT_PUBLIC_` prefix anywhere.

---

## D — Configure Dodo webhooks

### D.1 Create the endpoint

1. In the Dodo dashboard, go to **Developer → Webhooks**.
2. Click **Add Endpoint**.
3. Enter the URL:

   ```
   https://orindle.com/api/webhooks/dodo
   ```

   For test-mode work against a preview deployment, use that deployment's URL
   instead: `https://<your-preview-host>/api/webhooks/dodo`. Create one endpoint
   per environment — they have separate secrets.
4. Save the endpoint.

### D.2 Select the events

The application handles exactly these events. Tick **precisely** this list; a
generic "all events" selection is not what the implementation expects, and it
will deliver a lot of traffic the endpoint stores and ignores.

**Subscription** (11):

- `subscription.active`
- `subscription.updated`
- `subscription.renewed`
- `subscription.past_due`
- `subscription.on_hold`
- `subscription.failed`
- `subscription.paused`
- `subscription.unpaused`
- `subscription.plan_changed`
- `subscription.cancelled`
- `subscription.expired`

**Payment** (2):

- `payment.succeeded`
- `payment.failed`

**Refund** (2):

- `refund.succeeded`
- `refund.failed`

**Dispute** (2):

- `dispute.opened`
- `dispute.lost`
- `dispute.won`

> **That is 18 events.** `dispute.won` restores a disputed invoice to paid.
> `dispute.opened` and `dispute.lost` are recorded against the invoice and never
> remove a customer's files.
>
> If Dodo's dashboard groups these under resource headings (`subscription`,
> `payment`, `refund`, `dispute`), expanding the resource and ticking the
> individual events above is equivalent. If the dashboard's list differs from
> this one — a renamed event, say — note it and check the event name against
> `HANDLED_EVENTS` in `src/app/api/webhooks/dodo/route.ts`, which is the
> authoritative list in the code.

### D.3 Get the signing secret

1. Open the endpoint you just created.
2. The **Overview** tab shows the **webhook signing secret**. It looks like
   `whsec_…`.
3. Copy it into Vercel as `DODO_PAYMENTS_WEBHOOK_KEY` for the matching
   environment.
4. If you ever need to rotate it, use **Rotate secret** on the Overview tab.
   The old secret stays valid for 24 hours afterwards, which is deliberate: a
   rotation does not break an in-flight delivery.

### D.4 Verify the endpoint received an event

1. **Developer → Webhooks → your endpoint → Testing tab.**
2. Select an event type — `payment.succeeded` is a good one — and click
   **Send example**.
3. The endpoint is called with the exact bytes a real event uses, signed the
   same way.
4. Check the delivery log on the same tab. A successful delivery shows a `2xx`.
5. Confirm the event was stored and processed:

   ```sql
   select provider, event_id, event_type, processed_at, error, created_at
   from public.webhook_events
   where provider = 'dodo'
   order by created_at desc
   limit 20;
   ```

   A healthy row has `processed_at` set and `error` null. An error is stored
   rather than discarded, so it can be replayed after the cause is fixed.

6. If the delivery shows a `4xx`, the signature was rejected. Check that
   `DODO_PAYMENTS_WEBHOOK_KEY` in Vercel matches the secret on this endpoint
   exactly, with no trailing whitespace, and that `DODO_PAYMENTS_API_KEY` is
   also set (the endpoint refuses to process without both).

> **Do not rely on an IP allowlist.** Dodo's delivery addresses come from a pool
> that changes over time, and the documentation is explicit that signature
> verification is the supported authentication method. A stale allowlist
> silently blocks deliveries.

---

## E — Configure Customer Portal policies

The Customer Portal is where an Orindle customer views their provider invoices
and updates their payment method. It is **not** where they change their plan.

### E.1 Open the settings

**Settings → Customer Portal** (some accounts show it under **Developer** or
**Products → Customer Portal**). If the account has no portal settings yet, the
portal may need to be enabled for the business first.

### E.2 The three settings that matter

Orindle's cancellation policy is unchanged by this migration:

> Cancellation takes effect at the **end of the paid period**. The customer keeps
> the plan until that date. Files are never removed because a subscription is
> cancelled or expires. Downgrades take effect at the end of the current billing
> period.

The portal must not be able to override that, because the portal has no idea
what Orindle's storage allowance is.

| Setting | Value | Why |
| --- | --- | --- |
| **Allow Immediate Cancellation** | **OFF** | If it were on, a customer could cancel mid-period and stop paying while keeping a paid allowance they have not bought. Orindle would still be showing them their plan — and the local subscription would not know about the cancellation until the next webhook. |
| **Allow Cancellation at Next Billing Date** | **ON** | This is exactly Orindle's policy. It ends the subscription at the period end, which is when the entitlement should end too. |
| **Allow Subscription Updates** | **OFF** | A plan change moves Orindle's storage allowance. The portal cannot update Orindle's database, so a self-service change there would leave the customer on a plan they did not pay for, or paying for a plan they did not get. Orindle's own `/api/billing/change-plan` handles this, and it applies the policy correctly. |
| **Allow Subscription Pause** | **OFF** | A paused subscription means no renewals. Orindle's local status model has no `paused` state, and a pause would leave the customer with an allowance nobody is paying for. |

> **If you turn "Allow Subscription Updates" on, the implementation must change
> with it.** The finished code does not synchronise customer-initiated plan
> changes made in the portal, so leaving it off is the only configuration that
> is correct today.

### E.3 What customers should be able to do in the portal

- View and download their Dodo invoices.
- Update their payment method.
- See their subscription's plan and next billing date.
- Cancel at the next billing date.

### E.4 Verify

- [ ] Immediate cancellation is OFF.
- [ ] Cancellation at next billing date is ON.
- [ ] Subscription updates are OFF.
- [ ] Subscription pause is OFF.

---

## F — Test and production credentials

### F.1 The test-mode checklist

Work through these in order. Each one has a specific thing to look at.

**1. A full test-mode checkout.**

- Sign in to Orindle with a test account.
- Go to **Dashboard → Billing**.
- Choose a plan and a billing period, and press the upgrade button.
- You are redirected to Dodo's hosted checkout page. The page should show the
  plan, the amount and the currency you expect.
- Complete the payment with Dodo's test card. Dodo publishes test card numbers
  in its documentation; the standard one is `4242 4242 4242 4242` with any
  future expiry and any CVC.
- You are returned to `https://orindle.com/dashboard/billing?checkout=returned`.

**What to look for:** the page shows *"Confirming your payment…"* and then
*"Basic is active"*. If it says confirming and stays there, the webhook has not
arrived — go to §F.2 step 2.

**2. Orindle activates the subscription only after provider verification.**

- **Dashboard → Webhooks → your endpoint → Deliveries.** Find the
  `subscription.active` and `payment.succeeded` events. Both should be `2xx`.
- In Supabase:

  ```sql
  select id, owner_id, plan_id, currency, billing_period, status,
         provider_subscription_id, billing_provider,
         current_period_start, current_period_end, cancel_at_period_end
  from public.subscriptions
  where billing_provider = 'dodo'
  order by created_at desc limit 5;
  ```

  The row must have `billing_provider = 'dodo'`, `status = 'active'`, the right
  `currency`, and a `current_period_end` that came from Dodo.

- **The important negative check.** The subscription must not appear before the
  webhook arrives. To confirm the design rather than the luck, cancel the
  checkout mid-way (use the back button) and check that no subscription row was
  created and no entitlement was granted. A browser return alone grants nothing.

**3. A real recurring subscription object exists in Dodo.**

- In the Dodo dashboard, open **Subscriptions**. There must be a subscription
  object, with a status, a product and a next billing date.
- Open the product and confirm it says **recurring**, with the payment frequency
  you configured.
- If no subscription object exists, the product was created as a one-time price.
  Fix the product and delete the mapping row, then start again.

**4. A renewal event.**

- Dodo's dashboard can send a renewal in test mode: open the subscription and
  use the test action to trigger the next billing date, or advance the test
  clock if your account has one.
- Confirm a `subscription.renewed` and a `payment.succeeded` arrive, both `2xx`.
- In Supabase:

  ```sql
  select provider_payment_id, amount_minor, currency, status, paid_at
  from public.invoices
  where billing_provider = 'dodo'
  order by created_at desc limit 10;
  ```

  **Exactly one** new invoice per renewal. The subscription's
  `current_period_end` must equal Dodo's `next_billing_date` — not a local date
  plus 30 days.

**5. A failed renewal.**

- Use Dodo's test tooling to fail the next renewal, or use a test card that
  declines.
- Confirm `payment.failed` and `subscription.past_due` arrive.
- In Supabase, the subscription's `status` becomes `past_due`. The customer's
  files are untouched, and the recovery window applies.
- **Check that no file was deleted.** `select count(*) from public.files` for
  that owner before and after.

**6. A scheduled cancellation.**

- In Orindle, **Dashboard → Billing → Cancel subscription**.
- Confirm in Dodo that the subscription now shows *cancels at next billing date*
  and the billing date is unchanged.
- Confirm Orindle's subscription row has `cancel_at_period_end = true` and
  `status = 'active'` — the entitlement continues until the period ends.
- Trigger the billing date in test mode and confirm `subscription.cancelled`
  arrives and the local status becomes `cancelled`. The files must still be
  there.

**7. A scheduled downgrade.**

- From a paid plan, choose a smaller plan in **Dashboard → Billing**.
- Confirm in Dodo that the subscription's scheduled plan change is for the next
  billing date.
- Confirm the local `pending_plan_id` is set and `plan_id` has **not** changed
  yet.
- Trigger the billing date in test mode. The plan changes at that point and
  `subscription.plan_changed` arrives.
- Confirm the customer is over the smaller allowance: their files are all
  still there, and new uploads are blocked.

**8. The Customer Portal.**

- Press **Manage billing** on the billing page.
- You are taken to Dodo's Customer Portal.
- Confirm you can see an invoice and that you can open the payment-method
  update screen.
- Confirm that **immediate cancellation is not offered**, and that cancelling
  offers the next-billing-date option only.
- Confirm there is no self-service plan-change or pause control.

**9. The local invoice history.**

- **Dashboard → Billing → Payment history.**
- Each row shows the amount, the currency, the date and the provider's payment
  reference.
- Compare with Dodo's own invoice list. The amounts, currencies and dates must
  agree.

**10. Webhook delivery and event deduplication.**

- Send the same example event twice from the **Testing** tab.
- The second delivery must show a `2xx` and be acknowledged as a duplicate.
- In Supabase, there must still be **one** row for that event id:

  ```sql
  select event_id, count(*)
  from public.webhook_events
  where provider = 'dodo'
  group by event_id
  having count(*) > 1;
  ```

  This must return **no rows**.

### F.2 Create the live credentials

Only after every line of §F.1 is true.

1. Switch the Dodo dashboard to **Live Mode**.
2. **Developer → API Keys → Create API Key.** Copy it.
3. **Developer → Webhooks.** Create a **second** endpoint for live:

   ```
   https://orindle.com/api/webhooks/dodo
   ```

   with the same 18 events from §D.2. Copy its signing secret.
4. **Live products.** Test-mode products and live-mode products are different
   objects with different ids. Create the 80 live products exactly as in §B,
   using the same prices, and import the live mapping rows with
   `environment = 'live_mode'`.
   > If your account's live and test catalogues are shared, the product ids may
   > be the same. **Check rather than assume.** If they are the same, the
   > mapping rows still have to exist for `live_mode`, because the application
   > reads the mapping for the environment it is running in.
5. Vercel → **Production** environment:

   | Variable | Value |
   | --- | --- |
   | `BILLING_PROVIDER` | `dodo` |
   | `DODO_PAYMENTS_API_KEY` | the **live** key |
   | `DODO_PAYMENTS_WEBHOOK_KEY` | the **live** endpoint's secret |
   | `DODO_PAYMENTS_ENVIRONMENT` | `live` |

6. Deploy. A Vercel deployment picks up environment-variable changes on the next
   deployment; use **Deployments → Redeploy** if you changed variables without
   changing code.

### F.3 The controlled production verification

1. Use a real, low-value plan — **Basic** in the cheapest currency — and a card
   you control.
2. Complete the checkout on the live site.
3. Confirm in Dodo's live dashboard that the subscription object exists and is
   recurring.
4. Confirm the webhook delivery is `2xx` and the local subscription and invoice
   are correct.
5. Confirm `GET https://orindle.com/api/health` reports `"dodo": "configured"`.
6. Cancel the subscription and confirm the cancellation is scheduled for the
   period end — the customer should not lose the paid period.

---

## G — Vercel and Supabase setup

### G.1 The environment variables, in one place

| Variable | Preview | Production | Notes |
| --- | --- | --- | --- |
| `BILLING_PROVIDER` | `dodo` | `dodo` | Explicit. Any other value disables paid checkout rather than falling back. |
| `DODO_PAYMENTS_API_KEY` | test key | live key | Server-only. Never `NEXT_PUBLIC_`. |
| `DODO_PAYMENTS_WEBHOOK_KEY` | test secret | live secret | Server-only. |
| `DODO_PAYMENTS_ENVIRONMENT` | `test` | `live` | Must match the deployment target. |
| `NEXT_PUBLIC_SITE_URL` | preview URL | `https://orindle.com` | Already set. Used for the checkout return and cancel URLs. |
| `RAZORPAY_WEBHOOK_SECRET` | keep if set | keep if set | **Legacy only.** Keep it while historical Razorpay events may still arrive. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | remove when no legacy payment is in flight | remove when no legacy payment is in flight | Legacy only. Nothing in the new checkout path reads them. |

**Never** put a Dodo credential in GitHub, in the repository, in a document, in
a chat message, or anywhere the browser can reach it.

### G.2 Deploy

1. After changing environment variables, redeploy: **Deployments → ⋯ →
   Redeploy**. Vercel does not apply a new environment variable to an existing
   deployment.
2. Check `GET https://orindle.com/api/health`. It should report:

   ```json
   {
     "billingProvider": "dodo",
     "dodo": "configured",
     "legacyRazorpay": "configured"
   }
   ```

   `dodo: "test-mode"` in production means `DODO_PAYMENTS_ENVIRONMENT` is wrong.
   `dodo: "mismatch"` means the environment disagrees with the deployment
   target — live credentials outside production, or test credentials inside it.
   Both are refused, deliberately.

### G.3 Apply the Supabase migration

1. Open the Supabase dashboard for the project, then **SQL Editor**.
2. Open the file `supabase/migrations/0027_dodo_billing_provider.sql` from the
   repository.
3. Run it. It is additive and idempotent — it can be run again safely.
4. Run the verification queries:

   ```sql
   -- The three new tables exist.
   select table_name from information_schema.tables
   where table_schema = 'public'
     and table_name in ('billing_provider_prices', 'billing_checkout_sessions', 'billing_customers');

   -- The provider column exists and is backfilled.
   select billing_provider, count(*) from public.subscriptions group by 1;
   select billing_provider, count(*) from public.invoices group by 1;

   -- Every new table has RLS on.
   select tablename, rowsecurity from pg_tables
   where schemaname = 'public'
     and tablename in ('billing_provider_prices', 'billing_checkout_sessions', 'billing_customers');
   ```

   The last query must return `rowsecurity = true` for all three.

### G.4 Import the mapping

Follow §B.6. The mapping import is a data operation, not a migration, so it is
run separately and can be re-run whenever a product id changes.

### G.5 Confirm RLS and database setup

```sql
-- No policy should exist on the three new tables: they are server-only.
select tablename, policyname from pg_policies
where schemaname = 'public'
  and tablename in ('billing_provider_prices', 'billing_checkout_sessions', 'billing_customers');

-- The service role must be able to reach them.
select has_table_privilege('service_role', 'public.billing_provider_prices', 'SELECT');
select has_table_privilege('service_role', 'public.billing_checkout_sessions', 'SELECT');
select has_table_privilege('service_role', 'public.billing_customers', 'SELECT');
```

All three `has_table_privilege` calls must return `true`, and the policy query
must return no rows.

### G.6 Verify the Dodo configuration health status

```bash
curl -s https://orindle.com/api/health | python3 -m json.tool
```

Look at `billingProvider` and `dodo`. The same information is on
**/admin → Settings**, in the integrations list.

---

## H — Existing Razorpay customers

### H.1 The rules, stated plainly

1. **Do not assume Dodo can import saved payment credentials, cards, UPI mandates
   or bank debits.** It cannot. Dodo is a new merchant of record with its own
   customer objects. A Razorpay mandate is not a Dodo mandate. A customer who
   wants to pay Dodo has to authorise a new payment method with Dodo.
2. **Do not cancel an active legacy arrangement without an approved transition
   plan.** Cancelling a Razorpay subscription that is still collecting money
   leaves the customer with no arrangement at all, and — if the code has already
   been moved to Dodo — no way to pay.
3. **Do not create a second recurring charge for an existing customer while the
   old arrangement can still collect payment.** The code already prevents this:
   `POST /api/billing/checkout` refuses to create a checkout for an account that
   has a live subscription, and the unique index on live subscriptions backs
   that up. The migration itself creates no Dodo subscriptions for anyone.
4. **Preserve the existing paid period and the files.** Nothing in the migration
   changes a subscription's `current_period_end`, and no billing event — on
   either provider — deletes a file or an R2 object.

### H.2 Find the customers who are still on Razorpay

```sql
select
  billing_provider,
  status,
  count(*) as subscriptions
from public.subscriptions
group by 1, 2
order by 1, 2;
```

```sql
-- The live ones, with their paid-through dates.
select
  s.owner_id,
  p.email,
  s.plan_id,
  s.currency,
  s.billing_period,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end
from public.subscriptions s
left join auth.users p on p.id = s.owner_id
where s.billing_provider = 'razorpay'
  and s.status in ('active', 'past_due')
order by s.current_period_end nulls last;
```

The second query is the transition list. Save it — it is the set of customers
the transition has to be decided for.

### H.3 Classify each customer

| Cohort | What to do |
| --- | --- |
| **Active, paid through a future date, on a live Razorpay mandate** | Let the current period finish. Do not cancel. Do not create a Dodo subscription for them yet. Contact them before the period ends, tell them what changes, and give them the Dodo checkout link. They subscribe through Dodo **after** the Razorpay period ends. |
| **Active, but the Razorpay mandate has already failed or lapsed** | Their arrangement is not collecting. Move them to Dodo now — there is no double-billing risk because the old one is not collecting. Confirm in the Razorpay dashboard that the mandate is not live before you do. |
| **Cancelled but still inside the paid period** | Nothing to do until the period ends. Their entitlement continues, exactly as the policy says. |
| **Expired or lapsed** | Nothing to do. They are on Free, their files are kept, and they can subscribe through Dodo whenever they like. |
| **Active with a live mandate, on a plan Orindle no longer sells** | A decision for you. The safest path is still "let the period finish, then move them to the current equivalent". |

### H.4 The transition

**The safe default, and the one recommended:**

1. Let every legacy subscription finish its current period.
2. Contact each affected customer before their period ends. Say plainly: the
   payment provider is changing, the plan and price are not, the files are not
   affected, and here is how to re-subscribe.
3. After the period ends, the legacy subscription expires on its own. The
   subscription sweep sets it to `expired` and opens the recovery window. The
   files stay.
4. The customer subscribes through Dodo through the normal checkout. That
   creates the only live subscription they have.

**Why not migrate them directly?** Because Dodo cannot take over an existing
Razorpay mandate. There is no API that moves a saved card or a UPI mandate
between providers. Any "direct migration" is really a cancellation plus a new
subscription, which is exactly the double-billing window the rules above
avoid.

**If you need to accelerate it** — a customer asks to move today — the safe
sequence is:

1. Confirm in the Razorpay dashboard that the mandate is live and note its next
   billing date.
2. Cancel the Razorpay subscription **with the provider**, scheduled at the end
   of the current period (so the paid period is honoured).
3. Confirm the cancellation took effect at the provider, and wait for the legacy
   webhook to update the local row.
4. Only then let the customer subscribe through Dodo.

Do not skip step 3. If you create a Dodo subscription while the Razorpay mandate
is still live, the customer is charged twice.

### H.5 Retiring the legacy provider

Once every legacy subscription has expired and no legacy event is outstanding:

1. Remove `RAZORPAY_WEBHOOK_SECRET` from Vercel. The legacy endpoint will then
   answer `503 not_configured` and process nothing.
2. Remove `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from Vercel.
3. Leave `/api/webhooks/razorpay` in the codebase. It costs nothing, it refuses
   cleanly, and it is the audit trail for the transition.
4. Leave the historical rows in the database. They are the record of what was
   paid for, and the migration is deliberately additive.

---

## Troubleshooting

| Symptom | Cause | What to do |
| --- | --- | --- |
| The upgrade button says "That plan isn't available for purchase right now." | The mapping is missing, or the product does not match the approved price. | Run the two verification queries in §B.6. Then check the product's currency, interval and amount in the Dodo dashboard. |
| The same message, but only for one currency | That currency's product is missing or mispriced. | Fix the product, or withdraw that combination from sale (§B.5). |
| "Payments aren't connected on this deployment yet." | `DODO_PAYMENTS_API_KEY` is missing, or `BILLING_PROVIDER` is not `dodo`. | Check `/api/health`. |
| `/api/health` says `"dodo": "mismatch"` | The environment disagrees with the deployment target. | Production must be `live`; preview and development must be `test`. |
| The page says "Confirming your payment…" and stays there | The webhook has not arrived, or it was rejected. | Check the Dodo webhook delivery log. Check `webhook_events` for the event and its `error`. |
| A webhook delivery shows `4xx` | The signature was rejected. | `DODO_PAYMENTS_WEBHOOK_KEY` does not match the endpoint's secret. Check for a trailing newline. |
| A webhook delivery shows `500` | The event was stored but processing failed. | The row's `error` column says why. Common causes: the checkout reference could not be resolved, or the subscription could not be fetched. |
| "That payment belongs to a different account" | The checkout reference resolved to a different owner. | This is a real problem, not a bug. Investigate before retrying. |
| The subscription shows `active` but no `current_period_end` | The provider did not send a billing date. | The subscription is not a renewal promise until it does. Check the Dodo subscription object. |
| The subscription expires after one charge | The product's subscription period was set to `1 month` for a monthly plan. | Fix the product: subscription period `20` × `Year`. See §B.3. |
| The amount charged is twelve times the published price | The yearly product was created with the monthly-equivalent amount. | Fix the product's amount to the yearly total from §B.2. |
| The invoice appears twice | Two different provider payment ids for one charge — usually a plan-change charge as well as a renewal. | Both are real payments and both should be invoiced. If they are genuinely one charge, raise it with Dodo. |
| "You already have an active subscription." | Correct behaviour. | Cancel or change the existing subscription first. |

---

## Where things live

| Thing | Path |
| --- | --- |
| This guide | `docs/admin/DODO-PAYMENTS-ADMIN-SETUP.md` |
| Product mapping template | `docs/admin/dodo-product-mapping-template.csv` |
| The migration | `supabase/migrations/0027_dodo_billing_provider.sql` |
| The Dodo integration | `src/domain/billing/dodo.ts` |
| Pending checkout and customer mapping | `src/domain/billing/checkout-session.ts` |
| The webhook handler | `src/app/api/webhooks/dodo/route.ts` |
| Environment variables | `docs/deployment/environment-variables.md` |
| Payment lifecycle | `docs/backend/payment-lifecycle.md` |

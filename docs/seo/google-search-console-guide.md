# Google Search Console Guide

**Property:** `https://orindle.com` · **Sitemap:** `https://orindle.com/sitemap.xml`

> **Status: not verified, not submitted.** No Google account with access to this domain
> has been authorised in this work, so nothing here has been done on Google's side.
> Claiming otherwise would be a fabrication. This document is the exact procedure for
> whoever does have that access.

---

## 1. Before you start — what should already be true

Run these first. If any fails, fix it before verifying, because Search Console will
report the problem anyway and the diagnosis is easier here.

```bash
# 1. The site is built and serving
npx next build && npx next start -p 3000

# 2. The full audit passes (26 routes, 0 problems)
node scripts/seo-audit.mjs --base http://localhost:3000

# 3. Against production, once deployed:
curl -sI https://orindle.com/ | head -20          # 200, HSTS present
curl -s  https://orindle.com/robots.txt           # allows /, disallows /dashboard
curl -s  https://orindle.com/sitemap.xml | head   # 26 <url> entries
curl -sI http://orindle.com/  | grep -i location  # must 301 to https
curl -sI https://www.orindle.com/ | grep -i location  # must 301 to apex
```

---

## 2. Add the property

**Use a Domain property, not a URL-prefix property.**

| Option | Choose when |
| --- | --- |
| **Domain** ← recommended | You control DNS. Covers `http`, `https`, `www` and every subdomain in one property |
| URL prefix | You cannot edit DNS. Requires separate properties for each variant |

Domain property is the right choice here because it aggregates every variant into one
report — which is exactly what you want when you are enforcing a single canonical host.

1. Open [search.google.com/search-console](https://search.google.com/search-console)
2. Property selector → **Add property** → **Domain**
3. Enter `orindle.com` (no `https://`, no `www`)
4. Click **Continue**

---

## 3. Verify ownership by DNS TXT record

Search Console shows a TXT value like `google-site-verification=abc123...`.

### If DNS is at Cloudflare

1. Cloudflare dashboard → select `orindle.com` → **DNS** → **Records**
2. **Add record**
   - Type: `TXT`
   - Name: `@`
   - Content: paste the `google-site-verification=...` value
   - TTL: Auto
3. **Save**
4. Wait 1–5 minutes (Cloudflare propagates quickly)
5. In Search Console, click **Verify**

### If DNS is elsewhere

Add the same TXT record at your registrar or DNS host. Nameservers often cache, so allow
up to 48 hours if verification fails immediately; in practice it is usually minutes.

### Verify propagation before clicking Verify

```bash
dig +short TXT orindle.com | grep google-site-verification
# or
nslookup -type=TXT orindle.com 8.8.8.8 | grep google
```

If the record does not appear, Search Console will fail verification and you will be
told to try again later — no harm done, but checking first saves a cycle.

**Do not use the HTML file method** for a Domain property (it is not offered), and do not
leave the verification file in `public/` afterwards if you use the URL-prefix method
instead.

---

## 4. Submit the sitemap

1. In the verified property, left sidebar → **Indexing** → **Sitemaps**
2. Under "Add a new sitemap", enter: `sitemap.xml`
   (the domain is already the property, so the full URL is not needed)
3. **Submit**

**Expected result:** status "Success", discovered URLs = **26**.

If it reads "Couldn't fetch":
- confirm `https://orindle.com/sitemap.xml` returns 200 and valid XML;
- confirm `robots.txt` declares the same sitemap URL;
- confirm the property is the Domain property, not a URL-prefix one for a different
  scheme.

**Do not resubmit repeatedly.** A sitemap is a list, not a queue. Resubmitting does not
speed up crawling and achieves nothing except noise in the report.

---

## 5. Inspect and request indexing — once

Use **URL Inspection** (top search bar) for the handful of pages that matter most:

| Priority | URL | Why |
| --- | --- | --- |
| 1 | `https://orindle.com` | Entry point, carries the Organization markup |
| 2 | `https://orindle.com/pricing` | Primary commercial page |
| 3 | `https://orindle.com/blog/best-google-drive-alternatives` | Highest-value article |
| 4 | `https://orindle.com/blog` | Blog hub |

For each: enter the URL → **Test live URL** → confirm "URL is available to Google" and
that the rendered HTML shows the correct title and canonical → **Request indexing**.

**Request indexing sparingly.** Google's documentation is explicit that it does not
guarantee crawling sooner, and doing it for every page is both ineffective and, at
volume, a signal of a site that is not worth crawling on its own merits. Four pages,
once, is the right amount.

---

## 6. What to check in the first two weeks

| Report | Where | What "good" looks like |
| --- | --- | --- |
| Page indexing | Indexing → Pages | 26 indexed, 0 excluded unexpectedly |
| Sitemap status | Indexing → Sitemaps | Success, 26 discovered |
| Crawl errors | Settings → Crawl stats | No 5xx spikes; `robots.txt` fetch 200 |
| Core Web Vitals | Experience → CWV | Field data appears only after traffic; "no data" initially is normal |
| HTTPS | Security & Manual actions → HTTPS | No issues |
| Manual actions | Security & Manual actions | "No issues detected" |
| Enhancements | Enhancements | Breadcrumbs may appear; no errors |

**Expect early noise.** A brand-new site commonly shows "Discovered – currently not
indexed" for a period. That is normal for a new domain and is not a fault to fix.

---

## 7. What to check monthly, ongoing

1. **Performance → Search results.** Impressions first; clicks follow. Filter by page to
   see which articles earn impressions and which earn none.
2. **Queries.** Look for queries the content answers but does not target — those are the
   next article titles, not reasons to rewrite existing ones.
3. **Page indexing.** Watch for pages moving to "Crawled – currently not indexed", which
   usually means thin content rather than a technical fault.
4. **Core Web Vitals** once there is field data.
5. **Enhancements → Breadcrumbs.** Errors here are cheap to fix and improve SERP display.

---

## 8. What Search Console will not do

Worth stating, because it is routinely over-promised:

- **It will not make a page rank.** It reports; it does not promote.
- **Requesting indexing is a hint, not a command.** Google may crawl in an hour or in
  three weeks.
- **A green tick is not a ranking.** "URL is on Google" means indexed, nothing more.
- **Deleting a page in Search Console does not delete it from the index permanently** —
  use the Removals tool for temporary suppression and a 301 or `noindex` for the real fix.

---

## 9. Recording completion

When the property is verified and the sitemap submitted, record it here — this document
is the log:

| Step | Date | By whom | Result |
| --- | --- | --- | --- |
| Domain property created | — | — | not done |
| DNS TXT verified | — | — | not done |
| Sitemap submitted | — | — | not done |
| First indexing check | — | — | not done |

Until those rows carry a date, no claim about Search Console should appear anywhere in
this project's documentation or marketing.

# robots.txt Configuration

**URL:** `https://orindle.com/robots.txt`
**Source:** `src/app/robots.ts`

---

## The file as generated

```
User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /dashboard/
Disallow: /account
Disallow: /api/
Disallow: /login
Disallow: /signup
Disallow: /sign-in
Disallow: /sign-up
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /verify-email
Disallow: /auth/

Sitemap: https://orindle.com/sitemap.xml
Host: https://orindle.com
```

---

## The two decisions in it

### 1. `Allow: /` with a narrow disallow list

The common template is the inverse — `Disallow: /` followed by a list of `Allow:`
exceptions. That pattern fails open in a dangerous direction: anything you forget to
allow is invisible, including the assets a page needs to render. It also breaks the
moment a new section is added.

This file allows everything and denies an explicit list. Everything a crawler needs in
order to render a page correctly stays reachable.

### 2. Nothing that renders the page is blocked

Explicitly **not** present:

| Not blocked | Why it matters |
| --- | --- |
| `/_next/` | The JS and CSS bundles. Blocking them means Google renders a broken page and indexes what is left |
| `/images/` | Every thumbnail and the OG image |
| `/fonts/` | The self-hosted WOFF2 |
| `/art/`, `/icons/` | Decorative assets used in the layout |

`Disallow: /_next/` is a widespread copy-paste that quietly damages sites: the crawler
can fetch the HTML but not the stylesheet or script, so the rendered page has no layout
and the crawler's view of the content is degraded. The audit script fails the build if
`/_next` appears in a Disallow line, and a unit test asserts the source does not
contain it.

---

## What robots.txt cannot do

This is worth being precise about because it is widely misunderstood:

- **It does not remove an indexed page.** If a URL is already in the index, adding a
  Disallow prevents the crawler from fetching it — and therefore from seeing a
  `noindex`. The page can remain in results indefinitely.
- **It is advisory.** A misbehaving crawler can ignore it; a well-behaved one obeys.
- **It is not access control.** `/dashboard` is disallowed here *and* gated by
  middleware; the disallow is a courtesy to crawlers, not a security boundary.

The correct combination, which is what this site uses:

| Layer | Purpose |
| --- | --- |
| `robots.txt` | Prevents discovery by a crawler following links |
| `<meta name="robots" content="noindex, nofollow">` | Prevents indexing of a URL obtained some other way |
| Middleware session check + row-level security | Prevents the content existing for an unauthorised caller |

Any one alone is insufficient. The audit verifies layer 2 is present on `/login`,
`/signup`, `/forgot-password` and `/reset-password`.

---

## `Host` directive

`Host: https://orindle.com` is emitted. It was a Yandex-specific directive and is not
used by Google; it is harmless and included for completeness. The canonical domain is
enforced far more effectively by the `canonical` tag and by an apex redirect at the host
level, neither of which depends on this line.

---

## Verification

```bash
curl -s https://orindle.com/robots.txt
```

The audit asserts:

1. `/robots.txt` returns 200;
2. `Sitemap:` is declared and absolute;
3. `/_next` is **not** disallowed;
4. `/images`, `/fonts` and `/art` are **not** disallowed;
5. `/dashboard` **is** disallowed.

```
robots.txt: valid, assets crawlable, private areas disallowed
```

---

## Open item

A `robots.txt` on a preview or staging domain should be all-deny, so that preview URLs
are never indexed. That is a deployment-configuration concern, not an application one —
the file is generated identically in every environment because it is derived from
constants rather than the request host. For previews, set `X-Robots-Tag: noindex` at the
host level instead; it is authoritative, unlike robots.txt.

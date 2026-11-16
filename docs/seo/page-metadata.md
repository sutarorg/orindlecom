# Page Metadata

**Status:** implemented. Every value below is the approved configuration and is used
verbatim by the build — `src/config/seo-pages.ts` holds these strings and each page
reads the row for its route, so a page cannot drift from the specification.

**Every title is 65 characters or fewer after the ` · Orindle` suffix**, and every
description sits between 70 and 200 characters, which is what actually displays in a
result. `tests/unit/seo.test.ts` enforces both, along with uniqueness and the
one-primary-keyword-per-route rule.

---

## A note on the keywords meta tag

The brief asked for a `keywords` meta tag on every page, and it is implemented —
`pageMetadata()` emits one from the approved list on each route. It should be said
plainly in the record: **Google has not used the keywords meta tag for ranking since
2009**, and no major search engine does. It is emitted because it was requested and
because a few non-Google crawlers and internal site-search tools still read it. It
will not change a ranking either way. The work that does affect rankings is
everything else in this document.

---

## 1. Homepage — `/`

| Field | Value |
| --- | --- |
| **SEO title** | Secure Cloud Storage with 10 GB Free |
| **Full title** | Secure Cloud Storage with 10 GB Free · Orindle |
| **Description** | Store and share files securely with Orindle Cloud. Get 10 GB free with encrypted storage, fast uploads and downloads, and flexible plans that grow with you. |
| **Primary keyword** | cloud storage |
| **Secondary keywords** | online cloud storage · file storage online · personal cloud storage · secure file storage · online file sharing · cloud storage service · free cloud storage · cloud storage for individuals |
| **Meta keywords** | cloud storage, online cloud storage, file storage online, personal cloud storage, secure file storage, online file sharing, free cloud storage, cloud storage service, cloud storage platform |
| **H1** | Your files. Your world. One simple place. |
| **Canonical** | https://orindle.com |
| **Index/follow** | index, follow |
| **Structured data** | WebSite, Organization |

## 2. Pricing — `/pricing`

| Field | Value |
| --- | --- |
| **SEO title** | Cloud Storage Plans & Pricing |
| **Description** | Compare Orindle cloud storage plans from 10 GB free to 10 TB. Explore affordable monthly storage options for personal files and business needs. |
| **Primary keyword** | cloud storage pricing |
| **Secondary keywords** | cloud storage plans · affordable cloud storage · cheap cloud storage · online storage plans · 100 GB cloud storage · 500 GB cloud storage · 1 TB cloud storage · 10 TB cloud storage |
| **Meta keywords** | cloud storage pricing, cloud storage plans, affordable cloud storage, cheap cloud storage, online storage plans, 100GB cloud storage, 500GB cloud storage, 1TB cloud storage, 10TB cloud storage |
| **H1** | Room for every kind of digital life. |
| **Canonical** | https://orindle.com/pricing |
| **Index/follow** | index, follow |

## 3. Features — `/features`

| Field | Value |
| --- | --- |
| **SEO title** | Cloud Storage Features for Files & Sharing |
| **Description** | Discover Orindle cloud storage features for organizing, accessing and sharing files. Explore simple file management for personal and business use. |
| **Primary keyword** | cloud storage features |
| **Secondary keywords** | file management · cloud file sharing · online file storage · cloud folder management · file access across devices · digital file organization · cloud storage tools |
| **Meta keywords** | cloud storage features, file management, cloud file sharing, online file storage, cloud folder management, digital file organization, cloud storage tools, file access |
| **H1** | Everything you need. Nothing you don't. |
| **Canonical** | https://orindle.com/features |
| **Index/follow** | index, follow |

## 4. Security — `/security`

| Field | Value |
| --- | --- |
| **SEO title** | Cloud Storage Security & Privacy |
| **Description** | Learn how Orindle approaches cloud storage security, account protection, file access and privacy. Explore the safeguards and policies behind your files. |
| **Primary keyword** | cloud storage security |
| **Secondary keywords** | secure cloud storage · cloud storage privacy · file security · secure online file storage · cloud data protection · file access permissions · cloud storage protection |
| **Meta keywords** | cloud storage security, secure cloud storage, cloud storage privacy, file security, secure online file storage, cloud data protection, file access permissions |
| **H1** | Your files deserve thoughtful protection. |
| **Canonical** | https://orindle.com/security |
| **Index/follow** | index, follow |

> **Accuracy constraint, honoured.** The page describes only controls that exist:
> TLS in transit, R2 encryption at rest, short-lived presigned downloads, per-request
> authorisation with row-level security, scoped secrets, and signature-verified
> webhooks. It does **not** claim end-to-end encryption, and it does not claim any
> certification or compliance Orindle does not hold. The blog article on cloud
> storage safety states explicitly that the at-rest encryption is provider-managed and
> that this is not end-to-end encryption.

## 5. Business — `/business`

| Field | Value |
| --- | --- |
| **SEO title** | Business Cloud Storage for Teams |
| **Description** | Explore business cloud storage with Orindle. Organize company files, manage team access and share folders with a cloud storage workspace built for teams. |
| **Primary keyword** | business cloud storage |
| **Secondary keywords** | cloud storage for business · team file storage · business file sharing · cloud storage for teams · company file storage · shared business folders · online business storage |
| **Meta keywords** | business cloud storage, cloud storage for business, team file storage, business file sharing, cloud storage for teams, company file storage, shared business folders |
| **H1** | A simpler space for your team's files. |
| **Canonical** | https://orindle.com/business |
| **Index/follow** | index, follow |

> **Honesty constraint, honoured.** Organisation schema, roles and row-level
> security are built and tested; the organisation *routes* are not. The page and the
> business workspace both say so rather than simulating success, and the blog article
> on small business storage says the same thing in its recommendation section.

## 6. About — `/about`

| Field | Value |
| --- | --- |
| **SEO title** | About Us |
| **Description** | Discover Orindle, a cloud storage platform designed to make storing, organizing, accessing and sharing digital files simpler for individuals and teams. |
| **Primary keyword** | Orindle cloud storage |
| **Secondary keywords** | about Orindle · Orindle cloud storage · online storage platform · cloud storage company · digital file storage |
| **Meta keywords** | Orindle, Orindle cloud storage, online storage platform, cloud storage company, digital file storage, file storage platform |
| **H1** | A simpler way to keep everything together. |
| **Canonical** | https://orindle.com/about |
| **Index/follow** | index, follow |

> No founding story, team biographies, registration number or company history were
> invented. The page describes what the product does and the principles it is built on.

## 7. Contact — `/contact`

| Field | Value |
| --- | --- |
| **SEO title** | Contact Us |
| **Description** | Contact Orindle for cloud storage questions, account assistance, business enquiries and support. Send your message to the Orindle team. |
| **Primary keyword** | contact Orindle |
| **Secondary keywords** | Orindle support · cloud storage support · cloud storage help · file storage customer support · business enquiries |
| **Meta keywords** | contact Orindle, Orindle support, cloud storage support, cloud storage help, file storage customer support, business enquiries |
| **H1** | We're here to help. |
| **Canonical** | https://orindle.com/contact |
| **Index/follow** | index, follow |

> The support form posts to the existing approved support destination. No new
> address was introduced.

## 8. FAQ — `/faq`

| Field | Value |
| --- | --- |
| **SEO title** | Cloud Storage FAQs |
| **Description** | Find answers to common Orindle cloud storage questions about plans, storage limits, file management, sharing, accounts and billing. |
| **Primary keyword** | cloud storage FAQ |
| **Secondary keywords** | cloud storage questions · online storage FAQ · cloud storage plans FAQ · file sharing questions · cloud storage help · storage limits |
| **Meta keywords** | cloud storage FAQ, cloud storage questions, online storage FAQ, cloud storage plans FAQ, file sharing questions, cloud storage help, storage limits |
| **H1** | Frequently asked questions. |
| **Canonical** | https://orindle.com/faq |
| **Index/follow** | index, follow |

> **No FAQPage structured data is emitted.** Google restricts FAQ rich results to
> authoritative government and health sites, and adding the markup purely to chase a
> rich result it will not grant is the kind of thing that invites a manual action.
> The answers are real content on a real page.

## 9. Help Center — `/help`

| Field | Value |
| --- | --- |
| **SEO title** | Help Center |
| **Description** | Get help using Orindle. Find guides and answers about cloud storage, uploading files, managing folders, sharing files and managing your account. |
| **Primary keyword** | Orindle help center |
| **Secondary keywords** | cloud storage help · file upload help · file sharing help · cloud storage guides · online storage support · Orindle support |
| **Meta keywords** | Orindle help center, cloud storage help, file upload help, file sharing help, cloud storage guides, online storage support, Orindle support |
| **H1** | How can we help? |
| **Canonical** | https://orindle.com/help |
| **Index/follow** | index, follow |

> Each of the 22 help articles carries its own title, description and canonical at
> `/help/articles/{slug}`, generated from the article registry. A slug that is not in
> the registry 404s rather than rendering an empty shell.

## 10. Legal Hub — `/legal`

| Field | Value |
| --- | --- |
| **SEO title** | Legal Information & Policies |
| **Description** | Read Orindle's legal information, policies and important terms covering the use of its cloud storage website and services. |
| **Primary keyword** | Orindle legal policies |
| **Secondary keywords** | Orindle legal · cloud storage terms · online storage policies · service policies |
| **Meta keywords** | Orindle legal, Orindle legal policies, cloud storage terms, online storage policies, service policies |
| **H1** | Legal information and policies. |
| **Canonical** | https://orindle.com/legal |
| **Index/follow** | index, follow |

## 11. Privacy — `/privacy`

| Field | Value |
| --- | --- |
| **SEO title** | Privacy Policy |
| **Description** | Read the Orindle Privacy Policy to understand how personal information is collected, used, stored, protected and managed when using our services. |
| **Primary keyword** | Orindle privacy policy |
| **Secondary keywords** | cloud storage privacy policy · online storage privacy · data privacy · personal information protection · user data policy |
| **Meta keywords** | Orindle privacy policy, cloud storage privacy policy, online storage privacy, data privacy, personal information protection, user data policy |
| **H1** | Privacy Policy. |
| **Canonical** | https://orindle.com/privacy |
| **Index/follow** | index, follow |

## 12. Terms — `/terms`

| Field | Value |
| --- | --- |
| **SEO title** | Terms of Service |
| **Description** | Review the Orindle Terms of Service for information about accounts, subscriptions, payments, file storage, acceptable use and service conditions. |
| **Primary keyword** | Orindle terms of service |
| **Secondary keywords** | cloud storage terms · online storage terms · service agreement · subscription terms · file storage conditions |
| **Meta keywords** | Orindle terms of service, cloud storage terms, online storage terms, service agreement, subscription terms, file storage conditions |
| **H1** | Terms of Service. |
| **Canonical** | https://orindle.com/terms |
| **Index/follow** | index, follow |

## 13. Cookies — `/cookies`

| Field | Value |
| --- | --- |
| **SEO title** | Cookie Policy |
| **Description** | Learn how Orindle uses cookies and similar technologies, what they are used for and how you can manage your cookie preferences. |
| **Primary keyword** | Orindle cookie policy |
| **Secondary keywords** | cookie policy · website cookies · cookie preferences · tracking technologies · online privacy |
| **Meta keywords** | Orindle cookie policy, cookie policy, website cookies, cookie preferences, tracking technologies, online privacy |
| **H1** | Cookie Policy. |
| **Canonical** | https://orindle.com/cookies |
| **Index/follow** | index, follow |

## 14. Acceptable Use — `/acceptable-use`

| Field | Value |
| --- | --- |
| **SEO title** | Acceptable Use Policy |
| **Description** | Read Orindle's Acceptable Use Policy and understand the rules for accounts, cloud storage, file uploads, sharing and responsible use of our services. |
| **Primary keyword** | Orindle acceptable use policy |
| **Secondary keywords** | cloud storage acceptable use · file sharing rules · online storage policy · prohibited content policy · account usage policy |
| **Meta keywords** | Orindle acceptable use policy, cloud storage acceptable use, file sharing rules, online storage policy, prohibited content policy, account usage policy |
| **H1** | Acceptable Use Policy. |
| **Canonical** | https://orindle.com/acceptable-use |
| **Index/follow** | index, follow |

## 15. Data Deletion — `/data-deletion`

| Field | Value |
| --- | --- |
| **SEO title** | Data Deletion Policy |
| **Description** | Understand how to request Orindle account deletion, what happens to stored files and personal information, and how the data deletion process works. |
| **Primary keyword** | Orindle data deletion |
| **Secondary keywords** | delete cloud storage account · cloud storage data deletion · delete online files · account deletion policy · personal data removal |
| **Meta keywords** | Orindle data deletion, delete cloud storage account, cloud storage data deletion, delete online files, account deletion policy, personal data removal |
| **H1** | Your data. Your choice. |
| **Canonical** | https://orindle.com/data-deletion |
| **Index/follow** | index, follow |

> The page's body content was written before the deletion flow was built and
> describes the state at that time. The flow now exists (request, 7-day grace,
> typed confirmation, cancel by signing in, daily purge job). The H1 and metadata are
> the approved values; the body revision is tracked in `blog-content-audit.md` as an
> open item rather than silently rewritten here.

## 16. Blog Homepage — `/blog`

| Field | Value |
| --- | --- |
| **SEO title** | Cloud Storage Guides, Comparisons & Tips |
| **Description** | Explore cloud storage guides, comparison articles, file management tips and practical advice about online storage, Google Drive alternatives and file sharing. |
| **Primary keyword** | cloud storage blog |
| **Secondary keywords** | cloud storage guides · cloud storage tips · Google Drive alternatives · cloud storage comparisons · file management guides · online storage tips · cloud storage advice |
| **Meta keywords** | cloud storage blog, cloud storage guides, cloud storage tips, Google Drive alternatives, cloud storage comparisons, file management guides, online storage tips |
| **H1** | Ideas for a more organized digital life. |
| **Canonical** | https://orindle.com/blog |
| **Index/follow** | index, follow |

---

## Private routes

These carry `noindex, nofollow` **and** are disallowed in robots.txt **and** are
gated by middleware. One layer alone is not sufficient: robots.txt only prevents
discovery, noindex only works once a URL is known, and middleware is what actually
stops the content existing.

| Route | Directive | robots.txt | Middleware |
| --- | --- | --- | --- |
| `/login`, `/signup` | noindex, nofollow | disallowed | n/a |
| `/sign-in`, `/sign-up` | noindex, nofollow | disallowed | n/a |
| `/forgot-password`, `/reset-password` | noindex, nofollow | disallowed | n/a |
| `/verify-email` | noindex, nofollow | disallowed | n/a |
| `/auth/*` | n/a (route handler) | disallowed | n/a |
| `/dashboard`, `/dashboard/*` | noindex, nofollow | disallowed | session required |
| `/account` | noindex, nofollow | disallowed | session required |
| `/api/*` | n/a (JSON) | disallowed | mixed |

## Snippet directives

The root metadata sets `max-image-preview: large`, `max-snippet: -1` and
`max-video-preview: -1` for Googlebot. These are permissions rather than requests —
they allow full-size image previews and uncapped snippet length where the engine
chooses to use them.

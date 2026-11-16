# Orindle — Help Centre Specification

The help centre at `/help`, its seven categories, and the search that sits on top of
them.

---

## 1. Shape

| Route | Screen |
| --- | --- |
| `/help` | Search, seven categories, six pinned articles, every article grouped by category |
| `/help/articles/[slug]` | One article, statically generated from the registry |
| `/faq` | The FAQ, with category filters and deep links |

The FAQ and the help centre are deliberately separate. The FAQ answers a question in
a paragraph; an article walks through a task in steps. Merging them produces a list
where "Is storage per device?" sits beside "Create an account and sign in", and both
look like the same kind of thing.

---

## 2. Home page

Ordered by who arrives and what they know:

1. **Search.** For the person who knows the word they want. Above the fold, 52px
   tall, prominent.
2. **Seven category cards.** For the person who knows the area but not the word.
   Each card carries an icon, the title, a one-line description and an article count.
3. **Start here.** Six pinned articles — the ones that answer a question people ask
   before they know what to search for. Rendered as a hairline-divided list, not
   cards, so it reads as a shortlist rather than competing with the categories.
4. **All articles.** Every article, grouped by category, two columns at `sm`. This
   is the page's fallback for anyone the first three layers missed.
5. **Still stuck.** The contact route.

### The seven categories

| id | Title | Covers |
| --- | --- | --- |
| `getting-started` | Getting started | Signup, first upload, dashboard map |
| `account` | Account help | Passwords, sessions, closing an account |
| `storage` | Storage & plans | The allowance, the limit, upgrading |
| `files` | File management | Folders, trash, finding things |
| `sharing` | Sharing | Links, folders, revocation |
| `billing` | Billing | Invoices, cancellation, failed payments |
| `business` | Business accounts | Roles, invitations, offboarding |

Seven is a decision, not a coincidence. Fewer categories force unrelated articles
together; more produce categories with one article each, which is a list with extra
steps. Every category holds at least three articles today.

---

## 3. Search

Client-side, over a registry of 21 articles. A round trip would add latency to a
dataset that fits in a few kilobytes.

### Ranking

Deliberate, because unranked substring matching on a help centre is useless:

| Match | Score |
| --- | --- |
| Title | +10 |
| Keyword | +6 |
| Summary | +4 |
| Body | +1 |
| Term appears nowhere (multi-word queries only) | −20 |

Then sorted by score, ties broken alphabetically. Top 8 results.

The reason for the weighting: somebody typing "trash" wants the restore article, not
every article whose body mentions the word once. Without weights, "trash" returns
four articles with the right one somewhere in the middle.

### Behaviour

- A minimum of two characters, so the query space is never a single keystroke.
- Results show title, a snippet centred on the match, and the category.
- **Keyboard:** arrow keys move the highlight, Enter opens it, Escape clears.
  Implemented as a combobox with `aria-activedescendant`, so a screen reader
  announces the highlighted result.
- A visually hidden live region announces the result count.
- An empty result set says so and offers the contact route rather than "no results".

---

## 4. Article pages

Statically generated from `HELP_ARTICLES` via `generateStaticParams`. A slug that is
not in the registry returns 404 through `notFound()` — an article URL that exists but
renders an empty shell is worse than a clean miss.

Each page carries:

| Element | Notes |
| --- | --- |
| Breadcrumb | Help centre → Category. Links to the category anchor on `/help`. |
| Title | 34px at desktop, `-0.035em` tracking |
| Summary | The standfirst, also the search snippet |
| Updated date | From the registry, rendered as a `<time>` element in UTC |
| Body | 68ch measure, 15px, 1.7 line height |
| Feedback | "Ask a person" and "Tell us what was missing" — see §5 |
| Related | Cross-links from `related`, resolved through the registry so a broken slug cannot render |
| Previous / next | Document order across all articles, so the sequence is stable |
| Contact strip | The support address, at the foot |

### Type and measure

Help content is read mid-task, often on a second screen with the product open on
another. It therefore runs **larger than the marketing site** — 15px body against
14px — and at a wider leading. The measure is 68ch: long enough not to chop sentences,
short enough that the eye does not lose the line.

### Body blocks

| Block | Rendered as |
| --- | --- |
| `p` | Paragraph |
| `steps` | Numbered circles with a bold title and body per step |
| `list` | Bulleted list with custom dots |
| `note` | Tinted panel, `info` (blue) or `warning` (amber) |
| `table` | Bordered table, horizontal scroll below 480px |
| `link` | A card-shaped cross-link with a check icon |
| `placeholder` | "Open question" panel — used where a policy is undecided |

---

## 5. Feedback, honestly

There is no thumbs-up/thumbs-down on an article, and the page says why in one small
line: *"Per-article ratings aren't collected yet — there is nowhere to store them, so
there is no voting control."*

What ships instead is what actually works today:

- **Ask a person** → `/contact?subject=support`
- **Tell us what was missing** → a `mailto:` prefilled with the article title and slug

A rating widget without a store is the worst of both worlds: the reader believes
they contributed, and whoever runs the help centre learns nothing. When storage
exists, the contract in `article-system.md` §6 describes what to replace.

---

## 6. Accessibility

- One `<h1>` per page; `<h2>` per category and article section; no level skipped.
- Search is a `combobox` with `aria-expanded`, `aria-controls` and
  `aria-activedescendant`, plus a live region for the count.
- All interactive targets are at least 40px tall on touch; inline text links are
  spaced so they are not adjacent targets.
- Focus is always visible: `focus-visible:ring-2` with the brand ring, never removed.
- Colour never carries meaning alone. Notes carry an icon and a heading; the FAQ's
  category chips carry `aria-pressed` as well as a fill change.
- Tables use `<th scope="col">` and a real `<table>`, not a grid of divs.
- Dates are `<time dateTime="…">`.
- The category cards are links with their accessible name built from the title and
  description, not a click handler on a `<div>`.

---

## 7. Responsive

| | Mobile <640 | Tablet 640–1023 | Desktop ≥1024 |
| --- | --- | --- | --- |
| Category grid | 1 column | 2 columns | 3 columns |
| Search | Full width | Full width | 600px centred |
| All-articles index | 1 column | 2 columns | 2 columns |
| Article measure | Full width minus 24px | 68ch capped | 68ch |
| Related / prev-next | Stacked | 2 columns | 2 columns |
| Tables | Horizontal scroll inside the figure | Scroll if needed | Fit |

The article page never scrolls horizontally; the table figures do, inside their own
container.

---

## 8. Content rules

The rules that keep 21 articles from becoming 21 liabilities:

1. **Describe what the product does.** If a documented flow cannot complete, the
   article says so — see "Close your account", which states plainly that there is no
   self-deletion button.
2. **Name the gaps.** Two-factor authentication, GST invoices and refunds are absent;
   each absence is stated where a reader would look for the feature.
3. **No screenshots.** A screenshot of a UI that changes is worse than a sentence
   that does not, and it cannot be read by a screen reader.
4. **Steps, not prose, for tasks.** If the answer is a sequence, use `steps`.
5. **One idea per article.** An article titled "Billing" is a category, not an article.

---

## 9. File map

```
src/config/help/
  types.ts       HelpCategory, HelpArticle, HelpBlock
  categories.ts  The seven categories
  articles.ts    21 articles + lookup, ordering and neighbour helpers
src/components/help/
  help-home.tsx        The `/help` page
  help-search.tsx      Combobox search with ranking
  article-blocks.tsx   Body renderer
  article-feedback.tsx Feedback and cross-links
  faq-explorer.tsx     `/faq`: search, category filters, deep links
src/app/help/page.tsx
src/app/help/articles/[slug]/page.tsx
src/app/faq/page.tsx
```

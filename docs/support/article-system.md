# Orindle — Article System

How help articles are modelled, rendered, searched and extended — and the contract
for adding real per-article feedback later.

---

## 1. Content is data

Articles live in `src/config/help/articles.ts` as `HelpArticle[]`, not as MDX and not
as JSX. Three reasons drove that:

1. **Search needs the text.** Ranking title against body needs the body as strings.
   Parsing JSX for a search index is a worse problem than typing an array.
2. **One model, four surfaces.** The `/help` index, the search results, the article
   page and the prev/next navigation all read the same array. None can disagree.
3. **Validation at build time.** `generateStaticParams` walks the registry, so a
   malformed article fails the build rather than producing a broken page.

The cost is that authors write TypeScript rather than Markdown. For 21 articles
maintained by the same team that ships the product, that trade is worth it.

---

## 2. The model

```ts
interface HelpArticle {
  slug: string;                 // URL segment, stable forever
  title: string;
  category: HelpCategoryId;     // one of seven
  summary: string;              // standfirst + search snippet
  updated: string;              // ISO date, rendered in UTC
  body: HelpBlock[];
  related?: string[];           // slugs, resolved and dropped if missing
  featured?: boolean;           // pinned to the help home
  keywords?: string[];          // search boost, not displayed
}
```

### Blocks

| Type | Shape | Use |
| --- | --- | --- |
| `p` | `{ text }` | A paragraph |
| `steps` | `{ items: [{ title, text }] }` | An ordered task |
| `list` | `{ items: string[] }` | Unordered points |
| `note` | `{ tone: "info" \| "warning", text }` | An aside worth a panel |
| `table` | `{ head, rows }` | Comparisons, mappings |
| `link` | `{ href, label, text }` | A cross-link that must be a real link |
| `placeholder` | `{ text }` | An unresolved policy, stated as one |

`placeholder` exists because two articles need to describe something Orindle has not
decided — refunds, in `cancel-a-subscription`. The alternative was to write a
plausible refund rule, which would be a promise nobody made.

### Deliberately absent block types

| Not a block | Why |
| --- | --- |
| Raw HTML | Defeats the search index and the typography guarantees |
| Images and screenshots | A stale screenshot is worse than a sentence, and unreadable to a screen reader |
| Embedded video | No video exists, and an empty player is a broken promise |
| Code blocks | Orindle is not a developer product; nothing needs one |
| Callout variants beyond info/warning | Two tones carry all the meaning there is |

---

## 3. Ordering and navigation

`HELP_ARTICLES` is ordered by category, then by how often the question is likely to
be asked. That single order drives:

- the "All articles" index on `/help`,
- previous/next on each article,
- the `articleNeighbours()` helper.

Previous/next crosses category boundaries on purpose: somebody who has finished
"Recover a deleted file" is more likely to want "Find a file you cannot see" than to
be dropped back at a category heading.

`related` is authored, not inferred. A tag-similarity algorithm on 21 articles
produces weak links; three named ones are better.

---

## 4. Rendering

`ArticleBlocks` maps each block to markup with the type scale set once:

| Element | Size | Leading |
| --- | --- | --- |
| Body paragraph | 15px | 1.7 |
| Step title | 14.5px semibold | 1.5 |
| Step body | 14px | 1.65 |
| Note | 13.5px | 1.65 |
| Table cell | 13px | 1.6 |

Measure: **68ch**. Larger body type than the marketing site (14px) and wider leading,
because help content is read while doing something else.

---

## 5. Adding an article

1. Add an entry to `HELP_ARTICLES` in the right category block, in reading order.
2. Pick a slug that will not need to change. Slugs are the public URL.
3. Write the summary as the search snippet you want to appear — it is used verbatim.
4. Add `related` slugs and `keywords`.
5. Set `featured: true` only if it belongs in the top six on the help home.
6. Set `updated` to today.
7. If it documents a policy that is undecided, use a `placeholder` block.
8. Run `npx tsc --noEmit` and `npx next build` — the build generates the page.

### Checklist before merging an article

- [ ] Every claim is true of the product as built
- [ ] Any missing feature is named, not glossed
- [ ] Links resolve (use `related`, or a `link` block with a real route)
- [ ] No screenshot, no "coming soon" without a stated owner
- [ ] Steps are steps, not a paragraph with commas
- [ ] `related` slugs exist in the registry
- [ ] The date is real

---

## 6. Feedback contract

Per-article feedback is **not implemented**. This section is the contract for
implementing it without redesigning the page.

### What ships today

`ArticleFeedback` renders two actions that work:

- `/contact?subject=support`
- `mailto:` prefilled with the article title and slug

And one honest sentence stating ratings are not collected.

### What to build when a store exists

```ts
// src/lib/help/repository.ts
export type FeedbackVerdict = "helpful" | "not_helpful";

export interface ArticleFeedbackInput {
  slug: string;
  verdict: FeedbackVerdict;
  /** Optional free text, only requested on "not helpful". */
  comment?: string;
  /** Client-generated, so one reader cannot vote twice without a cookie. */
  visitorKey: string;
}

export interface ArticleFeedbackRepository {
  readonly configured: boolean;
  submit(input: ArticleFeedbackInput): Promise<{
    ok: boolean;
    /** Aggregate, returned only when the write succeeded. */
    counts?: { helpful: number; notHelpful: number };
  }>;
}
```

### UI rules when it lands

1. The control appears **below** the article body, where the current block sits.
2. Nothing changes visually until the write resolves — no optimistic count, because a
   count that moves and then reverts is worse than a spinner.
3. On failure, the buttons stay enabled and an inline error says the vote was not
   recorded, with the mailto as the fallback.
4. "Not helpful" opens a single optional textarea. Required feedback produces angry
   one-word replies.
5. `visitorKey` is stored in local storage; it is a de-duplication aid, not an
   identity, and the privacy policy must say so before this ships.

### What not to build

- A five-star rating. A star average tells nobody what was wrong.
- Public comments on articles. That is a forum, with a moderation obligation.
- A "was this helpful?" prompt that appears before the reader has scrolled to the end.

---

## 7. Search index

Built at module load from the registry — no separate index file to keep in sync.

```
title      ×10
keywords   ×6
summary    ×4
body       ×1
missing    −20  (per term, multi-word queries only)
```

Extending: if the registry grows past roughly 200 articles, move to a prebuilt index
and keep the same weighting. The weights are the design; the data structure is an
implementation detail.

---

## 8. Validation and drift

| Check | How |
| --- | --- |
| Unknown `related` slug | Silently dropped at render — but the article then shows fewer links, so the gap is visible |
| Unknown `category` | Type error at build |
| Duplicate slug | `generateStaticParams` would emit two identical paths; the build warns |
| Missing `updated` | Type error (`string` is required, not optional) |
| Broken internal link in a `link` block | Not caught automatically — add to the review checklist |

The one drift risk worth naming: **article content describing product behaviour is
not tested.** Nothing fails the build when the trash window changes from 30 to 14
days. The mitigation is the cross-document check list in
`docs/legal/policy-content-review.md` §7, which is a manual review step, not a test.

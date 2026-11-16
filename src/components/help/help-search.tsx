"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CornerDownLeft, Search, SearchX, X } from "lucide-react";
import { HELP_ARTICLES } from "@/config/help/articles";
import { helpCategory } from "@/config/help/categories";
import type { HelpArticle } from "@/config/help/types";
import { cn } from "@/lib/utils";

/**
 * Help search.
 *
 * Runs entirely client-side over the article set, which is small enough that a
 * round trip would only add latency. Ranking is deliberate rather than incidental:
 * a title match beats a summary match beats a body match, because somebody typing
 * "trash" wants the restore article, not every article that mentions the word.
 *
 * Keyboard: arrow keys move through results, Enter opens the highlighted one, and
 * Escape clears. The results are a listbox so a screen reader announces the count
 * rather than reading a bare div of links.
 */

interface Scored {
  article: HelpArticle;
  score: number;
  snippet: string;
}

function textOf(article: HelpArticle): string {
  const parts = [article.summary];
  for (const block of article.body) {
    if (block.type === "p" || block.type === "note" || block.type === "placeholder") parts.push(block.text);
    else if (block.type === "list") parts.push(...block.items);
    else if (block.type === "steps") parts.push(...block.items.flatMap((item) => [item.title, item.text]));
    else if (block.type === "table") parts.push(...block.rows.flat());
    else if (block.type === "link") parts.push(block.text, block.label);
  }
  if (article.keywords) parts.push(...article.keywords);
  return `${parts.join(" ")} ${article.title}`.toLowerCase();
}

/** The sentence around the first match, trimmed to something readable. */
function snippetFor(article: HelpArticle, needle: string): string {
  const haystack = `${article.summary} ${article.title}`;
  const index = haystack.toLowerCase().indexOf(needle);
  if (index === -1) return article.summary;
  const start = Math.max(0, index - 40);
  const end = Math.min(haystack.length, index + needle.length + 60);
  return `${start > 0 ? "…" : ""}${haystack.slice(start, end).trim()}${end < haystack.length ? "…" : ""}`;
}

function search(query: string): Scored[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const terms = needle.split(/\s+/).filter(Boolean);

  return HELP_ARTICLES.map((article) => {
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();
    const body = textOf(article);

    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 10;
      if (article.keywords?.some((keyword) => keyword.includes(term))) score += 6;
      if (summary.includes(term)) score += 4;
      if (body.includes(term)) score += 1;
      // A term that appears nowhere disqualifies the article for multi-word queries.
      if (!title.includes(term) && !summary.includes(term) && !body.includes(term)) score -= 20;
    }

    return { article, score, snippet: snippetFor(article, needle) };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, 8);
}

export function HelpSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const results = React.useMemo(() => search(query), [query]);
  const hasQuery = query.trim().length >= 2;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row in view when the highlight moves by keyboard.
  React.useEffect(() => {
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setQuery("");
      return;
    }
    if (!hasQuery || results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      const target = results[activeIndex]?.article;
      if (target) {
        event.preventDefault();
        window.location.assign(`/help/articles/${target.slug}`);
      }
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-subtle"
          strokeWidth={2.1}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={hasQuery && results.length > 0}
          aria-controls="help-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            hasQuery && results.length > 0 ? `help-result-${activeIndex}` : undefined
          }
          aria-label="Search the help centre"
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search help — try “trash”, “plan”, “invite”…"
          className={cn(
            "h-[52px] w-full rounded-[14px] border border-[var(--brand-border)] bg-white pl-12 pr-11 text-[14.5px] text-ink",
            "placeholder:text-text-subtle",
            "shadow-[var(--brand-shadow-xs)] transition-[border-color,box-shadow]",
            "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]",
            "[&::-webkit-search-cancel-button]:hidden",
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-[var(--brand-canvas)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Live region: the count is announced without stealing focus */}
      <p aria-live="polite" className="sr-only">
        {hasQuery
          ? `${results.length} ${results.length === 1 ? "article" : "articles"} match`
          : ""}
      </p>

      {hasQuery && (
        <div className="mt-2 overflow-hidden rounded-[14px] border border-[var(--brand-border)] bg-white shadow-[var(--brand-shadow-sm)]">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <SearchX className="mx-auto h-5 w-5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
              <p className="mt-2 text-[13.5px] font-semibold text-ink">No article matches that</p>
              <p className="mx-auto mt-1 max-w-[40ch] text-[12.5px] leading-relaxed text-text-muted">
                Try a shorter phrase. If nothing comes up,{" "}
                <Link
                  href="/contact"
                  className="font-semibold text-primary-ink underline underline-offset-2"
                >
                  ask us directly
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul
              id="help-search-results"
              ref={listRef}
              role="listbox"
              aria-label="Matching articles"
              className="max-h-[420px] overflow-y-auto py-1"
            >
              {results.map((result, index) => {
                const category = helpCategory(result.article.category);
                const active = index === activeIndex;
                return (
                  <li key={result.article.slug} role="option" aria-selected={active} id={`help-result-${index}`}>
                    <Link
                      href={`/help/articles/${result.article.slug}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2.5 transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                        active ? "bg-primary-soft/50" : "hover:bg-[var(--brand-canvas)]",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-ink">
                          {result.article.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-text-muted">
                          {result.snippet}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.05em] text-text-subtle">
                          {category?.title}
                        </span>
                      </span>
                      <ArrowRight
                        className={cn(
                          "mt-1 h-3.5 w-3.5 shrink-0 text-text-subtle transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                        strokeWidth={2.2}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {results.length > 0 && (
            <p className="flex items-center gap-1.5 border-t border-[var(--brand-border-soft)] px-4 py-2 text-[10.5px] text-text-subtle">
              <CornerDownLeft className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
              Enter to open · Arrow keys to move · Escape to clear
            </p>
          )}
        </div>
      )}
    </div>
  );
}

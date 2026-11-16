"use client";

import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Filter, Link2, Search, SearchX, X } from "lucide-react";
import { FAQ_CATEGORIES, type FaqCategory, type FaqItem } from "@/config/faq";
import { cn } from "@/lib/utils";

/**
 * FAQ explorer.
 *
 * Two ways in, because there are two kinds of visitor: one who knows the words
 * ("refund", "currency") and one who knows the area ("Billing"). Search and
 * category are independent and compose, which is how somebody narrows a word that
 * appears in several topics.
 *
 * Deep links are hashes: every question is `#<id>`, so a support reply can point
 * at one answer rather than "scroll to the billing part". Opening a hash expands
 * that question and marks it, and each question carries a copyable anchor that
 * appears on hover or focus.
 *
 * Radix supplies the accordion keyboard model — arrow keys, Home/End, Enter and
 * Space — so the interaction is conventional before it is custom.
 */
export function FaqExplorer({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<FaqCategory | "all">("all");
  const [open, setOpen] = React.useState<string[]>([]);
  const [activeAnchor, setActiveAnchor] = React.useState<string | null>(null);

  const needle = query.trim().toLowerCase();

  // Honour a hash on first load, and on back/forward within the page.
  React.useEffect(() => {
    const applyHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      const match = items.find((item) => item.id === id);
      if (!match) return;
      setCategory("all");
      setQuery("");
      setOpen([match.id]);
      setActiveAnchor(match.id);
      // Let the filtered list paint before scrolling to the target.
      requestAnimationFrame(() => {
        document.getElementById(`faq-${match.id}`)?.scrollIntoView({ block: "center" });
      });
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [items]);

  const counts = React.useMemo(() => {
    const map = new Map<FaqCategory | "all", number>([["all", items.length]]);
    for (const item of items) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!needle) return true;
      return (
        item.question.toLowerCase().includes(needle) ||
        item.answer.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
      );
    });
  }, [items, needle, category]);

  const grouped = React.useMemo(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const isFiltered = needle.length > 0 || category !== "all";

  const reset = () => {
    setQuery("");
    setCategory("all");
  };

  const copyAnchor = async (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setActiveAnchor(id);
      window.setTimeout(() => setActiveAnchor((current) => (current === id ? null : current)), 1800);
    } catch {
      // Clipboard blocked: put the hash in the address bar so it can be copied.
      window.location.hash = id;
      setActiveAnchor(id);
    }
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="relative lg:w-[300px] lg:shrink-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
            strokeWidth={2.1}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search frequently asked questions"
            placeholder="Search questions…"
            className="h-11 w-full rounded-xl border border-[var(--brand-border)] bg-white pl-9 pr-9 text-[14px] text-ink placeholder:text-text-subtle transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-[var(--brand-canvas)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          )}
        </div>

        <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-1.5">
          <CategoryChip
            label="All"
            count={counts.get("all") ?? 0}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {FAQ_CATEGORIES.map((entry) => {
            const count = counts.get(entry) ?? 0;
            if (count === 0) return null;
            return (
              <CategoryChip
                key={entry}
                label={entry}
                count={count}
                active={category === entry}
                onClick={() => setCategory(entry)}
              />
            );
          })}
        </div>
      </div>

      <p aria-live="polite" className="mt-2.5 text-[11.5px] text-text-subtle">
        {isFiltered
          ? `${filtered.length} ${filtered.length === 1 ? "answer" : "answers"}${category !== "all" ? ` in ${category}` : ""}`
          : `${items.length} answers across ${FAQ_CATEGORIES.length} topics`}
      </p>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--brand-border-strong)] px-6 py-10 text-center">
          <SearchX className="mx-auto h-5 w-5 text-text-subtle" strokeWidth={2} aria-hidden="true" />
          <p className="mt-2 text-[14px] font-semibold text-ink">No matching answers</p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-text-muted">
            Try a different word, or{" "}
            <Link href="/contact" className="font-semibold text-primary-ink underline underline-offset-2">
              ask us directly
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Filter className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
            Clear filters
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-9">
          {grouped.map(([groupCategory, list]) => (
            <section key={groupCategory} aria-labelledby={`faq-group-${slugify(groupCategory)}`}>
              <h2
                id={`faq-group-${slugify(groupCategory)}`}
                className="text-[11px] font-semibold uppercase tracking-[0.09em] text-primary-ink"
              >
                {groupCategory}
              </h2>

              <Accordion.Root
                type="multiple"
                value={open}
                onValueChange={setOpen}
                className="mt-2.5 w-full border-t border-[var(--brand-border)]"
              >
                {list.map((item) => (
                  <Accordion.Item
                    key={item.id}
                    value={item.id}
                    id={`faq-${item.id}`}
                    className={cn(
                      "scroll-mt-24 border-b border-[var(--brand-border)] transition-colors",
                      activeAnchor === item.id && "bg-primary-soft/25",
                    )}
                  >
                    <Accordion.Header>
                      <div className="flex items-start gap-2">
                        <Accordion.Trigger className="group flex flex-1 items-start justify-between gap-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:py-[18px]">
                          <span className="text-[length:var(--brand-body-size)] font-bold leading-[1.45] tracking-[-0.02em] text-ink transition-colors group-hover:text-primary-ink">
                            {item.question}
                          </span>
                          <ChevronDown
                            aria-hidden="true"
                            className="mt-[3px] h-4 w-4 shrink-0 text-text-muted transition-transform duration-[240ms] ease-[var(--ease-out)] group-data-[state=open]:rotate-180"
                            strokeWidth={2.2}
                          />
                        </Accordion.Trigger>

                        {/* Anchor: revealed on hover/focus, always in the a11y tree */}
                        <button
                          type="button"
                          onClick={() => copyAnchor(item.id)}
                          aria-label={
                            activeAnchor === item.id
                              ? "Link to this answer copied"
                              : `Copy a link to “${item.question}”`
                          }
                          className={cn(
                            "mt-[15px] flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            activeAnchor === item.id
                              ? "text-primary opacity-100"
                              : "text-text-subtle opacity-0 hover:text-primary-ink focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-0 [@media(hover:hover)]:opacity-100",
                          )}
                        >
                          <Link2 className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      </div>
                    </Accordion.Header>

                    <Accordion.Content className="overflow-hidden">
                      <div className="max-w-[64ch] pb-4 pr-8">
                        <p className="text-[length:var(--brand-body-sm-size)] leading-[1.68] tracking-[-0.02em] text-text-muted">
                          {item.answer}
                        </p>
                        {item.helpSlug && (
                          <Link
                            href={`/help/articles/${item.helpSlug}`}
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            Read the full article
                            <ArrowUpRight className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </Accordion.Content>
                  </Accordion.Item>
                ))}
              </Accordion.Root>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-transparent bg-ink text-white"
          : "border-[var(--brand-border)] bg-white text-text-muted hover:border-[var(--brand-border-strong)] hover:text-ink",
      )}
    >
      {label}
      <span className={cn("tabular-nums text-[10px]", active ? "text-white/60" : "text-text-subtle")}>
        {count}
      </span>
    </button>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

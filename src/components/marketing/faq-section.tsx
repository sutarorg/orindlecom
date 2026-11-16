"use client";

import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/config/faq";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

/**
 * FAQ accordion.
 *
 * Radix supplies the keyboard semantics (arrow keys, Home/End, Enter/Space).
 * Height animation uses a real grid-template-rows transition rather than a
 * guessed max-height. Rows are separated by hairlines — no boxes — matching the
 * reference's flat, borderless content style.
 */
export function FaqAccordion({
  items,
  className,
  defaultOpenId,
}: {
  items: FaqItem[];
  className?: string;
  defaultOpenId?: string;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpenId}
      className={cn("w-full border-t border-[var(--brand-border)]", className)}
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
          className="border-b border-[var(--brand-border)]"
        >
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-start justify-between gap-6 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:py-5">
              <span className="text-[length:var(--brand-body-size)] font-bold leading-[1.45] tracking-[-0.02em] text-ink transition-colors group-hover:text-primary-ink">
                {item.question}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="mt-[3px] h-4 w-4 shrink-0 text-text-muted transition-transform duration-[240ms] ease-[var(--brand-ease-out)] group-data-[state=open]:rotate-180"
                strokeWidth={2.2}
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden">
            <p className="max-w-[68ch] pb-5 pr-8 text-[length:var(--brand-body-sm-size)] leading-[1.68] tracking-[-0.02em] text-text-muted">
              {item.answer}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

/** Homepage FAQ block: heading on the left, accordion on the right. */
export function FaqSection({
  items,
  title,
  description,
}: {
  items: FaqItem[];
  title: string;
  description?: string;
}) {
  return (
    <section className="py-12 sm:py-14 lg:py-16">
      <div className="container-or">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading>{title}</SectionHeading>
            {description && (
              <p className="mt-3 max-w-[34ch] text-[length:var(--brand-body-size)] leading-[1.6] tracking-[-0.02em] text-text-muted">
                {description}
              </p>
            )}
            <p className="mt-4 text-[length:var(--brand-body-sm-size)] text-text-muted">
              Still unsure?{" "}
              <Link
                href="/contact"
                className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
              >
                Ask us directly
              </Link>
              .
            </p>
          </div>
          <FaqAccordion items={items} />
        </div>
      </div>
    </section>
  );
}

/**
 * Searchable FAQ used on /faq: filters question, answer and category text,
 * announces the match count and shows a genuine empty state.
 */
export function FaqSearch({ items }: { items: FaqItem[] }) {
  const [query, setQuery] = React.useState("");
  const trimmed = query.trim().toLowerCase();

  const filtered = React.useMemo(
    () =>
      trimmed.length === 0
        ? items
        : items.filter(
            (item) =>
              item.question.toLowerCase().includes(trimmed) ||
              item.answer.toLowerCase().includes(trimmed) ||
              item.category.toLowerCase().includes(trimmed),
          ),
    [items, trimmed],
  );

  const categories = React.useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const item of filtered) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div>
      <label htmlFor="faq-search" className="sr-only">
        Search frequently asked questions
      </label>
      <input
        id="faq-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions…"
        className="h-11 w-full rounded-xl border border-[var(--brand-border)] bg-white px-4 text-[14px] text-ink placeholder:text-text-subtle focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.18)]"
      />
      <p aria-live="polite" className="mt-2 text-[11.5px] text-text-subtle">
        {trimmed
          ? `${filtered.length} ${filtered.length === 1 ? "answer" : "answers"} matching “${query.trim()}”`
          : `${items.length} answers across ${new Set(items.map((i) => i.category)).size} topics`}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--brand-border-strong)] px-6 py-10 text-center">
          <p className="text-[14px] font-semibold text-ink">No matching answers</p>
          <p className="mx-auto mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-text-muted">
            Try a different word, or write to support and you will get a direct reply.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-8">
          {categories.map(([category, list]) => (
            <section key={category}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink">
                {category}
              </h3>
              <FaqAccordion items={list} className="mt-3" />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

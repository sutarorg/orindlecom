import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { HelpBlock } from "@/config/help/types";
import { cn } from "@/lib/utils";

/**
 * Article body renderer.
 *
 * The measure is 68ch and the body size is larger than the marketing site's
 * 14px — help content is read while doing something else, usually on a second
 * screen or mid-task, so it gets a little more room per line and more leading
 * than a product page.
 */
export function ArticleBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index} className="text-[15px] leading-[1.7] tracking-[-0.01em] text-text-muted">
                {block.text}
              </p>
            );

          case "steps":
            return (
              <ol key={index} className="space-y-3">
                {block.items.map((item, stepIndex) => (
                  <li key={stepIndex} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold tabular-nums text-primary-ink"
                    >
                      {stepIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold leading-[1.5] text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[14px] leading-[1.65] text-text-muted">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            );

          case "list":
            return (
              <ul key={index} className="space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="relative pl-4 text-[15px] leading-[1.7] text-text-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-[10px] h-1.5 w-1.5 rounded-full bg-[var(--brand-border-strong)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            );

          case "note":
            return (
              <div
                key={index}
                className={cn(
                  "flex gap-2.5 rounded-[12px] border p-3.5",
                  block.tone === "warning"
                    ? "border-[#F1D9A8] bg-[#FEFBF3]"
                    : "border-[var(--brand-border-strong)] bg-[var(--brand-canvas)]",
                )}
              >
                {block.tone === "warning" ? (
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#96610B]"
                    strokeWidth={2.1}
                    aria-hidden="true"
                  />
                ) : (
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    strokeWidth={2.1}
                    aria-hidden="true"
                  />
                )}
                <p
                  className={cn(
                    "text-[13.5px] leading-[1.65]",
                    block.tone === "warning" ? "text-[#7A5209]" : "text-text",
                  )}
                >
                  {block.text}
                </p>
              </div>
            );

          case "table":
            return (
              <figure key={index} className="overflow-hidden rounded-[12px] border border-[var(--brand-border)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left">
                    <thead>
                      <tr className="bg-[var(--brand-canvas)]">
                        {block.head.map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="border-b border-[var(--brand-border)] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-subtle"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-[var(--brand-border-soft)] last:border-0"
                        >
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={cn(
                                "px-3.5 py-2.5 align-top text-[13px] leading-[1.6]",
                                cellIndex === 0 ? "font-semibold text-ink" : "text-text-muted",
                              )}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </figure>
            );

          case "link":
            return (
              <Link
                key={index}
                href={block.href}
                className="group flex items-start gap-3 rounded-[12px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-3.5 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                  strokeWidth={2.1}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">{block.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-[1.6] text-text-muted">
                    {block.text}
                  </span>
                </span>
                <ArrowRight
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </Link>
            );

          case "placeholder":
            return (
              <div key={index} className="rounded-[12px] border border-dashed border-[#D9B978] bg-[#FEFBF3] p-3.5">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#8A5A0A]">
                  Open question
                </p>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#7A5209]">{block.text}</p>
              </div>
            );
        }
      })}
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, Info, TriangleAlert } from "lucide-react";
import type { BlogBlock } from "@/config/blog/types";

/**
 * Blog body renderer.
 *
 * Two responsibilities beyond layout. Inline `[text](/path)` and `**bold**` are
 * parsed here rather than stored as HTML, so content stays plain data and cannot
 * inject markup. And internal links go through `next/link` while external ones
 * get `rel="noopener"` and an outbound affordance — the difference between the two
 * is a trust decision, and the renderer is the right place to make it once.
 */

/** Renders inline markdown-ish syntax: **bold** and [text](href). */
function Inline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Split on links first, then bold inside the remaining text.
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const renderBold = (value: string, prefix: string) => {
    const boldPattern = /\*\*([^*]+)\*\*/g;
    const nodes: React.ReactNode[] = [];
    let boldLast = 0;
    let boldMatch: RegExpExecArray | null;
    while ((boldMatch = boldPattern.exec(value)) !== null) {
      if (boldMatch.index > boldLast) nodes.push(value.slice(boldLast, boldMatch.index));
      nodes.push(
        <strong key={`${prefix}-b-${boldMatch.index}`} className="font-semibold text-ink">
          {boldMatch[1]}
        </strong>,
      );
      boldLast = boldMatch.index + boldMatch[0].length;
    }
    if (boldLast < value.length) nodes.push(value.slice(boldLast));
    return nodes;
  };

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(...renderBold(text.slice(lastIndex, match.index), `t${key}`));
    const [, label, href] = match;
    const internal = href.startsWith("/");
    parts.push(
      internal ? (
        <Link
          key={`l${key++}`}
          href={href}
          className="font-medium text-primary-ink underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
        >
          {label}
        </Link>
      ) : (
        <a
          key={`l${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[24px] items-center gap-0.5 py-0.5 font-medium text-primary-ink underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
        >
          {label}
          <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
        </a>
      ),
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) parts.push(...renderBold(text.slice(lastIndex), `t${key}`));

  return <>{parts}</>;
}

export function ArticleBlocks({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index} className="text-[16px] leading-[1.72] tracking-[-0.011em] text-text">
                <Inline text={block.text} />
              </p>
            );

          case "h2":
            return (
              <h2
                key={index}
                id={block.id}
                className="scroll-mt-24 pt-4 text-[24px] font-extrabold leading-[1.2] tracking-[-0.03em] text-ink sm:text-[27px]"
              >
                {block.text}
              </h2>
            );

          case "h3":
            return (
              <h3
                key={index}
                className="pt-2 text-[19px] font-bold leading-[1.3] tracking-[-0.02em] text-ink"
              >
                {block.text}
              </h3>
            );

          case "list":
            return block.ordered ? (
              <ol key={index} className="ml-5 list-decimal space-y-2.5">
                {block.items.map((item, i) => (
                  <li key={i} className="pl-1 text-[15.5px] leading-[1.7] text-text">
                    <Inline text={item} />
                  </li>
                ))}
              </ol>
            ) : (
              <ul key={index} className="space-y-2.5">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[15.5px] leading-[1.7] text-text">
                    <span
                      aria-hidden="true"
                      className="mt-[0.6em] h-[5px] w-[5px] shrink-0 rounded-full bg-primary/70"
                    />
                    <span className="min-w-0">
                      <Inline text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );

          case "steps":
            return (
              <ol key={index} className="space-y-4">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold tabular-nums text-primary-ink"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold leading-[1.5] text-ink">{item.title}</p>
                      <p className="mt-1 text-[15px] leading-[1.68] text-text">
                        <Inline text={item.text} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );

          case "table":
            return (
              <figure key={index} className="my-6">
                <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--brand-border)]">
                        {block.head.map((cell, i) => (
                          <th
                            key={i}
                            scope="col"
                            className="px-3 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-text-subtle"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r} className="border-b border-[var(--brand-border-soft)]">
                          {row.map((cell, c) => (
                            <td
                              key={c}
                              className={
                                c === 0
                                  ? "px-3 py-3 align-top text-[14px] font-semibold text-ink"
                                  : "px-3 py-3 align-top text-[14px] leading-[1.6] text-text-muted"
                              }
                            >
                              <Inline text={cell} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.caption && (
                  <figcaption className="mt-2.5 text-[12.5px] leading-[1.5] text-text-subtle">
                    {block.caption}
                  </figcaption>
                )}
              </figure>
            );

          case "note":
            return (
              <aside
                key={index}
                className={
                  block.tone === "warning"
                    ? "flex gap-3 rounded-2xl border border-[#F1D9A8] bg-[#FEFBF3] p-4"
                    : "flex gap-3 rounded-2xl border border-[var(--brand-border)] bg-surface-muted p-4"
                }
              >
                {block.tone === "warning" ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#96610B]" />
                ) : (
                  <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
                )}
                <p className="text-[14px] leading-[1.65] text-text">
                  <Inline text={block.text} />
                </p>
              </aside>
            );

          case "callout":
            return (
              <div
                key={index}
                className="rounded-2xl border border-[var(--brand-border)] bg-surface-muted p-5"
              >
                <p className="text-[14px] font-bold uppercase tracking-[0.05em] text-primary-ink">
                  {block.title}
                </p>
                <p className="mt-2 text-[14.5px] leading-[1.68] text-text">
                  <Inline text={block.text} />
                </p>
              </div>
            );

          case "source":
            return (
              <div key={index} className="border-l-2 border-[var(--brand-border)] pl-3.5">
                <a
                  href={block.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[24px] items-center gap-1 py-0.5 text-[14px] font-medium text-primary-ink underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
                >
                  {block.label}
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                </a>
                {block.note && (
                  <p className="mt-0.5 text-[13px] leading-[1.55] text-text-subtle">{block.note}</p>
                )}
              </div>
            );

          case "comparison":
            return (
              <div key={index} className="space-y-3">
                {block.items.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-[var(--brand-border)] bg-surface p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[15.5px] font-bold text-ink">{item.name}</p>
                      <p className="text-[12.5px] font-semibold text-primary-ink">{item.verdict}</p>
                    </div>
                    <p className="mt-1.5 text-[14.5px] leading-[1.68] text-text-muted">
                      <Inline text={item.detail} />
                    </p>
                  </div>
                ))}
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

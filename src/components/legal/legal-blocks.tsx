import Link from "next/link";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { placeholderDefinition, PLACEHOLDER_VALUES } from "@/config/legal/placeholders";
import type { LegalBlock } from "@/config/legal/types";
import { cn } from "@/lib/utils";

/**
 * Block renderer for policy content.
 *
 * Two constraints shape this file. First, long-form legal text has to be
 * comfortable at 68 characters, so the measure is set here rather than inherited
 * from whatever container happens to wrap it. Second, a placeholder must look
 * unmistakably unfinished — a reader skimming must not mistake "Registered legal
 * entity name" for the actual company name.
 */
export function LegalBlocks({ blocks }: { blocks: LegalBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <LegalBlockView key={index} block={block} />
      ))}
    </div>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="text-[14px] leading-[1.75] tracking-[-0.01em] text-text-muted">{block.text}</p>
      );

    case "list":
      return block.ordered ? (
        <ol className="ml-5 list-decimal space-y-2 text-[14px] leading-[1.72] text-text-muted marker:text-text-subtle">
          {block.items.map((item, index) => (
            <li key={index} className="pl-1">
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2 text-[14px] leading-[1.72] text-text-muted">
          {block.items.map((item, index) => (
            <li key={index} className="relative pl-4">
              <span
                aria-hidden="true"
                className="absolute left-0 top-[9px] h-1.5 w-1.5 rounded-full bg-[var(--brand-border-strong)]"
              />
              {item}
            </li>
          ))}
        </ul>
      );

    case "sub":
      return (
        <div className="space-y-3">
          <h3 className="text-[15px] font-bold tracking-[-0.02em] text-ink">{block.heading}</h3>
          <LegalBlocks blocks={block.blocks} />
        </div>
      );

    case "note": {
      const tone = NOTE_TONES[block.tone];
      const Icon = tone.icon;
      return (
        <div className={cn("rounded-[12px] border p-3.5 sm:p-4", tone.shell)}>
          <p className={cn("flex items-center gap-1.5 text-[12.5px] font-bold", tone.title)}>
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            {block.title ?? tone.defaultTitle}
          </p>
          <p className={cn("mt-1.5 text-[13px] leading-[1.65] tracking-[-0.01em]", tone.text)}>
            {block.text}
          </p>
        </div>
      );
    }

    case "placeholder": {
      const definition = placeholderDefinition(block.key);
      const value = PLACEHOLDER_VALUES[block.key];
      return (
        <div className="rounded-[12px] border border-dashed border-[#D9B978] bg-[#FEFBF3] p-3.5">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#F5E4BE] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#7A5209]">
              To be completed
            </span>
            <span className="text-[13px] font-bold text-[#5C3D06]">{definition.label}</span>
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.6] text-[#7A5209]">
            {value ?? block.note ?? definition.why}
          </p>
        </div>
      );
    }

    case "table":
      return (
        <figure className="overflow-hidden rounded-[12px] border border-[var(--brand-border)]">
          {block.caption && (
            <figcaption className="border-b border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-subtle">
              {block.caption}
            </figcaption>
          )}
          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full min-w-[520px] border-collapse text-left">
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
                  <tr key={rowIndex} className="border-b border-[var(--brand-border-soft)] last:border-0">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={cn(
                          "px-3.5 py-2.5 align-top text-[12.5px] leading-[1.6]",
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

    case "definitions":
      return (
        <dl className="divide-y divide-[var(--brand-border-soft)] rounded-[12px] border border-[var(--brand-border)]">
          {block.items.map((item) => (
            <div key={item.term} className="px-3.5 py-2.5">
              <dt className="text-[13px] font-bold text-ink">{item.term}</dt>
              <dd className="mt-0.5 text-[13px] leading-[1.65] text-text-muted">{item.text}</dd>
            </div>
          ))}
        </dl>
      );
  }
}

const NOTE_TONES = {
  info: {
    icon: Info,
    defaultTitle: "Note",
    shell: "border-[var(--brand-border-strong)] bg-[var(--brand-canvas)]",
    title: "text-ink",
    text: "text-text-muted",
  },
  warning: {
    icon: AlertTriangle,
    defaultTitle: "Needs attention",
    shell: "border-[#F1D9A8] bg-[#FEFBF3]",
    title: "text-[#7A4E06]",
    text: "text-[#7A5209]",
  },
  critical: {
    icon: OctagonAlert,
    defaultTitle: "Important",
    shell: "border-[#F0C7C1] bg-[#FDF3F2]",
    title: "text-[#8F2D20]",
    text: "text-[#8F2D20]/85",
  },
} as const;

/** Cross-links between policies, rendered at the foot of every legal page. */
export function LegalCrossLinks({
  currentId,
  documents,
}: {
  currentId: string;
  documents: Array<{ id: string; path: string; title: string; purpose: string }>;
}) {
  const others = documents.filter((doc) => doc.id !== currentId);
  return (
    <nav aria-label="Other policies" className="mt-10 border-t border-[var(--brand-border)] pt-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
        Related documents
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {others.map((doc) => (
          <li key={doc.id}>
            <Link
              href={doc.path}
              className="flex min-h-[44px] flex-col justify-center rounded-[10px] border border-[var(--brand-border)] px-3 py-2 transition-colors hover:border-[var(--brand-border-strong)] hover:bg-[var(--brand-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-[12.5px] font-semibold text-ink">{doc.title}</span>
              <span className="text-[11px] text-text-subtle">{doc.purpose}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

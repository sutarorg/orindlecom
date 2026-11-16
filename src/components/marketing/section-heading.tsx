import { cn } from "@/lib/utils";

/**
 * Section heading.
 *
 * The reference sets section headings in the same 800-weight, tightly
 * tracked face as the hero, but at 23–28px. Both section headings on the
 * homepage are single sentences, so they are rendered as an `h2` and rely on
 * `text-wrap: balance` for pleasing line breaks at narrow widths.
 */
export function SectionHeading({
  children,
  className,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <Tag
      className={cn(
        "text-[length:var(--brand-h2-size)] font-extrabold leading-[var(--brand-h2-line)] tracking-[var(--brand-h2-tracking)] text-ink",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Centred intro used by interior pages. */
export function PageIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-[680px] text-center", className)}>
      {eyebrow && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink">
          {eyebrow}
        </p>
      )}
      <SectionHeading as="h1" className="text-balance">
        {title}
      </SectionHeading>
      {description && (
        <p className="mx-auto mt-4 max-w-[560px] text-[length:var(--brand-body-size)] leading-[1.62] tracking-[var(--brand-body-tracking)] text-text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

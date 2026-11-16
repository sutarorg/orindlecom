import { cn } from "@/lib/utils";

/**
 * The authentication card.
 *
 * Measurements carried over from the reference's pricing cards and the CTA
 * band: 18px radius, one hairline border at `--brand-border`, a shadow that is
 * felt rather than seen, and enough padding that the first line of type does
 * not crowd the edge. On phones the card loses its border and shadow and
 * becomes the page — a floating panel 16px from each edge reads as a widget,
 * whereas a full-bleed form reads as the thing you came to do.
 */
export function AuthCard({
  children,
  eyebrow,
  title,
  description,
  className,
  /** Rendered flush to the card edge, above the padded body. */
  banner,
}: {
  children?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  className?: string;
  banner?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-[var(--brand-border)] bg-white shadow-[var(--brand-shadow-lg)]",
        // Phone: dissolve into the page.
        "max-[639px]:rounded-none max-[639px]:border-0 max-[639px]:bg-transparent max-[639px]:shadow-none",
        className,
      )}
    >
      {banner}
      <div className="px-5 py-7 sm:px-8 sm:py-9">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1
          className={cn(
            "text-[19px] font-extrabold leading-[1.24] tracking-[-0.035em] text-ink sm:text-[22px]",
            eyebrow ? "mt-2.5" : "",
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{description}</p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

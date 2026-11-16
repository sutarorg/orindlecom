import { cn } from "@/lib/utils";

/**
 * Empty state.
 *
 * One component, but deliberately not one look. The spec calls for different
 * explanations for different situations, so the visual weight is driven by a
 * `variant`:
 *
 *  - `first-use` — the biggest treatment, with an illustration slot. This is
 *    the moment the product is introducing itself; it earns the space.
 *  - `collection` — a quiet icon plate. The library exists, this view is just
 *    empty; a hero illustration here would be shouting at someone with 400
 *    files who happened to click Starred.
 *  - `inline` — no plate at all, for empty panels inside a card.
 *  - `error` — same plate, destructive tint, and always a retry action.
 *
 * `art` accepts a node for the illustrated first-run states; every other
 * variant renders the icon plate.
 */
export function EmptyState({
  variant = "collection",
  icon: Icon,
  art,
  title,
  description,
  action,
  secondaryAction,
  footnote,
  className,
}: {
  variant?: "first-use" | "collection" | "inline" | "error";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  art?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
}) {
  const isFirstUse = variant === "first-use";
  const isInline = variant === "inline";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        isFirstUse && "px-4 py-12 sm:py-16",
        variant === "collection" && "px-4 py-12",
        isInline && "px-4 py-6",
        variant === "error" && "px-4 py-10",
        className,
      )}
    >
      {art && isFirstUse ? (
        <div className="mb-6 w-full max-w-[260px]">{art}</div>
      ) : Icon && !isInline ? (
        <span
          className={cn(
            "flex items-center justify-center rounded-2xl",
            isFirstUse ? "h-16 w-16" : "h-12 w-12",
            variant === "error"
              ? "bg-[#FDF3F2] text-[#C93B2B]"
              : "bg-[var(--brand-surface-muted)] text-text-muted",
          )}
        >
          <Icon
            className={isFirstUse ? "h-7 w-7" : "h-5 w-5"}
            strokeWidth={1.7}
            aria-hidden
          />
        </span>
      ) : null}

      <h3
        className={cn(
          "font-extrabold tracking-[-0.03em] text-ink",
          isFirstUse ? "mt-0 text-[19px] sm:text-[22px]" : "mt-4 text-[14px]",
          art && isFirstUse && "mt-0",
          Icon && !isInline && !isFirstUse && "mt-4",
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "mx-auto mt-1.5 leading-relaxed text-text-muted",
            isFirstUse ? "max-w-[340px] text-[13px]" : "max-w-[320px] text-[12.5px]",
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div
          className={cn(
            "mt-5 flex flex-wrap items-center justify-center gap-2",
            isFirstUse && "flex-col sm:flex-row",
          )}
        >
          {action}
          {secondaryAction}
        </div>
      )}

      {footnote && (
        <p className="mt-4 max-w-[340px] text-[11.5px] leading-relaxed text-text-subtle">
          {footnote}
        </p>
      )}
    </div>
  );
}

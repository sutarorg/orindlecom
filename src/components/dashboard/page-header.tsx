import { cn } from "@/lib/utils";

/**
 * Page header for a dashboard route.
 *
 * Title, one line of context, and the primary action. Deliberately restrained:
 * the file manager below it is the content, and a large decorative header would
 * push the first row of files below the fold on a laptop.
 */
export function PageHeader({
  title,
  description,
  action,
  secondary,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[23px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-[560px] text-[12.5px] leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>
      {(action || secondary) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {secondary}
          {action}
        </div>
      )}
    </div>
  );
}

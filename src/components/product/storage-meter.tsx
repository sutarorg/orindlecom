import { formatBytes } from "@/lib/drive/format";
import { cn } from "@/lib/utils";

/**
 * Sizes here go through the same formatter as the dashboard, so a meter on the
 * marketing page and a meter in the product can never disagree about what
 * "9.4 GB" means. There used to be a second implementation in this file; it
 * drifted to binary units while the rest of the product was decimal.
 */
const human = (bytes: number) => formatBytes(bytes, { decimals: 1 });

/**
 * Storage meter.
 *
 * A real indicator: the fill is derived from `used / total`, and the percentage
 * is also stated in text so the information is never carried by colour alone.
 * Amber above 80%, red at full.
 */
export function StorageMeter({
  used,
  total,
  className,
  compact = false,
}: {
  used: number;
  total: number;
  className?: string;
  compact?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (used / total) * 100)) : 0;
  const state = pct >= 100 ? "full" : pct >= 80 ? "high" : "normal";
  const fill =
    state === "full" ? "#E0533D" : state === "high" ? "#F9A53B" : "var(--brand-primary)";

  return (
    <div
      className={cn(compact ? "rounded-lg bg-[var(--brand-surface-muted)] p-2" : "", className)}
      role="group"
      aria-label={`Storage used: ${human(used)} of ${human(total)} (${Math.round(pct)}%)`}
    >
      <p
        className={cn(
          "font-semibold leading-none text-ink",
          compact ? "text-[9px]" : "text-[12px]",
        )}
      >
        Storage
      </p>

      <div
        className={cn("overflow-hidden rounded-full bg-[#E3E8F5]", compact ? "mt-1.5" : "mt-2")}
        style={{ height: compact ? 3 : 6 }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-[var(--brand-ease-out)]"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
      </div>

      <p
        className={cn(
          "leading-none text-text-subtle",
          compact ? "mt-1.5 text-[8px]" : "mt-2 text-[11px]",
        )}
      >
        {human(used)} / {human(total)}
        {pct > 0 && <span className="ml-1 tabular-nums">· {Math.round(pct)}%</span>}
      </p>
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Orindle cloud glyph.
 *
 * Traced from the reference: a wide, low cloud with a flat base, a large left
 * lobe, a higher right lobe and a soft rounded silhouette. Rendered as an SVG
 * so it stays crisp at every size and can inherit the brand colour.
 */
export function CloudGlyph({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 22"
      fill="none"
      aria-hidden="true"
      className={cn("h-[22px] w-8", className)}
      {...props}
    >
      <path
        d="M9.35 21.1c-2.4 0-4.44-.83-6.12-2.5C1.55 16.93.71 14.9.71 12.5c0-2.03.61-3.82 1.84-5.36A8.2 8.2 0 0 1 7.2 4.4a6.95 6.95 0 0 1 2.64-3.1A7.06 7.06 0 0 1 13.7.2c1.9 0 3.58.6 5.03 1.8a8.6 8.6 0 0 1 2.73 3.86 6.9 6.9 0 0 1 4.34 1.19 6.53 6.53 0 0 1 2.5 3.16c.4.86.6 1.75.6 2.68 0 2.4-.85 4.44-2.54 6.13-1.69 1.69-3.72 2.53-6.1 2.53H9.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({
  className,
  glyphClassName,
  showGlyph = true,
}: {
  className?: string;
  glyphClassName?: string;
  showGlyph?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {showGlyph && (
        <CloudGlyph className={cn("h-[17px] w-[26px] text-primary", glyphClassName)} />
      )}
      <span className="text-[19px] font-bold tracking-[-0.02em] text-ink">Orindle</span>
    </span>
  );
}

/** Hairline divider with a centred label, used between OAuth and the form. */
export function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--brand-border)]" />
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-subtle">
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--brand-border)]" />
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog.
 *
 * Hand-rolled rather than pulled from a library so the focus trap, Escape
 * handling and scroll lock are visible and testable. Built on `<dialog>`-like
 * semantics without the element itself, because we need full control of the
 * enter/exit transition and the centring behaviour at every breakpoint.
 *
 * Behaviour contract:
 *  - Focus moves to the first focusable element on open, restores on close.
 *  - Tab cycles inside the panel; Escape closes unless `dismissible={false}`.
 *  - Body scroll locks while open, and the scrollbar gap is compensated so the
 *    page doesn't shift horizontally.
 *  - Backdrop click closes, but a click that started inside and ended outside
 *    (a text selection dragged too far) does not.
 *  - On small screens the panel becomes a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
  /** Visually hidden title still required for the a11y name. */
  hideHeader = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
  hideHeader?: boolean;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    // Compensate for the vanishing scrollbar so content doesn't jump.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Prefer an element marked autofocus, then the first focusable.
    const raf = requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? focusables()[0] ?? panelRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!mounted || !open) return null;

  const startedInside = { current: false };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[rgba(14,20,48,0.42)] backdrop-blur-[2px] motion-safe:animate-[fadeIn_140ms_ease-out]"
        onMouseDown={() => {
          startedInside.current = true;
        }}
        onClick={() => {
          if (dismissible) onClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onMouseDown={() => {
          startedInside.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-[0_24px_60px_-12px_rgba(23,29,58,0.28)]",
          // Mobile: bottom sheet with rounded top corners.
          "rounded-t-[20px] motion-safe:animate-[sheetUp_180ms_cubic-bezier(0.22,0.68,0.28,1)]",
          // Desktop: centred card.
          "sm:rounded-[18px] sm:motion-safe:animate-[dialogIn_160ms_cubic-bezier(0.22,0.68,0.28,1)]",
          size === "sm" && "sm:max-w-[380px]",
          size === "md" && "sm:max-w-[480px]",
          size === "lg" && "sm:max-w-[640px]",
          "focus:outline-none",
        )}
      >
        {hideHeader ? (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        ) : (
          <header className="flex items-start justify-between gap-4 border-b border-[var(--brand-border-soft)] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-[15px] font-extrabold leading-tight tracking-[-0.025em] text-ink"
              >
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-[var(--brand-border-soft)] bg-[var(--brand-canvas)] px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
        {/* Safe-area padding so the sheet's actions clear the home indicator. */}
        <div aria-hidden="true" className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </div>,
    document.body,
  );
}

/**
 * Confirmation dialog for destructive operations.
 *
 * Requires an explicit destructive label ("Delete", "Empty trash") rather than
 * a generic OK, and states consequence + reversibility in the body. For the
 * irreversible ones the caller passes `requireTyping`, which gates the confirm
 * button behind the exact string.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  requireTyping,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireTyping?: string;
  pending?: boolean;
}) {
  const [typed, setTyped] = React.useState("");
  const inputId = React.useId();

  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const blocked = Boolean(requireTyping) && typed.trim() !== requireTyping;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!pending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 sm:min-w-[92px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={blocked || pending}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 sm:min-w-[110px]",
              destructive
                ? "bg-[#D6455D] hover:bg-[#BF344B] focus-visible:ring-[#D6455D]"
                : "bg-primary hover:bg-primary-hover focus-visible:ring-primary",
            )}
          >
            {pending && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {pending ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-text">{children}</div>

      {requireTyping && (
        <div className="mt-4">
          <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-semibold text-ink">
            Type <span className="font-mono text-[12px] text-[#C93B2B]">{requireTyping}</span> to
            confirm
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            data-autofocus
            className="h-10 w-full rounded-xl border border-[var(--brand-border-strong)] bg-white px-3 text-[13.5px] text-ink focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]"
          />
        </div>
      )}
    </Dialog>
  );
}

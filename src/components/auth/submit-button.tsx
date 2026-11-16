"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form submit button.
 *
 * Owns the loading state so no screen can forget it: while pending the button
 * is disabled (preventing double submits, which on a signup form means two
 * confirmation emails), shows a spinner, and keeps its width by swapping only
 * the label — a button that changes width mid-click moves the target out from
 * under the pointer.
 */
export function SubmitButton({
  children,
  pending,
  pendingLabel,
  disabled,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5",
        "text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)]",
        "transition-[background-color,box-shadow,transform] duration-150 ease-[var(--brand-ease-out)]",
        "hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 active:bg-[var(--brand-primary-active)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-60 disabled:shadow-none",
        className,
      )}
      {...props}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}

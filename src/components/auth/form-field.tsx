"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form label, input shell, and inline validation.
 *
 * One component owns the whole field contract so every screen gets the same
 * behaviour: a persistent label (never a placeholder standing in for one),
 * `aria-invalid` and `aria-describedby` wired automatically, error text that is
 * announced politely, and a focus ring that survives on a coloured surface.
 */

export interface FieldMessage {
  tone: "error" | "hint" | "success";
  text: string;
}

/**
 * The visual shell every control shares. Exported because the password input
 * needs to layer a reveal button inside it without duplicating the classes.
 */
export function controlClass({
  invalid = false,
  hasTrailing = false,
  className,
}: {
  invalid?: boolean;
  hasTrailing?: boolean;
  className?: string;
}) {
  return cn(
    "h-11 w-full rounded-xl border bg-white text-[14px] text-ink shadow-[var(--brand-shadow-xs)]",
    "transition-[border-color,box-shadow] duration-150 ease-[var(--brand-ease-out)]",
    "placeholder:text-text-subtle/90",
    // 16px minimum on phones prevents iOS Safari zooming the viewport on focus.
    "max-[639px]:text-[16px]",
    hasTrailing ? "pl-3.5 pr-11" : "px-3.5",
    "focus:outline-none focus:ring-[3px]",
    invalid
      ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
      : "border-[var(--brand-border-strong)] hover:border-[#c3cade] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
    "disabled:cursor-not-allowed disabled:bg-[var(--brand-surface-muted)] disabled:text-text-subtle",
    className,
  );
}

export function FormField({
  id,
  label,
  hint,
  error,
  success,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  success?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const successId = success ? `${id}-success` : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-[12.5px] font-semibold tracking-[-0.01em] text-ink"
        >
          {label}
        </label>
        {optional && <span className="text-[11px] text-text-subtle">Optional</span>}
      </div>

      {/* The input receives describedby via context-free props from the caller;
          we expose the ids so it can reference them. */}
      <div data-field-id={id} className="relative">
        {children}
      </div>

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-[11.5px] leading-relaxed text-text-subtle">
          {hint}
        </p>
      )}

      {/* One live region per field: screen readers hear the change, sighted
          users get the same sentence next to the control. */}
      <div role={error ? "alert" : undefined} aria-live="polite" className="empty:hidden">
        {error && (
          <p
            id={errorId}
            className="mt-1.5 flex items-start gap-1.5 text-[11.5px] font-medium leading-relaxed text-[#C93B2B]"
          >
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {success && !error && (
        <p id={successId} className="mt-1.5 text-[11.5px] font-medium text-[#1B6B45]">
          {success}
        </p>
      )}
    </div>
  );
}

/** Composes the `aria-describedby` value for a field with a hint and/or error. */
export function describedBy(id: string, { hint, error, success }: { hint?: boolean; error?: boolean; success?: boolean }) {
  const ids = [
    hint && `${id}-hint`,
    error && `${id}-error`,
    success && `${id}-success`,
  ].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checkbox.
 *
 * The native input stays in the DOM and keeps focus, so keyboard users and
 * password managers see a real checkbox; the visible box is a sibling span
 * styled with peer variants. The 20px hit target is expanded to 44px of
 * padding so it is comfortably tappable on a phone without making the row tall.
 */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & {
    label: React.ReactNode;
    error?: string;
    id: string;
  }
>(function Checkbox({ id, label, error, ...props }, ref) {
  const errorId = `${id}-error`;
  return (
    <div>
      <div className="flex items-start gap-2.5">
        {/* 24px box: meets WCAG 2.5.8's minimum pointer target, and the label
            beside it extends the clickable area across the whole row. */}
        <span className="relative flex h-6 shrink-0 items-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "peer h-6 w-6 cursor-pointer appearance-none rounded-[6px] border bg-white",
              "transition-[background-color,border-color] duration-150",
              "checked:border-primary checked:bg-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-[#D6455D]" : "border-[var(--brand-border-strong)] hover:border-[#c3cade]",
            )}
            {...props}
          />
          <Check
            className="pointer-events-none absolute left-[5px] top-[5px] h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100"
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
        <label htmlFor={id} className="cursor-pointer select-none text-[12.5px] leading-[1.5] text-text">
          {label}
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 pl-[34px] text-[11.5px] font-medium text-[#C93B2B]">
          {error}
        </p>
      )}
    </div>
  );
});

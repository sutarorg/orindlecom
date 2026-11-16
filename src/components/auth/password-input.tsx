"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormField, controlClass, describedBy } from "./form-field";

/**
 * Password input.
 *
 * Two details that matter more than they look:
 *
 *  - The reveal button is `type="button"` inside the field, so tapping it never
 *    submits the form, and it is not in the tab order ahead of the password
 *    itself (it sits after the input in DOM order, which is where a sighted
 *    keyboard user expects it).
 *  - Revealing does not change `autoComplete`. Switching the type to `text`
 *    would make some password managers offer to save the value as a username.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "className"> & {
    id: string;
    label: string;
    hint?: React.ReactNode;
    error?: string;
    optional?: boolean;
    autoComplete: "current-password" | "new-password";
    className?: string;
  }
>(function PasswordInput({ id, label, hint, error, optional, autoComplete, className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);
  const describedById = describedBy(id, { hint: Boolean(hint), error: Boolean(error) });

  return (
    <FormField id={id} label={label} hint={hint} error={error} optional={optional}>
      <input
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        className={cn(controlClass({ invalid: Boolean(error), hasTrailing: true, className }))}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        // Pointer-down keeps focus on the input so a half-typed password keeps
        // its caret where the visitor left it.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "absolute inset-y-0 right-1.5 my-auto flex h-8 w-8 items-center justify-center rounded-lg",
          "text-text-subtle transition-colors hover:bg-[var(--brand-surface-muted)] hover:text-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        )}
      </button>
    </FormField>
  );
});

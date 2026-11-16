"use client";

import * as React from "react";
import { FormField, controlClass, describedBy } from "./form-field";

/**
 * Text input.
 *
 * A thin wrapper over `<input>` that owns the field contract: label, hint,
 * error, and the ARIA wiring between them. `autoComplete` is required rather
 * than optional so no screen accidentally ships a field the browser's password
 * manager can't recognise.
 */
export const TextInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
    id: string;
    label: string;
    hint?: React.ReactNode;
    error?: string;
    success?: string;
    optional?: boolean;
    autoComplete: string;
    className?: string;
    /** Rendered at the right edge inside the control. */
    trailing?: React.ReactNode;
  }
>(function TextInput(
  { id, label, hint, error, success, optional, autoComplete, className, trailing, ...props },
  ref,
) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} success={success} optional={optional}>
      <input
        ref={ref}
        id={id}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, {
          hint: Boolean(hint),
          error: Boolean(error),
          success: Boolean(success),
        })}
        className={controlClass({ invalid: Boolean(error), hasTrailing: Boolean(trailing), className })}
        {...props}
      />
      {trailing && (
        <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
      )}
    </FormField>
  );
});

"use client";

import { cn } from "@/lib/utils";
import { scorePassword } from "@/lib/auth/validation";

/**
 * Password strength meter.
 *
 * Four segments and one sentence. The meter is advisory, not a gate — the only
 * hard rule is the 8-character minimum shown elsewhere. Colour is never the
 * only signal: the label names the strength and the suggestions say what to
 * change, so the component works without colour perception.
 *
 * The numeric score is rendered for assistive tech as a progress bar so that
 * "how strong is this" is answerable without seeing the segments.
 */

const BAR_COLOUR: Record<number, string> = {
  0: "bg-[#E3E7F1]",
  1: "bg-[#E0644A]",
  2: "bg-[#E9A13B]",
  3: "bg-[#3F8FEB]",
  4: "bg-[#2FA76B]",
};

export function PasswordStrength({
  password,
  /** Hide until the visitor has typed something, to avoid a red bar on load. */
  className,
}: {
  password: string;
  className?: string;
}) {
  const result = scorePassword(password);
  const started = password.length > 0;

  return (
    <div className={cn("mt-2", className)}>
      <div
        className="flex items-center gap-1.5"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={result.score}
        aria-valuetext={started ? result.label : "No password entered"}
      >
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-200",
              segment <= result.score ? BAR_COLOUR[result.score] : "bg-[#E9ECF4]",
            )}
          />
        ))}
        <span
          className={cn(
            "ml-1.5 w-[52px] shrink-0 text-right text-[11px] font-semibold tabular-nums",
            started ? "text-text" : "text-text-subtle",
          )}
          aria-hidden="true"
        >
          {started ? result.label : ""}
        </span>
      </div>

      <div aria-live="polite" className="min-h-[16px]">
        {started && result.suggestions.length > 0 && (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-text-subtle">
            {result.suggestions[0]}
          </p>
        )}
      </div>
    </div>
  );
}

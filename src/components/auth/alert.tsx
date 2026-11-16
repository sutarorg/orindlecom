"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Error alert / success message / inline notice.
 *
 * One component, four tones. Every instance is a live region so the message is
 * announced when it appears — an error that only changes colour is invisible to
 * a screen reader, and an error rendered above the fold while the visitor is
 * looking at a field further down is invisible to everyone else too.
 *
 * Dismissal is opt-in: an error the visitor dismissed should not reappear on
 * the next keystroke, but a form-level message should not be closable when it
 * explains why the whole submit failed.
 */

type Tone = "error" | "success" | "info" | "warning";

const TONE: Record<Tone, { box: string; icon: typeof CircleAlert }> = {
  error: {
    box: "border-[#F4C7C1] bg-[#FDF3F2] text-[#8F2C1E]",
    icon: TriangleAlert,
  },
  success: {
    box: "border-[#BFE8D2] bg-[#F1FBF5] text-[#1B6B45]",
    icon: CheckCircle2,
  },
  info: {
    box: "border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] text-text",
    icon: Info,
  },
  warning: {
    box: "border-[#F3DFB8] bg-[#FEF9EE] text-[#8A5A12]",
    icon: CircleAlert,
  },
};

export function Alert({
  tone = "error",
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
  /** Override the live-region politeness. Errors should be assertive. */
  live = "polite",
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  live?: "polite" | "assertive" | "off";
}) {
  const { box, icon: Icon } = TONE[tone];

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={live}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed",
        box,
        className,
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" strokeWidth={2.1} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * A success state that replaces the form entirely.
 *
 * Used after signup, password reset and email verification: there is nothing
 * left to fill in, so leaving an empty form on screen invites a second submit.
 */
export function SuccessPanel({
  icon: Icon = CheckCircle2,
  title,
  children,
  action,
}: {
  icon?: typeof CheckCircle2;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center" role="status" aria-live="polite">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF8F0] text-[#1B6B45]">
        <Icon className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[17px] font-extrabold tracking-[-0.03em] text-ink">{title}</h2>
      {children && (
        <div className="mt-2 text-[13px] leading-relaxed text-text-muted">{children}</div>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { abandonMfaAction, verifyMfaAction } from "@/app/auth/mfa/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { Alert } from "@/components/auth/alert";
import { cn } from "@/lib/utils";

/**
 * Six-digit TOTP challenge.
 *
 * Uses a single input rather than six boxes. Six-box codes force the visitor to
 * move focus six times on desktop and are a known screen-reader annoyance; one
 * field with `inputMode="numeric"`, `autoComplete="one-time-code"` and
 * letter-spacing gives the same visual rhythm and lets iOS and Android offer the
 * code straight from the notification.
 */
export function MfaChallengeForm({ next, email }: { next: string; email: string }) {
  const [state, formAction, pending] = useActionState(verifyMfaAction, INITIAL_AUTH_STATE);
  const [code, setCode] = React.useState("");
  const id = React.useId();

  const digits = code.replace(/\D/g, "").slice(0, 6);
  const complete = digits.length === 6;

  // Submit automatically once six digits are in. The last keystroke of a TOTP
  // code is unambiguous, and making someone reach for a button afterwards is a
  // small friction repeated every single sign-in.
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (complete && !pending) formRef.current?.requestSubmit();
  }, [complete, pending]);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <p className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-surface-muted)] px-3 py-2 text-[11.5px] text-text">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden="true" />
        <span className="min-w-0 truncate">
          Second factor for <span className="font-semibold text-ink">{email}</span>
        </span>
      </p>

      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}

      <div>
        <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-ink">
          Six-digit code
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            id={id}
            name="code"
            value={digits}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            aria-invalid={state.status === "error" ? true : undefined}
            disabled={pending}
            autoFocus
            className={cn(
              "h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-[17px] font-semibold tracking-[0.4em] text-ink",
              "placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-text-subtle",
              "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[rgba(49,120,251,0.16)]",
              state.status === "error" ? "border-[#E5A79E]" : "border-[var(--brand-border-strong)]",
              "disabled:opacity-60",
            )}
          />
          {pending && (
            <Loader2
              className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
              strokeWidth={2.4}
              aria-hidden="true"
            />
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
          The code changes every 30 seconds. Spaces are ignored.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || !complete}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden="true" />}
        {pending ? "Verifying…" : "Verify and continue"}
      </button>

      <form action={abandonMfaAction}>
        <button
          type="submit"
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium text-text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Sign out instead
        </button>
      </form>
    </form>
  );
}

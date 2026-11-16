"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { setPasswordAction } from "@/app/auth/set-password/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { validateConfirmPassword, validateNewPassword } from "@/lib/auth/validation";
import { Alert } from "@/components/auth/alert";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { SubmitButton } from "@/components/auth/submit-button";

/**
 * Set Password form.
 *
 * Three fields' worth of behaviour in two inputs: strength feedback, a
 * confirmation that checks itself as you type, per-field errors, and a success
 * state that hands over to the dashboard.
 *
 * The success state is rendered rather than followed by an instant redirect,
 * because the server action *is* the redirect — if it returned instead of
 * redirecting, something went wrong and a fake "done" would hide it. So this
 * component only ever shows success when the action resolved successfully, which
 * happens in one case: the redirect was suppressed by a soft navigation race.
 * In practice the redirect wins and this branch is a fallback.
 */
export function SetPasswordForm({ next, email }: { next: string; email: string }) {
  const [state, formAction, pending] = useActionState(setPasswordAction, INITIAL_AUTH_STATE);

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{ password?: string; confirmPassword?: string }>({});

  const fieldError = (field: "password" | "confirmPassword") =>
    errors[field] ?? state.fieldErrors?.[field];

  React.useEffect(() => {
    if (state.status === "error" && state.fieldErrors) {
      setErrors({
        password: state.fieldErrors.password,
        confirmPassword: state.fieldErrors.confirmPassword,
      });
    }
  }, [state]);

  // Check the confirmation as soon as both fields have content.
  React.useEffect(() => {
    if (!confirmPassword) return;
    const message = validateConfirmPassword(password, confirmPassword);
    setErrors((current) => {
      const copy = { ...current };
      if (message) copy.confirmPassword = message;
      else delete copy.confirmPassword;
      return copy;
    });
  }, [password, confirmPassword]);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password set">
          {state.message}
        </Alert>
        <a
          href={next}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Go to your dashboard
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />

      {/* Restates which address this password belongs to. Two accounts open in
          two tabs is a real situation, and setting a password on the wrong one
          is silent and annoying. */}
      <p className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-surface-muted)] px-3 py-2 text-[11.5px] text-text">
        <Mail className="h-3.5 w-3.5 shrink-0 text-text-subtle" strokeWidth={2} aria-hidden="true" />
        <span className="min-w-0 truncate">
          Signing in as <span className="font-semibold text-ink">{email}</span>
        </span>
      </p>

      {state.status === "error" && !state.fieldErrors && <Alert tone="error">{state.message}</Alert>}

      <div>
        <PasswordInput
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          error={fieldError("password")}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          onBlur={() => {
            if (!password) return;
            const message = validateNewPassword(password);
            if (message) setErrors((current) => ({ ...current, password: message }));
          }}
          disabled={pending}
          autoFocus
        />
        <PasswordStrength password={password} className="mt-2" />
      </div>

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Type it again"
        value={confirmPassword}
        error={fieldError("confirmPassword")}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setErrors((current) => ({ ...current, confirmPassword: undefined }));
        }}
        disabled={pending}
      />

      <SubmitButton pending={pending} pendingLabel="Setting password…">
        Set password
      </SubmitButton>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-subtle">
        <CheckCircle2 className="mt-px h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        You&apos;ll be able to sign in with either your email and this password, or with Google.
      </p>
    </form>
  );
}

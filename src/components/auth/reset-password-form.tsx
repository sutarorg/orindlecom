"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { updatePasswordAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { validateConfirmPassword, validateNewPassword } from "@/lib/auth/validation";
import { Alert, SuccessPanel } from "./alert";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";

/**
 * Reset-password form.
 *
 * Only reachable with a live recovery session — the page guards on the server
 * and renders an expired-link state otherwise, so this component never has to
 * pretend a reset is possible when it isn't.
 */
export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, INITIAL_AUTH_STATE);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  if (state.status === "success") {
    return (
      <SuccessPanel
        title="Password updated"
        action={
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Sign in with your new password
          </Link>
        }
      >
        You&apos;re signed in on this device. Other devices stay signed in until you sign them out
        &mdash; change this password again later if that matters.
      </SuccessPanel>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && !state.fieldErrors && <Alert tone="error">{state.message}</Alert>}

      <div>
        <PasswordInput
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          error={errors.password ?? state.fieldErrors?.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          onBlur={() => {
            if (!password) return;
            setErrors((current) => ({ ...current, password: validateNewPassword(password) }));
          }}
          disabled={pending}
          autoFocus
        />
        <PasswordStrength password={password} />
      </div>

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Type it again"
        value={confirmPassword}
        error={errors.confirmPassword ?? state.fieldErrors?.confirmPassword}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setErrors((current) => ({ ...current, confirmPassword: undefined }));
        }}
        onBlur={() => {
          if (!confirmPassword) return;
          setErrors((current) => ({
            ...current,
            confirmPassword: validateConfirmPassword(password, confirmPassword),
          }));
        }}
        disabled={pending}
      />

      <SubmitButton pending={pending} pendingLabel="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}

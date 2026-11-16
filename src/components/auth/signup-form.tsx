"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateNewPassword,
} from "@/lib/auth/validation";
import type { AuthField } from "@/lib/auth/types";
import { Alert } from "./alert";
import { Checkbox } from "./checkbox";
import { TextInput } from "./text-input";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";

/**
 * Signup form.
 *
 * Four fields and a checkbox — nothing else. Every additional field at signup
 * measurably reduces completion, and none of the things a typical form adds
 * (company, phone, role, "how did you hear about us") are needed to create an
 * account here.
 */
export function SignupForm({ plan }: { plan?: string }) {
  const [state, formAction, pending] = useActionState(signUpAction, INITIAL_AUTH_STATE);
  const [errors, setErrors] = React.useState<Partial<Record<AuthField, string>>>({});

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const fieldError = (field: AuthField) => errors[field] ?? state.fieldErrors?.[field];

  React.useEffect(() => {
    if (state.status === "error" && state.fieldErrors) setErrors(state.fieldErrors);
  }, [state]);

  const clearOnEdit = (field: AuthField) =>
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  // Re-check the confirmation whenever either password changes, but only once
  // the visitor has actually typed something in the confirmation field.
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

  return (
    <form action={formAction} noValidate className="space-y-4">
      {plan && <input type="hidden" name="plan" value={plan} />}

      {state.status === "error" && !state.fieldErrors && (
        <Alert tone="error">{state.message}</Alert>
      )}
      {state.status === "error" && state.code === "user_already_exists" && (
        <Alert tone="warning" title="That email is already registered">
          {state.message}{" "}
          <Link href="/login" className="font-semibold underline underline-offset-2">
            Sign in instead
          </Link>
        </Alert>
      )}

      <TextInput
        id="fullName"
        name="fullName"
        label="Full name"
        type="text"
        autoComplete="name"
        placeholder="Your name"
        value={fullName}
        error={fieldError("fullName")}
        onChange={(event) => {
          setFullName(event.target.value);
          clearOnEdit("fullName");
        }}
        onBlur={() => {
          if (!fullName) return;
          const message = validateFullName(fullName);
          if (message) setErrors((current) => ({ ...current, fullName: message }));
        }}
        disabled={pending}
        autoFocus
      />

      <TextInput
        id="email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={fieldError("email")}
        onChange={(event) => {
          setEmail(event.target.value);
          clearOnEdit("email");
        }}
        onBlur={() => {
          if (!email) return;
          const message = validateEmail(email);
          if (message) setErrors((current) => ({ ...current, email: message }));
        }}
        hint="We'll send a confirmation link. No marketing unless you ask."
        disabled={pending}
      />

      <div>
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={password}
          error={fieldError("password")}
          onChange={(event) => {
            setPassword(event.target.value);
            clearOnEdit("password");
          }}
          onBlur={() => {
            if (!password) return;
            const message = validateNewPassword(password);
            if (message) setErrors((current) => ({ ...current, password: message }));
          }}
          disabled={pending}
        />
        <PasswordStrength password={password} />
      </div>

      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Type it again"
        value={confirmPassword}
        error={fieldError("confirmPassword")}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          clearOnEdit("confirmPassword");
        }}
        disabled={pending}
      />

      <Checkbox
        id="terms"
        name="terms"
        error={typeof fieldError("terms") === "string" ? fieldError("terms") : undefined}
        label={
          <>
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </>
        }
      />

      <SubmitButton pending={pending} pendingLabel="Creating account…" className="mt-1">
        Create account
      </SubmitButton>

      <p className="text-center text-[11.5px] leading-relaxed text-text-subtle">
        10 GB free. No credit card, and nothing to cancel.
      </p>
    </form>
  );
}

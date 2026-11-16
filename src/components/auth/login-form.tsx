"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { validateEmail } from "@/lib/auth/validation";
import type { AuthField } from "@/lib/auth/types";
import { Alert } from "./alert";
import { Checkbox } from "./checkbox";
import { TextInput } from "./text-input";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";

/**
 * Sign-in form.
 *
 * Validation is eager on blur and quiet on the first keystroke after an error —
 * scolding someone for a half-typed address is the fastest way to make a login
 * form feel hostile. The server action re-validates; the client check only
 * decides whether to spend a round trip.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, INITIAL_AUTH_STATE);
  const [errors, setErrors] = React.useState<Partial<Record<AuthField, string>>>({});
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  // Server-reported field errors win: they come from the authoritative check.
  const fieldError = (field: AuthField) => errors[field] ?? state.fieldErrors?.[field];

  // Once the action returns, mirror any field errors into local state so they
  // clear on the next edit rather than waiting for another round trip.
  React.useEffect(() => {
    if (state.status === "error" && state.fieldErrors) {
      setErrors(state.fieldErrors);
    }
  }, [state]);

  const clearOnEdit = (field: AuthField) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  return (
    <form action={formAction} noValidate className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {/* Form-level failure. Field-level failures are rendered at the field. */}
      {state.status === "error" && !state.fieldErrors && (
        <Alert tone="error">{state.message}</Alert>
      )}
      {state.status === "error" && state.code === "email_not_confirmed" && (
        <Alert tone="warning" title="Confirm your email first">
          {state.message}{" "}
          <Link href="/verify-email" className="font-semibold underline underline-offset-2">
            Resend the link
          </Link>
        </Alert>
      )}

      <TextInput
        id="email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="username"
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
        disabled={pending}
        autoFocus
      />

      <div>
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          error={fieldError("password")}
          onChange={(event) => {
            setPassword(event.target.value);
            clearOnEdit("password");
          }}
          disabled={pending}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <Checkbox id="remember" name="remember" label="Keep me signed in" defaultChecked />
          <Link
            href="/forgot-password"
            className="rounded text-[12.5px] font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <SubmitButton pending={pending} pendingLabel="Signing in…" className="mt-1">
        Sign in
      </SubmitButton>
    </form>
  );
}

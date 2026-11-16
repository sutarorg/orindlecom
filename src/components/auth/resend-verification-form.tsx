"use client";

import * as React from "react";
import { useActionState } from "react";
import { resendVerificationAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { validateEmail } from "@/lib/auth/validation";
import { Alert } from "./alert";
import { TextInput } from "./text-input";
import { SubmitButton } from "./submit-button";

/**
 * Resend-verification form.
 *
 * The email arrives prefilled from the verification screen when we know it, and
 * is honestly blank when we don't (a visitor who opened /verify-email directly).
 * We never guess an address.
 */
export function ResendVerificationForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, INITIAL_AUTH_STATE);
  const [email, setEmail] = React.useState(defaultEmail);
  const [error, setError] = React.useState<string | undefined>();

  return (
    <form action={formAction} noValidate className="space-y-3.5">
      {state.status === "success" && (
        <Alert tone="success" title="Link sent">
          {state.message}
        </Alert>
      )}
      {state.status === "error" && (
        <Alert tone="error">{state.message}</Alert>
      )}

      <TextInput
        id="email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={error ?? state.fieldErrors?.email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (error) setError(undefined);
        }}
        onBlur={() => {
          if (!email) return;
          setError(validateEmail(email));
        }}
        disabled={pending || state.status === "success"}
      />

      <SubmitButton
        pending={pending}
        pendingLabel="Sending…"
        disabled={state.status === "success"}
      >
        {state.status === "success" ? "Link sent" : "Resend verification email"}
      </SubmitButton>
    </form>
  );
}

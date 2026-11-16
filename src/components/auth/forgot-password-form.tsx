"use client";

import * as React from "react";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth/form-state";
import { validateEmail } from "@/lib/auth/validation";
import { Alert, SuccessPanel } from "./alert";
import { TextInput } from "./text-input";
import { SubmitButton } from "./submit-button";

/**
 * Forgot-password form.
 *
 * The confirmation is intentionally identical whether or not the address has an
 * account. Anything else — a different message, a different timing, even a
 * different animation — turns this screen into an account-enumeration oracle.
 * The action behind it never branches on existence either.
 */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, INITIAL_AUTH_STATE);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();

  if (state.status === "success") {
    return (
      <SuccessPanel icon={MailCheck} title="Check your inbox">
        {/* Deliberately does not echo the address back, for the same reason. */}
        If an account exists for that address, a reset link is on its way. It expires in one hour.
        <br />
        <br />
        Nothing yet? Check spam, then wait a minute before requesting another — links are rate
        limited.
      </SuccessPanel>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.status === "error" && !state.fieldErrors && <Alert tone="error">{state.message}</Alert>}

      <TextInput
        id="email"
        name="email"
        label="Email address"
        type="email"
        inputMode="email"
        autoComplete="username"
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
        disabled={pending}
        autoFocus
      />

      <SubmitButton pending={pending} pendingLabel="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

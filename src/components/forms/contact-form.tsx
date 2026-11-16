"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { submitContact, type ContactState } from "@/app/contact/actions";
import { cn } from "@/lib/utils";

const INITIAL: ContactState = { status: "idle", message: "" };

const SUBJECTS = [
  { value: "sales", label: "Plans and sales" },
  { value: "support", label: "Product support" },
  { value: "billing", label: "Billing" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "other", label: "Something else" },
];

export function ContactForm({ defaultSubject }: { defaultSubject?: string }) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL);
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastSubmitted = React.useRef<Record<string, string> | null>(null);

  const captureValues = () => {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        if (element.name) values[element.name] = element.value;
      }
    }
    lastSubmitted.current = values;
  };

  // React 19 resets a form automatically after a server action resolves, which
  // would throw away a long message on a delivery failure. Restore the submitted
  // values whenever the outcome is not a clean acceptance.
  React.useEffect(() => {
    if (state.status === "success" || !formRef.current || !lastSubmitted.current) return;
    const form = formRef.current;
    for (const [key, value] of Object.entries(lastSubmitted.current)) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (field.type !== "hidden") field.value = value;
      } else if (field instanceof HTMLSelectElement) {
        field.value = value;
      }
    }
  }, [state]);

  const error = (field: keyof NonNullable<ContactState["fieldErrors"]>) =>
    state.fieldErrors?.[field];

  return (
    <form ref={formRef} action={formAction} onSubmit={captureValues} noValidate className="space-y-4">
      {/* honeypot */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={error("name")}>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={Boolean(error("name"))}
            aria-describedby={error("name") ? "name-error" : undefined}
            className={inputClass(Boolean(error("name")))}
            placeholder="Your name"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={error("email")}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(error("email"))}
            aria-describedby={error("email") ? "email-error" : undefined}
            className={inputClass(Boolean(error("email")))}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <Field label="Subject" htmlFor="subject" error={error("subject")}>
        <select
          id="subject"
          name="subject"
          defaultValue={defaultSubject ?? "support"}
          aria-invalid={Boolean(error("subject"))}
          aria-describedby={error("subject") ? "subject-error" : undefined}
          className={cn(inputClass(Boolean(error("subject"))), "appearance-none pr-9")}
        >
          {SUBJECTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Message"
        htmlFor="message"
        error={error("message")}
        hint="A sentence about what you need is plenty."
      >
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          aria-invalid={Boolean(error("message"))}
          aria-describedby={
            error("message") ? "message-error" : "message-hint"
          }
          className={cn(inputClass(Boolean(error("message"))), "h-auto resize-y py-2.5 leading-relaxed")}
          placeholder="How can we help?"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className="text-[11.5px] text-text-subtle">
          We reply from a real inbox, usually within two business days.
        </p>
      </div>

      <div role="status" aria-live="polite">
        {state.status === "success" && (
          <Banner tone="success" icon={CheckCircle2}>
            {state.message}
          </Banner>
        )}
        {(state.status === "error" || state.status === "unconfigured") && (
          <Banner tone={state.status === "unconfigured" ? "info" : "error"} icon={TriangleAlert}>
            {state.message}
          </Banner>
        )}
      </div>
    </form>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "h-11 w-full rounded-xl border bg-white px-3.5 text-[14px] text-ink placeholder:text-text-subtle",
    "focus:outline-none focus:ring-[3px]",
    invalid
      ? "border-[#D6455D] focus:border-[#D6455D] focus:ring-[rgba(214,69,93,0.16)]"
      : "border-[var(--brand-border)] focus:border-primary focus:ring-[rgba(49,120,251,0.16)]",
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12.5px] font-semibold tracking-[-0.01em] text-ink"
      >
        {label}
      </label>
      <div className="relative">{children}</div>
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[11px] text-text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[11.5px] font-medium text-[#C93B2B]">
          {error}
        </p>
      )}
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "success" | "error" | "info";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-relaxed",
        tone === "success" && "border-[#BFE8D2] bg-[#F1FBF5] text-[#1B6B45]",
        tone === "error" && "border-[#F4C7C1] bg-[#FDF3F2] text-[#A33122]",
        tone === "info" && "border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] text-text",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

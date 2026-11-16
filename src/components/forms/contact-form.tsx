"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Mail, TriangleAlert } from "lucide-react";
import { submitContact, type ContactState } from "@/app/contact/actions";
import { SITE } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Contact form.
 *
 * The success state is gated on `delivered`, which is only true when the mail
 * provider accepted the message. An unconfigured deployment, a provider refusal
 * and a rate limit all render as failures with a working fallback (the inbox
 * address), because showing "thanks, we'll be in touch" after a send that did not
 * happen is the single worst thing a contact form can do.
 *
 * Validation runs server-side in the action; the browser also gets `required`
 * and type hints so the ordinary case does not need a round trip to be told the
 * email field is empty.
 */

const INITIAL: ContactState = { status: "idle", message: "", delivered: false };

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
  const startedAt = React.useRef<number>(Date.now());
  const [elapsed, setElapsed] = React.useState(0);
  const [draft, setDraft] = React.useState<Record<string, string> | null>(null);

  // Time-to-fill, for the server's bot heuristic. Measured, not guessed.
  React.useEffect(() => {
    setElapsed(Date.now() - startedAt.current);
  }, []);

  const capture = () => {
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
    setElapsed(Date.now() - startedAt.current);
    setDraft(values);
  };

  // React 19 resets the form after a server action resolves. Restoring the draft
  // keeps a long message from vanishing on a delivery failure.
  React.useEffect(() => {
    if (state.delivered || !formRef.current || !draft) return;
    const form = formRef.current;
    for (const [key, value] of Object.entries(draft)) {
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (field.type !== "hidden") field.value = value;
      } else if (field instanceof HTMLSelectElement) {
        field.value = value;
      }
    }
  }, [state, draft]);

  const error = (field: keyof NonNullable<ContactState["fieldErrors"]>) =>
    state.fieldErrors?.[field];

  /* Delivered: replace the form rather than showing it again with a banner. */
  if (state.delivered) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-[14px] border border-[#BFE8D2] bg-[#F1FBF5] p-5 sm:p-6"
      >
        <CheckCircle2 className="h-6 w-6 text-[#1B6B45]" strokeWidth={2.2} aria-hidden="true" />
        <p className="mt-2.5 text-[15px] font-bold tracking-[-0.02em] text-[#145034]">
          Message received
        </p>
        <p className="mt-1 max-w-[46ch] text-[13.5px] leading-[1.6] text-[#1B6B45]">
          {state.message}
        </p>
        <p className="mt-3 text-[12px] leading-[1.55] text-[#1B6B45]/80">
          A copy of your reply goes to the email address you gave. If nothing arrives within three
          business days, write to{" "}
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="font-semibold underline underline-offset-2"
          >
            {SITE.supportEmail}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={capture}
      noValidate
      className="space-y-4"
    >
      {/* Honeypot — hidden from people, visible to naive bots */}
      <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="company_website">Company website</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="elapsed_ms" value={elapsed} readOnly />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={error("name")} required>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            aria-invalid={error("name") ? true : undefined}
            aria-describedby={error("name") ? "name-error" : undefined}
            className={inputClass(Boolean(error("name")))}
            placeholder="Your name"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={error("email")} required hint="Where the reply goes.">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={error("email") ? true : undefined}
            aria-describedby={error("email") ? "email-error" : "email-hint"}
            className={inputClass(Boolean(error("email")))}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      <Field label="Subject" htmlFor="subject" error={error("subject")} required>
        <div className="relative">
          <select
            id="subject"
            name="subject"
            defaultValue={defaultSubject ?? "support"}
            aria-invalid={error("subject") ? true : undefined}
            aria-describedby={error("subject") ? "subject-error" : undefined}
            className={cn(inputClass(Boolean(error("subject"))), "appearance-none pr-9")}
          >
            {SUBJECTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
          >
            <path
              d="M6 8l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </Field>

      <Field
        label="Message"
        htmlFor="message"
        error={error("message")}
        required
        hint="A sentence about what you need is plenty. Up to 2000 characters."
      >
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          aria-invalid={error("message") ? true : undefined}
          aria-describedby={error("message") ? "message-error" : "message-hint"}
          className={cn(inputClass(Boolean(error("message"))), "h-auto resize-y py-2.5 leading-relaxed")}
          placeholder="How can we help?"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              Send message
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
            </>
          )}
        </button>
        <p className="text-[11.5px] leading-[1.5] text-text-subtle">
          Goes to a real inbox. Usually answered within two business days.
        </p>
      </div>

      {/* Errors and unconfigured notices */}
      <div aria-live="polite" role="status">
        {state.status === "error" && state.message && (
          <Banner tone="error">
            <span className="font-semibold">{state.message}</span>
            {Object.keys(state.fieldErrors ?? {}).length === 0 && (
              <>
                {" "}
                You can also email{" "}
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="font-semibold underline underline-offset-2"
                >
                  {SITE.supportEmail}
                </a>
                .
              </>
            )}
          </Banner>
        )}

        {state.status === "unconfigured" && (
          <Banner tone="info" icon={Mail}>
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
    "transition-[border-color,box-shadow] focus:outline-none focus:ring-[3px]",
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
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-baseline gap-1 text-[12.5px] font-semibold tracking-[-0.01em] text-ink"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="text-[#C93B2B]">
            *
          </span>
        )}
        {!required && <span className="text-[11px] font-normal text-text-subtle">optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[11px] leading-[1.5] text-text-subtle">
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
  icon: Icon = TriangleAlert,
  children,
}: {
  tone: "error" | "info";
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-3 flex items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-[1.6]",
        tone === "error" && "border-[#F4C7C1] bg-[#FDF3F2] text-[#A33122]",
        tone === "info" && "border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] text-text",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

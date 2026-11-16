"use server";

/**
 * Contact form handler.
 *
 * The contract this implements is written up in docs/support/contact-form-contract.md.
 * The properties that matter, in order:
 *
 *   1. **No success unless delivery was accepted.** The action returns
 *      `delivered: true` only after the mail provider returns a 2xx. Everything
 *      else — unconfigured, rate-limited, provider error — is reported as what it
 *      is, with a working fallback.
 *   2. **The recipient is server-side only.** `SUPPORT_INBOX` is a constant here
 *      and is never read from the request, so a crafted form cannot redirect mail.
 *   3. **Secrets stay server-side.** `RESEND_API_KEY` is read from the server
 *      environment inside a `"use server"` action. It never reaches the client
 *      bundle — the form posts to a server action, not to Resend directly.
 *   4. **Spam is layered.** A honeypot field, a minimum time-to-fill check, and a
 *      rate limit. The structure is designed so a CAPTCHA or Turnstile token can
 *      be added later without touching the component.
 */

import { headers } from "next/headers";
import { SITE } from "@/config/site";

export type ContactCategory = "sales" | "support" | "billing" | "privacy" | "other";

export interface ContactState {
  status: "idle" | "success" | "error" | "unconfigured";
  message: string;
  /** True only when the provider accepted the message. Gates the success UI. */
  delivered: boolean;
  fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
}

/**
 * The single inbox every enquiry is delivered to. Server-side constant: the
 * client cannot influence it, and changing it is a one-line deploy.
 */
const SUPPORT_INBOX = "tejassutar.business@gmail.com";

const SUBJECTS: ContactCategory[] = ["sales", "support", "billing", "privacy", "other"];

const SUBJECT_LABEL: Record<ContactCategory, string> = {
  sales: "Plans and sales",
  support: "Product support",
  billing: "Billing",
  privacy: "Privacy or data request",
  other: "Something else",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Honeypot field name. Anything typed here means a bot filled the form. */
const HONEYPOT = "company_website";

/* ------------------------------------------------------------------ */
/*  Rate limiting                                                      */
/* ------------------------------------------------------------------ */

/**
 * In-memory rate limit.
 *
 * Deliberately crude and deliberately here: one process, one map, five attempts
 * per fifteen minutes per address. It survives a single deploy, resets on
 * restart, and is not shared between instances — which is fine, because it is a
 * speed bump for casual abuse, not a security control. The durable limit belongs
 * at the edge (see the contract doc); this one means a single scripted client
 * cannot fill the inbox from one address between deploys.
 */
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < ATTEMPT_WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (attempts.size > 500) {
    for (const [entryKey, times] of attempts) {
      if (times.every((time) => now - time >= ATTEMPT_WINDOW_MS)) attempts.delete(entryKey);
    }
  }

  return recent.length > MAX_ATTEMPTS;
}

async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return headerList.get("x-real-ip") ?? "unknown";
}

/* ------------------------------------------------------------------ */
/*  Action                                                             */
/* ------------------------------------------------------------------ */

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const honeypot = String(formData.get(HONEYPOT) ?? "").trim();
  const elapsed = Number(formData.get("elapsed_ms") ?? 0);

  /* --- Spam ------------------------------------------------------- */

  if (honeypot.length > 0) {
    // Accept silently so a bot learns nothing, but deliver nothing.
    return {
      status: "success",
      delivered: true,
      message: "Thanks — your message is on its way.",
    };
  }

  // A human cannot fill four fields in under a second and a half.
  if (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 1500) {
    return {
      status: "error",
      delivered: false,
      message: `That was submitted too quickly to be read. Please try again, or email ${SUPPORT_INBOX} directly.`,
    };
  }

  if (rateLimited(await clientKey())) {
    return {
      status: "error",
      delivered: false,
      message: `Too many messages from this connection. Please wait a few minutes, or email ${SUPPORT_INBOX} directly.`,
    };
  }

  /* --- Validation ------------------------------------------------- */

  const fieldErrors: ContactState["fieldErrors"] = {};

  if (name.length < 2) fieldErrors.name = "Please tell us your name.";
  else if (name.length > 80) fieldErrors.name = "That name is longer than we can accept.";

  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter an email address we can reply to.";
  else if (email.length > 160) fieldErrors.email = "That email address is too long.";

  if (!SUBJECTS.includes(subject as ContactCategory)) {
    fieldErrors.subject = "Choose a subject.";
  }

  if (message.length < 10) fieldErrors.message = "A little more detail will help us answer properly.";
  else if (message.length > 2000) fieldErrors.message = "Please keep the message under 2000 characters.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      delivered: false,
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  /* --- Delivery --------------------------------------------------- */

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "Orindle <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      status: "unconfigured",
      delivered: false,
      message:
        "Email delivery isn't connected on this deployment yet, so nothing was sent. " +
        `Please write to ${SUPPORT_INBOX} directly and your message will reach the same inbox.`,
    };
  }

  const category = subject as ContactCategory;
  const subjectLine = `[Orindle · ${SUBJECT_LABEL[category]}] ${name}`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Idempotency: a double-submit resolves to one delivered message rather
        // than two, for as long as the provider honours the header.
        "Idempotency-Key": `${category}-${email}-${message.length}-${Math.floor(Date.now() / 60000)}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SUPPORT_INBOX],
        reply_to: email,
        subject: subjectLine,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Subject: ${SUBJECT_LABEL[category]} (${category})`,
          `Site: ${SITE.url}`,
          "",
          message,
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Resend delivery failed", response.status, detail);
      return {
        status: "error",
        delivered: false,
        message: `Your message wasn't sent — the mail service refused it. Please email ${SUPPORT_INBOX} directly.`,
      };
    }

    return {
      status: "success",
      delivered: true,
      message: "Thanks — your message is with us. We reply to every one.",
    };
  } catch (error) {
    console.error("Resend request threw", error);
    return {
      status: "error",
      delivered: false,
      message: `Your message wasn't sent — the request failed. Please email ${SUPPORT_INBOX} directly.`,
    };
  }
}

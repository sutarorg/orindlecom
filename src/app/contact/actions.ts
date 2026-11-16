"use server";

/**
 * Contact form handler.
 *
 * The contract this implements is written up in docs/support/contact-form-contract.md.
 * The properties that matter, in order:
 *
 *   1. **Persist before sending.** The request is written to
 *      `public.support_requests` BEFORE any email is attempted, so a Resend
 *      outage cannot lose a customer's message. The ticket exists; only the
 *      notification failed, and the two facts are reported separately.
 *      (This was a real gap: the form used to email and write nothing.)
 *   2. **No success unless delivery was accepted.** The action returns
 *      `delivered: true` only after the mail provider returns a 2xx. Everything
 *      else — unconfigured, provider error — is reported as what it is, with the
 *      reference number so the message can still be found.
 *   3. **The recipient is server-side only.** `SUPPORT_INBOX` is a constant here
 *      and is never read from the request, so a crafted form cannot redirect mail.
 *   4. **Secrets stay server-side.** `RESEND_API_KEY` is read from the server
 *      environment inside a `"use server"` action. It never reaches the client
 *      bundle — the form posts to a server action, not to Resend directly.
 *   5. **Spam is layered.** A honeypot field, a minimum time-to-fill check, and a
 *      rate limit. The structure is designed so a CAPTCHA or Turnstile token can
 *      be added later without touching the component.
 */

import { headers } from "next/headers";
import { SITE } from "@/config/site";
import { getServiceClient, isServiceConfigured } from "@/lib/supabase/service";

export type ContactCategory = "sales" | "support" | "billing" | "privacy" | "other";

export interface ContactState {
  status: "idle" | "success" | "error" | "unconfigured";
  message: string;
  /** True only when the provider accepted the message. Gates the success UI. */
  delivered: boolean;
  /**
   * True when the request is in the database. Distinct from `delivered` on
   * purpose: a message can be safely received and not yet emailed, and telling
   * the customer which one happened is the honest thing to do.
   */
  persisted?: boolean;
  /** The ticket reference, so the customer can quote it in a direct email. */
  reference?: string;
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

  /* --- Persistence ------------------------------------------------ */

  /*
   * Write the ticket first.
   *
   * If this fails we stop: a customer told "we've got it" when the row was never
   * written is the exact lie this feature exists to remove. The error names the
   * direct address so the message is not lost for the want of a database row.
   */
  const category = subject as ContactCategory;

  if (!isServiceConfigured()) {
    return {
      status: "unconfigured",
      delivered: false,
      persisted: false,
      message:
        "Our message system isn't connected on this deployment yet, so nothing was stored. " +
        `Please write to ${SUPPORT_INBOX} directly and it will reach the same inbox.`,
    };
  }

  /**
   * A reply address for a signed-in submitter, if there is one.
   *
   * Read from the session cookie via the user-scoped client rather than trusted
   * from a form field: `submitter_id` is a foreign key to auth.users, and a
   * client-supplied id would let anyone attach their message to someone else's
   * account.
   */
  let submitterId: string | null = null;
  try {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase/server");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    submitterId = data.user?.id ?? null;
  } catch {
    // Anonymous submission is the normal case; a failed session read is not a
    // reason to refuse the message.
    submitterId = null;
  }

  let requestId: string;
  let reference: string;

  try {
    const service = getServiceClient();
    const { data: inserted, error: insertError } = await service
      .from("support_requests")
      .insert({
        submitter_email: email,
        submitter_name: name,
        submitter_id: submitterId,
        category,
        subject: `${SUBJECT_LABEL[category]} — ${name}`,
        message,
        source: "contact-form",
        // Delivery is attempted below; 'pending' is the truthful state until
        // the provider answers.
        delivery_status: "pending",
      })
      .select("id, reference")
      .single();

    if (insertError || !inserted) {
      console.error("support request insert failed", insertError?.message);
      return {
        status: "error",
        delivered: false,
        persisted: false,
        message: `We couldn't record your message. Please write to ${SUPPORT_INBOX} directly — it reaches the same inbox.`,
      };
    }

    requestId = String(inserted.id);
    reference = String(inserted.reference);
  } catch (error) {
    console.error("support request insert threw", error);
    return {
      status: "error",
      delivered: false,
      persisted: false,
      message: `We couldn't record your message. Please write to ${SUPPORT_INBOX} directly — it reaches the same inbox.`,
    };
  }

  /* --- Delivery --------------------------------------------------- */

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "Orindle <onboarding@resend.dev>";

  /*
   * Mark the notification's true state, and never let that write fail the
   * customer's request. The row already exists; the delivery columns are a
   * secondary fact about it.
   */
  async function recordDelivery(
    status: "delivered" | "failed",
    providerMessageId?: string,
    deliveryError?: string,
  ) {
    try {
      await getServiceClient()
        .from("support_requests")
        .update({
          delivery_status: status,
          provider_message_id: providerMessageId ?? null,
          delivery_error: deliveryError?.slice(0, 500) ?? null,
        })
        .eq("id", requestId);
    } catch (error) {
      console.error("support delivery state update failed", error);
    }
  }

  if (!apiKey) {
    await recordDelivery("failed", undefined, "RESEND_API_KEY is not configured");
    return {
      status: "success",
      // The ticket exists, so this is not a failure from the customer's side.
      delivered: false,
      persisted: true,
      reference,
      message:
        `Your message is saved as ${reference}. Email delivery isn't connected on this deployment, ` +
        "so we weren't notified by email — it will be answered from the queue.",
    };
  }

  const subjectLine = `[Orindle · ${SUBJECT_LABEL[category]}] ${name} (${reference})`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Idempotency: a double-submit resolves to one delivered message rather
        // than two, for as long as the provider honours the header.
        "Idempotency-Key": `${requestId}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SUPPORT_INBOX],
        reply_to: email,
        subject: subjectLine,
        text: [
          `Reference: ${reference}`,
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
      await recordDelivery("failed", undefined, `Resend ${response.status}: ${detail}`);
      return {
        status: "success",
        delivered: false,
        persisted: true,
        reference,
        message:
          `Your message is saved as ${reference}. Our mail service refused the notification, ` +
          "so it wasn't emailed — but it is in the queue and will be answered.",
      };
    }

    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    await recordDelivery("delivered", payload.id);

    return {
      status: "success",
      delivered: true,
      persisted: true,
      reference,
      message: `Thanks — your message is with us. Your reference is ${reference}. We reply to every one.`,
    };
  } catch (error) {
    console.error("Resend request threw", error);
    await recordDelivery(
      "failed",
      undefined,
      error instanceof Error ? error.message : String(error),
    );
    return {
      status: "success",
      delivered: false,
      persisted: true,
      reference,
      message:
        `Your message is saved as ${reference}. The notification email failed to send, ` +
        "but it is in the queue and will be answered.",
    };
  }
}

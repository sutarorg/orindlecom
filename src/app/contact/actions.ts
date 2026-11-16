"use server";

/**
 * Contact form handler.
 *
 * Validates on the server, rejects obvious bots, then attempts delivery through
 * Resend. Delivery is only attempted when `RESEND_API_KEY` is configured; when
 * it is not, the action says so explicitly instead of pretending the message
 * was sent. The recipient is read from configuration and is never taken from
 * the request.
 */

export interface ContactState {
  status: "idle" | "success" | "error" | "unconfigured";
  message: string;
  fieldErrors?: Partial<Record<"name" | "email" | "subject" | "message", string>>;
}

const SUPPORT_INBOX = "tejassutar.business@gmail.com";
const SUBJECTS = ["sales", "support", "billing", "privacy", "other"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const honeypot = String(formData.get("company_website") ?? "").trim();

  const fieldErrors: ContactState["fieldErrors"] = {};

  if (honeypot.length > 0) {
    // Silently accept so bots do not learn the trap, but send nothing.
    return { status: "success", message: "Thanks — your message is on its way." };
  }

  if (name.length < 2) fieldErrors.name = "Please tell us your name.";
  if (name.length > 80) fieldErrors.name = "That name is longer than we can accept.";

  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter an email address we can reply to.";
  if (email.length > 160) fieldErrors.email = "That email address is too long.";

  if (!SUBJECTS.includes(subject as (typeof SUBJECTS)[number])) {
    fieldErrors.subject = "Choose a subject.";
  }

  if (message.length < 10) fieldErrors.message = "A little more detail will help us answer properly.";
  if (message.length > 2000) fieldErrors.message = "Please keep the message under 2000 characters.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_ADDRESS ?? "Orindle <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      status: "unconfigured",
      message:
        "Email delivery is not configured on this deployment yet. Please write directly to " +
        `${SUPPORT_INBOX} and your message will reach us.`,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [SUPPORT_INBOX],
        reply_to: email,
        subject: `[Orindle ${subject}] Message from ${name}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Subject: ${subject}`,
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
        message: `We could not send that just now. Please email ${SUPPORT_INBOX} directly.`,
      };
    }

    return {
      status: "success",
      message: "Thanks — your message is with us. We reply to every one.",
    };
  } catch (error) {
    console.error("Resend request threw", error);
    return {
      status: "error",
      message: `The send failed. Please email ${SUPPORT_INBOX} directly.`,
    };
  }
}

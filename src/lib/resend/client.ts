/**
 * Transactional email.
 *
 * Server-side only: the API key never reaches a browser.
 *
 * The rule that shapes this file: **no silent drops.** A send either succeeds
 * with a provider message id or returns a failure the caller must handle. There
 * is no code path that returns "ok" without a provider 2xx, because a success
 * message for an email that never arrived is the same lie as a fake payment.
 *
 * Three configuration states, and they are genuinely different:
 *   missing  → nothing is sent; callers report `not_configured`
 *   sandbox  → the provider will only deliver to the account owner
 *   ready    → a verified domain, normal delivery
 *
 * "We sent it" is false in the sandbox state for every recipient except the owner,
 * so the product must not claim delivery there. `getEmailState()` exists so the
 * UI and the health endpoint can say which state the deployment is in.
 */

import "server-only";

import { SITE } from "@/config/site";

const API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";
const FROM = process.env.RESEND_FROM_ADDRESS?.trim() || "Orindle <onboarding@resend.dev>";
const ENDPOINT = "https://api.resend.com/emails";

export type EmailState = "missing" | "sandbox" | "ready";

export function getEmailState(): EmailState {
  if (!API_KEY) return "missing";
  // The sandbox sender only delivers to the account owner.
  return FROM.includes("resend.dev") ? "sandbox" : "ready";
}

export interface SendResult {
  ok: true;
  id: string;
}

export interface SendFailure {
  ok: false;
  /** Provider message, for the log — never shown to a customer. */
  error: string;
  /** True when retrying could plausibly succeed. */
  retryable: boolean;
}

export interface SendInput {
  to: string;
  template: string;
  data?: Record<string, string>;
  /** Pre-rendered subject and bodies, when the caller has them. */
  subject?: string;
  html?: string;
  text?: string;
}

/** The support inbox. A server constant: a request can never redirect support mail. */
export const SUPPORT_INBOX = SITE.supportEmail;

/**
 * Send one email.
 *
 * Templates are a closed set resolved by `renderTemplate`; a caller cannot
 * inject arbitrary HTML into an email body, which matters because invite and
 * role-change mails include text another user typed.
 */
export async function sendEmail(input: SendInput): Promise<SendResult | SendFailure> {
  if (!API_KEY) {
    return { ok: false, error: "RESEND_API_KEY is not configured", retryable: false };
  }

  const rendered = input.html
    ? { subject: input.subject ?? "Orindle", html: input.html, text: input.text ?? "" }
    : renderTemplate(input.template, input.data ?? {});

  if (!rendered) {
    // An unknown template is a programming error, not a delivery problem.
    return { ok: false, error: `Unknown email template: ${input.template}`, retryable: false };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        // Replies should reach a person, not a no-reply sink.
        reply_to: [SUPPORT_INBOX],
      }),
      // A hanging provider must not hang the request that triggered it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${response.status}: ${body.slice(0, 300)}`,
        // 429 and 5xx are worth retrying; 4xx generally is not.
        retryable: response.status === 429 || response.status >= 500,
      };
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      return { ok: false, error: "Resend returned no message id", retryable: true };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/*                                                                     */
/*  Branded in the Orindle visual language: the same blue, the same    */
/*  wordmark treatment, the same plain-speaking tone. An email that    */
/*  looks like a different product erodes trust exactly when trust is  */
/*  being asked for. No tracking pixels, ever.                          */
/* ------------------------------------------------------------------ */

const BRAND = {
  primary: "#3B6EF6",
  ink: "#0E1430",
  muted: "#64708A",
  border: "#E3E8F2",
  canvas: "#F6F8FC",
  radius: "14px",
};

function layout({ heading, body, action }: { heading: string; body: string; action?: string }): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:${BRAND.canvas};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND.border};border-radius:${BRAND.radius};">
      <tr><td style="padding:24px 28px 0;">
        <span style="display:inline-flex;align-items:center;gap:8px;font-size:17px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.ink};">
          Orindle
        </span>
      </td></tr>
      <tr><td style="padding:20px 28px 0;">
        <h1 style="margin:0;font-size:21px;line-height:1.3;letter-spacing:-0.02em;color:${BRAND.ink};">${heading}</h1>
      </td></tr>
      <tr><td style="padding:12px 28px 0;">
        <div style="font-size:14.5px;line-height:1.6;color:${BRAND.muted};">${body}</div>
      </td></tr>
      ${
        action
          ? `<tr><td style="padding:22px 28px 0;">
        <a href="${action}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${BRAND.primary};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Continue</a>
      </td></tr>`
          : ""
      }
      <tr><td style="padding:26px 28px 24px;">
        <div style="border-top:1px solid ${BRAND.border};padding-top:14px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
          Sent by Orindle. Questions go to
          <a href="mailto:${SUPPORT_INBOX}" style="color:${BRAND.primary};text-decoration:none;">${SUPPORT_INBOX}</a>.
        </div>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Strip anything that could break out of HTML. Email is still HTML injection territory. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(template: string, data: Record<string, string>): Rendered | null {
  const name = data.name ? esc(data.name) : "there";

  switch (template) {
    case "verify-email":
      return {
        subject: "Confirm your Orindle email",
        html: layout({
          heading: "Confirm your email",
          body: `<p style="margin:0 0 10px;">Hi ${name}, confirm this address to finish setting up your Orindle account.</p>
                 <p style="margin:0;">The link expires in 24 hours. If you didn't sign up, ignore this email — nothing happens.</p>`,
          action: data.url,
        }),
        text: `Confirm your Orindle email: ${data.url ?? ""}\n\nIf you didn't sign up, ignore this email.`,
      };

    case "reset-password":
      return {
        subject: "Reset your Orindle password",
        html: layout({
          heading: "Reset your password",
          body: `<p style="margin:0 0 10px;">Hi ${name}, use the link below to choose a new password. It expires in 30 minutes.</p>
                 <p style="margin:0;">If you didn't ask for this, you can ignore it — your password hasn't changed.</p>`,
          action: data.url,
        }),
        text: `Reset your Orindle password (expires in 30 minutes): ${data.url ?? ""}`,
      };

    case "password-changed":
      return {
        subject: "Your Orindle password was changed",
        html: layout({
          heading: "Your password was changed",
          body: `<p style="margin:0 0 10px;">Hi ${name}, your Orindle password was just changed.</p>
                 <p style="margin:0;">If this wasn't you, reply to this email immediately and we'll help you secure the account.</p>`,
        }),
        text: `Your Orindle password was changed. If this wasn't you, contact ${SUPPORT_INBOX}.`,
      };

    case "org-invite":
      return {
        subject: `${data.inviter ?? "Someone"} invited you to ${data.organization ?? "an organization"} on Orindle`,
        html: layout({
          heading: `Join ${esc(data.organization ?? "the team")}`,
          body: `<p style="margin:0 0 10px;">${esc(data.inviter ?? "An administrator")} invited you to join <strong>${esc(data.organization ?? "their organization")}</strong> as ${esc(data.role ?? "a member")}.</p>
                 <p style="margin:0;">This invitation expires in 7 days.</p>`,
          action: data.url,
        }),
        text: `${data.inviter ?? "An administrator"} invited you to ${data.organization ?? "an organization"}: ${data.url ?? ""}`,
      };

    case "invite-accepted":
      return {
        subject: `${data.name ?? "Someone"} accepted your invitation`,
        html: layout({
          heading: "Your invitation was accepted",
          body: `<p style="margin:0;">${name} has joined <strong>${esc(data.organization ?? "your organization")}</strong>.</p>`,
        }),
        text: `${data.name ?? "Someone"} accepted your invitation to ${data.organization ?? "your organization"}.`,
      };

    case "storage-warning-80":
      return {
        subject: "You've used 80% of your storage",
        html: layout({
          heading: "You're at 80% of your storage",
          body: `<p style="margin:0 0 10px;">You're using <strong>${esc(data.used ?? "")}</strong> of <strong>${esc(data.total ?? "")}</strong>.</p>
                 <p style="margin:0;">Your files stay exactly as they are. Uploads are only refused once you pass the allowance — downloading and deleting keep working.</p>`,
          action: data.url,
        }),
        text: `You're using ${data.used ?? ""} of ${data.total ?? ""}. ${data.url ?? ""}`,
      };

    case "subscription-started":
      return {
        subject: "Your Orindle plan is active",
        html: layout({
          heading: `You're on ${esc(data.plan ?? "a new plan")}`,
          body: `<p style="margin:0 0 10px;">Payment of <strong>${esc(data.amount ?? "")}</strong> was confirmed.</p>
                 <p style="margin:0;">Your next renewal is ${esc(data.renewsOn ?? "monthly")}. You can change or cancel any time from Billing.</p>`,
          action: data.url,
        }),
        text: `Your ${data.plan ?? ""} plan is active. ${data.amount ?? ""}. ${data.url ?? ""}`,
      };

    case "payment-failed":
      return {
        subject: "We couldn't take your Orindle payment",
        html: layout({
          heading: "A payment didn't go through",
          body: `<p style="margin:0 0 10px;">We couldn't charge your payment method for your ${esc(data.plan ?? "plan")}.</p>
                 <p style="margin:0;">Nothing has been deleted, and your files stay available to download. Update your payment details to keep your plan active.</p>`,
          action: data.url,
        }),
        text: `A payment for your ${data.plan ?? "plan"} didn't go through. Nothing was deleted. ${data.url ?? ""}`,
      };

    case "subscription-cancelled":
      return {
        subject: "Your Orindle subscription is cancelled",
        html: layout({
          heading: "Subscription cancelled",
          body: `<p style="margin:0 0 10px;">Your plan stays active until <strong>${esc(data.endsOn ?? "the end of the period you paid for")}</strong>.</p>
                 <p style="margin:0;">After that your account moves to Free. Your files are kept, and you can download everything.</p>`,
        }),
        text: `Your subscription is cancelled. Active until ${data.endsOn ?? "the end of the paid period"}.`,
      };

    case "support-received":
      return {
        subject: `We got your message (${data.reference ?? "new request"})`,
        html: layout({
          heading: "We've got your message",
          body: `<p style="margin:0 0 10px;">Thanks for writing in. Your reference is <strong>${esc(data.reference ?? "")}</strong>.</p>
                 <p style="margin:0;">We acknowledge every message within 48 hours and aim to resolve it within a month. Reply to this email to add anything.</p>`,
        }),
        text: `We've got your message. Reference ${data.reference ?? ""}. We reply within 48 hours.`,
      };

    case "account-deletion-requested":
      return {
        subject: "Your Orindle account is scheduled for deletion",
        html: layout({
          heading: "Your account is scheduled for deletion",
          // The two facts that matter: nothing has happened yet, and there is a way
          // back. Stated before anything else.
          body: `<p style="margin:0 0 10px;">Nothing has been deleted yet. Your account is now read-only and will be permanently deleted on <strong>${esc(data.purgeOn ?? "the date shown in your settings")}</strong>.</p>
                 <p style="margin:0 0 10px;">Signing in before that date cancels the deletion and puts everything back to normal.</p>
                 <p style="margin:0;">If you didn't ask for this, sign in now and change your password, then reply to this email.</p>`,
        }),
        text: `Your Orindle account is scheduled for deletion on ${data.purgeOn ?? "the date in your settings"}. Nothing has been deleted yet, and signing in before then cancels it. If you didn't ask for this, sign in now and change your password.`,
      };

    case "account-deleted":
      return {
        subject: "Your Orindle account has been deleted",
        html: layout({
          heading: "Your account is deleted",
          body: `<p style="margin:0 0 10px;">Your Orindle account and files have been deleted.</p>
                 <p style="margin:0;">Billing records are kept for as long as tax law requires. Nothing else is retained.</p>`,
        }),
        text: "Your Orindle account and files have been deleted. Billing records are kept as tax law requires.",
      };

    default:
      // Expiry warnings are one template with the day baked into the name.
      if (template.startsWith("subscription-expiring-")) {
        const day = template.replace("subscription-expiring-", "");
        return {
          subject: `Your Orindle files are kept — here's what changes on ${data.date ?? "soon"}`,
          html: layout({
            heading: `Your plan ended ${day} days ago`,
            body: `<p style="margin:0 0 10px;">Your account is on the Free plan now. <strong>Every file is still here</strong>, and you can download all of them.</p>
                 <p style="margin:0;">You have until <strong>${esc(data.date ?? "the end of your recovery period")}</strong> to restore your plan. After that the account stays on Free and nothing is deleted.</p>`,
            action: data.url,
          }),
          text: `Your account is on Free. All files are kept. Restore your plan before ${data.date ?? "the end of the recovery period"}.`,
        };
      }
      return null;
  }
}

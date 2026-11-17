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
 */

import "server-only";

import { SITE } from "@/config/site";

const API_KEY = process.env.RESEND_API_KEY?.trim() ?? "";
const FROM = process.env.RESEND_FROM_ADDRESS?.trim() || "Orindle <onboarding@resend.dev>";
const ENDPOINT = "https://api.resend.com/emails";

export type EmailState = "missing" | "sandbox" | "ready";

export function getEmailState(): EmailState {
  if (!API_KEY) return "missing";
  return FROM.includes("resend.dev") ? "sandbox" : "ready";
}

export const EMAIL_TEMPLATES = [
  "welcome",
  "verify-email",
  "reset-password",
  "password-changed",
  "email-changed",
  "org-invite",
  "invite-accepted",
  "role-changed",
  "member-removed",
  "storage-warning-80",
  "storage-full",
  "subscription-started",
  "payment-receipt",
  "payment-failed",
  "subscription-cancelled",
  "subscription-expiring",
  "subscription-expired",
  "account-deletion-requested",
  "account-deleted",
  "data-export-ready",
  "support-received",
  "support-reply",
  // Sharing to an address with no account. Distinct from `org-invite`, which adds
  // somebody to a workspace — this grants access to one file or folder.
  "share-invite",
] as const;

export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[number] | `subscription-expiring-${number}`;

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
 * inject arbitrary HTML into an email body, which matters because invite,
 * role-change and support mails include text another user typed.
 */
export async function sendEmail(input: SendInput): Promise<SendResult | SendFailure> {
  if (!API_KEY) {
    return { ok: false, error: "RESEND_API_KEY is not configured", retryable: false };
  }

  const rendered = input.html
    ? { subject: input.subject ?? "Orindle", html: input.html, text: input.text ?? "" }
    : renderTemplate(input.template, input.data ?? {});

  if (!rendered) {
    return { ok: false, error: `Unknown email template: ${input.template}`, retryable: false };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      /*
       * No `reply_to`.
       *
       * It used to be set to `SUPPORT_INBOX`, which is a *gmail* address while
       * `from` is `onboarding@resend.dev`. Resend rejects a message whose `reply_to`
       * domain is not verified on the account, so every share invitation came back
       * 4xx and was reported to the owner as "email isn't configured". The header
       * bought nothing — a recipient of a share link does not need to reply to it —
       * and its cost was the entire invite flow. The support address stays in the
       * footer, where it is text rather than a deliverability requirement.
       */
      body: JSON.stringify({
        from: FROM,
        to: [input.to],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: describeFailure(response.status, body),
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

/**
 * Turn a provider error into something an operator can act on.
 *
 * The raw body is kept whole (truncated) because Resend's `message` field is the only
 * place the actual reason appears — "domain is not verified", "invalid `to` field",
 * "you can only send testing emails to your own address". The previous code kept it
 * too, but nothing surfaced it: every failure reached the customer as the same
 * sentence about configuration, so the one piece of information that would have
 * fixed this in a minute never left the server.
 */
function describeFailure(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(detail) as { message?: string; name?: string };
    if (parsed?.message) detail = parsed.name ? `${parsed.name}: ${parsed.message}` : parsed.message;
  } catch {
    // Not JSON — keep the text as-is.
  }
  return `Resend ${status}: ${detail.slice(0, 400)}`;
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/*                                                                     */
/*  Branded in the Orindle visual language. Every template produces    */
/*  both escaped HTML and a plain-text alternative. No tracking        */
/*  pixels, ever.                                                      */
/* ------------------------------------------------------------------ */

const BRAND = {
  primary: "#3B6EF6",
  ink: "#0E1430",
  muted: "#64708A",
  border: "#E3E8F2",
  canvas: "#F6F8FC",
  radius: "14px",
};

function layout({
  heading,
  body,
  action,
  actionLabel = "Continue",
}: {
  heading: string;
  body: string;
  action?: string;
  actionLabel?: string;
}): string {
  const safeAction = action ? esc(action) : "";
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
        safeAction
          ? `<tr><td style="padding:22px 28px 0;">
        <a href="${safeAction}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${BRAND.primary};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">${esc(actionLabel)}</a>
      </td></tr>`
          : ""
      }
      <tr><td style="padding:26px 28px 24px;">
        <div style="border-top:1px solid ${BRAND.border};padding-top:14px;font-size:12px;line-height:1.6;color:${BRAND.muted};">
          Sent by Orindle (orindle.com). Questions go to
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderTemplate(template: string, data: Record<string, string>): RenderedEmail | null {
  const name = data.name ? esc(data.name) : "there";
  const rawName = data.name || "there";

  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to Orindle — your 10 GB is ready",
        html: layout({
          heading: "Welcome to Orindle",
          body: `<p style="margin:0 0 10px;">Hi ${name}, your Orindle account is confirmed and ready to use.</p>
                 <p style="margin:0 0 10px;">You start with <strong>10 GB of free cloud storage</strong> — no credit card required, no per-file upload cap beyond your storage allowance, and 30-day Trash recovery.</p>
                 <p style="margin:0;">Upload your first files, share folders with colleagues, or turn on two-factor authentication any time from Settings.</p>`,
          action: data.url ?? `${SITE.url}/dashboard`,
          actionLabel: "Open your dashboard",
        }),
        text: `Hi ${rawName}, welcome to Orindle. Your account is confirmed with 10 GB of free storage. Open your dashboard: ${data.url ?? `${SITE.url}/dashboard`}`,
      };

    case "share-invite":
      /*
       * A file somebody shared with an address that has no account yet.
       *
       * The recipient is told three things and nothing more: who shared it, what it
       * is called, and that opening the link is what grants access. The item name is
       * escaped because it is user-supplied text appearing in an email — the same
       * reason invite and support mails are templated rather than assembled.
       */
      return {
        subject: `${rawName === "there" ? "Someone" : rawName} shared “${data.itemName ?? "a file"}” with you`,
        html: layout({
          heading: `${name === "there" ? "Somebody" : name} shared something with you`,
          body: `<p style="margin:0 0 10px;">${esc(data.ownerName ?? "An Orindle user")} shared <strong>${esc(
            data.itemName ?? "a file",
          )}</strong> with you on Orindle, with permission to ${esc(
            data.permissionLabel ?? "view it",
          )}.</p>
                 <p style="margin:0 0 10px;">You don't need an account to open it. The link expires in ${esc(
                   data.expiresLabel ?? "14 days",
                 )}.</p>
                 <p style="margin:0;">If you weren't expecting this, you can ignore the email — access is only granted to whoever opens the link.</p>`,
          action: data.url,
          actionLabel: "Open it",
        }),
        text: `${rawName === "there" ? "Somebody" : rawName} shared “${data.itemName ?? "a file"}” with you on Orindle (${data.permissionLabel ?? "view"}). Open it: ${data.url ?? ""}`,
      };

    case "verify-email":
      return {
        subject: "Confirm your Orindle email",
        html: layout({
          heading: "Confirm your email",
          body: `<p style="margin:0 0 10px;">Hi ${name}, confirm this address to finish setting up your Orindle account.</p>
                 <p style="margin:0;">The link expires in 24 hours. If you didn't sign up, ignore this email — nothing happens.</p>`,
          action: data.url,
          actionLabel: "Confirm email",
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
          actionLabel: "Reset password",
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

    case "email-changed":
      return {
        subject: "Your Orindle email address change",
        html: layout({
          heading: "Your email address is changing",
          body: `<p style="margin:0 0 10px;">Hi ${name}, a request was made to change the email on your Orindle account${data.oldEmail ? ` from <strong>${esc(data.oldEmail)}</strong>` : ""}${data.newEmail ? ` to <strong>${esc(data.newEmail)}</strong>` : ""}.</p>
                 <p style="margin:0;">If you made this change, confirm the link sent to the new address. If you didn't request this, sign in immediately, change your password, and reply to this email.</p>`,
        }),
        text: `Hi ${rawName}, a request was made to change your Orindle email${data.oldEmail ? ` from ${data.oldEmail}` : ""}${data.newEmail ? ` to ${data.newEmail}` : ""}. If this wasn't you, secure your account immediately and contact ${SUPPORT_INBOX}.`,
      };

    case "org-invite":
      return {
        subject: `${data.inviter ?? "Someone"} invited you to ${data.organization ?? "an organization"} on Orindle`,
        html: layout({
          heading: `Join ${esc(data.organization ?? "the team")}`,
          body: `<p style="margin:0 0 10px;">${esc(data.inviter ?? "An administrator")} invited you to join <strong>${esc(data.organization ?? "their organization")}</strong> as <strong>${esc(data.role ?? "a member")}</strong>.</p>
                 <p style="margin:0;">This invitation expires in 7 days.</p>`,
          action: data.url,
          actionLabel: "Accept invitation",
        }),
        text: `${data.inviter ?? "An administrator"} invited you to join ${data.organization ?? "an organization"} as ${data.role ?? "a member"}: ${data.url ?? ""}\n\nThis invitation expires in 7 days.`,
      };

    case "invite-accepted":
      return {
        subject: `${data.name ?? "Someone"} accepted your invitation`,
        html: layout({
          heading: "Your invitation was accepted",
          body: `<p style="margin:0;">${name} has joined <strong>${esc(data.organization ?? "your organization")}</strong>.</p>`,
        }),
        text: `${rawName} accepted your invitation to ${data.organization ?? "your organization"}.`,
      };

    case "role-changed":
      return {
        subject: `Your role in ${data.organization ?? "your organization"} was updated`,
        html: layout({
          heading: "Your organization role changed",
          body: `<p style="margin:0 0 10px;">Hi ${name}, ${esc(data.actor ?? "an administrator")} changed your role in <strong>${esc(data.organization ?? "your organization")}</strong>${data.previousRole && data.newRole ? ` from <strong>${esc(data.previousRole)}</strong> to <strong>${esc(data.newRole)}</strong>` : data.newRole ? ` to <strong>${esc(data.newRole)}</strong>` : ""}.</p>
                 <p style="margin:0;">The change takes effect immediately on your next action.</p>`,
          action: data.url ?? `${SITE.url}/business`,
          actionLabel: "Open workspace",
        }),
        text: `Hi ${rawName}, ${data.actor ?? "an administrator"} changed your role in ${data.organization ?? "your organization"}${data.previousRole && data.newRole ? ` from ${data.previousRole} to ${data.newRole}` : data.newRole ? ` to ${data.newRole}` : ""}.`,
      };

    case "member-removed":
      return {
        subject: `You were removed from ${data.organization ?? "an organization"} on Orindle`,
        html: layout({
          heading: "Your organization access ended",
          body: `<p style="margin:0 0 10px;">Hi ${name}, your access to <strong>${esc(data.organization ?? "the organization")}</strong> and its shared folders has been removed.</p>
                 <p style="margin:0;">Your personal Orindle account and personal files are completely untouched.</p>`,
        }),
        text: `Hi ${rawName}, your access to ${data.organization ?? "the organization"} and its shared folders has ended. Your personal Orindle account and personal files remain untouched.`,
      };

    case "storage-warning-80":
      return {
        subject: "You've used 80% of your Orindle storage",
        html: layout({
          heading: "You're at 80% of your storage",
          body: `<p style="margin:0 0 10px;">You're using <strong>${esc(data.used ?? "")}</strong> of <strong>${esc(data.total ?? "")}</strong>.</p>
                 <p style="margin:0;">Your files stay exactly as they are. Uploads are only paused once you reach 100% — downloading and deleting always keep working.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/storage`,
          actionLabel: "Manage storage",
        }),
        text: `You're using ${data.used ?? ""} of ${data.total ?? ""} on Orindle. ${data.url ?? `${SITE.url}/dashboard/storage`}`,
      };

    case "storage-full":
      return {
        subject: "Your Orindle storage is full",
        html: layout({
          heading: "Your storage is full",
          body: `<p style="margin:0 0 10px;">You've reached 100% of your storage allowance (<strong>${esc(data.used ?? "")}</strong> of <strong>${esc(data.total ?? "")}</strong>).</p>
                 <p style="margin:0 0 10px;">New uploads are paused until you free space or upgrade your plan. Nothing has been deleted — you can still preview, download, and delete files or empty Trash at any time.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "Upgrade or manage storage",
        }),
        text: `Your Orindle storage is full (${data.used ?? ""} of ${data.total ?? ""}). New uploads are paused; downloading and deleting still work. ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "support-reply": {
      const paragraphs = (data.body ?? "")
        .split(/\r?\n/)
        .map((line) => esc(line))
        .join("<br>");

      return {
        subject: `Re: ${esc(data.subject ?? "Your Orindle message")} [${esc(data.reference ?? "")}]`,
        html: layout({
          heading: "A reply from Orindle",
          body: `<p style="margin:0 0 12px;">Hi ${name},</p>
                 <p style="margin:0 0 12px;">${paragraphs}</p>
                 <p style="margin:0;">Reply to this email and it reaches the same inbox. Your reference is <strong>${esc(data.reference ?? "")}</strong>.</p>`,
        }),
        text: [
          `Hi ${rawName},`,
          "",
          data.body ?? "",
          "",
          `Reference: ${data.reference ?? ""}`,
          "Reply to this email and it reaches the same inbox.",
        ].join("\n"),
      };
    }

    case "subscription-started":
      return {
        subject: "Your Orindle plan is active",
        html: layout({
          heading: `You're on ${esc(data.plan ?? "a new plan")}`,
          body: `<p style="margin:0 0 10px;">Payment of <strong>${esc(data.amount ?? "")}</strong> was confirmed.</p>
                 <p style="margin:0;">Your next renewal is <strong>${esc(data.renewsOn ?? "at the end of your billing period")}</strong>. You can view receipts, change plans, or cancel any time from Billing.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "View billing",
        }),
        text: `Your ${data.plan ?? ""} plan is active. Payment confirmed: ${data.amount ?? ""}. Next renewal: ${data.renewsOn ?? "at period end"}. ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "payment-receipt":
      return {
        subject: `Payment receipt — ${data.amount ?? "Orindle"}`,
        html: layout({
          heading: "Payment receipt",
          body: `<p style="margin:0 0 10px;">Hi ${name}, we received your payment for Orindle.</p>
                 <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border:1px solid ${BRAND.border};border-radius:10px;">
                   <tr><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};">Plan</td><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;font-weight:700;color:${BRAND.ink};text-align:right;">${esc(data.plan ?? "Orindle")} (${esc(data.period ?? "monthly")})</td></tr>
                   <tr><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};">Amount paid</td><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;font-weight:700;color:${BRAND.ink};text-align:right;">${esc(data.amount ?? "")}${data.currency ? ` ${esc(data.currency)}` : ""}</td></tr>
                   <tr><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.muted};">Payment reference</td><td style="padding:10px 14px;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.ink};text-align:right;">${esc(data.paymentId ?? "—")}</td></tr>
                   <tr><td style="padding:10px 14px;font-size:13px;color:${BRAND.muted};">Date</td><td style="padding:10px 14px;font-size:13px;color:${BRAND.ink};text-align:right;">${esc(data.paidAt ?? "")}</td></tr>
                 </table>
                 <p style="margin:0;font-size:12.5px;">GST / downloadable tax invoices are not currently enabled. Keep this receipt for your records.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "View payment history",
        }),
        text: `Payment receipt from Orindle\nPlan: ${data.plan ?? "Orindle"} (${data.period ?? "monthly"})\nAmount paid: ${data.amount ?? ""} ${data.currency ?? ""}\nPayment reference: ${data.paymentId ?? "—"}\nDate: ${data.paidAt ?? ""}\n\nView billing: ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "payment-failed":
      return {
        subject: "We couldn't take your Orindle payment",
        html: layout({
          heading: "A payment didn't go through",
          body: `<p style="margin:0 0 10px;">We couldn't charge your payment method for your ${esc(data.plan ?? "plan")}.</p>
                 <p style="margin:0;">Nothing has been deleted, and your files stay available to download. Update your payment details in Billing to keep your plan active.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "Open billing",
        }),
        text: `A payment for your ${data.plan ?? "plan"} didn't go through. Nothing was deleted. ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "subscription-cancelled":
      return {
        subject: "Your Orindle subscription is cancelled",
        html: layout({
          heading: "Subscription cancelled",
          body: `<p style="margin:0 0 10px;">Your plan stays active until <strong>${esc(data.endsOn ?? "the end of the period you paid for")}</strong>.</p>
                 <p style="margin:0;">After that your account moves to Free (10 GB). Your files are kept, and you can download everything.</p>`,
        }),
        text: `Your subscription is cancelled. Active until ${data.endsOn ?? "the end of the paid period"}. After that your account moves to Free and your files stay kept.`,
      };

    case "subscription-expiring":
      return {
        subject: `Your Orindle files are kept — recovery window ends on ${data.date ?? "soon"}`,
        html: layout({
          heading: "Your paid plan has ended",
          body: `<p style="margin:0 0 10px;">Your account is on the Free plan now. <strong>Every file is still here</strong>, and you can download all of them.</p>
                 <p style="margin:0;">You have until <strong>${esc(data.date ?? "the end of your recovery period")}</strong> to restore your plan. Even after that date, nothing is deleted.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "Restore plan",
        }),
        text: `Your Orindle account is on Free. All files are kept. Restore your plan before ${data.date ?? "the end of your recovery period"}: ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "subscription-expired":
      return {
        subject: "Your Orindle account is now on the Free plan",
        html: layout({
          heading: "Your recovery window has ended",
          body: `<p style="margin:0 0 10px;">Hi ${name}, your recovery window has finished and your account is now on the <strong>Free (10 GB)</strong> plan.</p>
                 <p style="margin:0 0 10px;"><strong>No files have been deleted.</strong> Everything you stored remains downloadable. If your usage is above 10 GB, new uploads pause until you free space or upgrade again.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/billing`,
          actionLabel: "View plans",
        }),
        text: `Hi ${rawName}, your recovery window has ended and your account is now on the Free (10 GB) plan. No files were deleted; everything remains downloadable. Upgrade any time: ${data.url ?? `${SITE.url}/dashboard/billing`}`,
      };

    case "support-received":
      return {
        subject: `We got your message (${data.reference ?? "new request"})`,
        html: layout({
          heading: "We've got your message",
          body: `<p style="margin:0 0 10px;">Thanks for writing in. Your reference is <strong>${esc(data.reference ?? "")}</strong>.</p>
                 <p style="margin:0;">We acknowledge every message within 48 hours and aim to resolve it within one month. Reply to this email to add anything.</p>`,
        }),
        text: `We've got your message. Reference ${data.reference ?? ""}. We acknowledge within 48 hours and resolve within one month.`,
      };

    case "account-deletion-requested":
      return {
        subject: "Your Orindle account is scheduled for deletion",
        html: layout({
          heading: "Your account is scheduled for deletion",
          body: `<p style="margin:0 0 10px;">Nothing has been deleted yet. You have been signed out on every device, and your account and files will be permanently deleted on <strong>${esc(data.purgeOn ?? "the date shown in your settings")}</strong> (after the 7-day grace period).</p>
                 <p style="margin:0 0 10px;">Until then your account still works normally — it is not read-only. Signing in before that date cancels the deletion automatically and puts everything back to normal.</p>
                 <p style="margin:0;">If you didn't ask for this, sign in now and change your password, then reply to this email.</p>`,
        }),
        text: `Your Orindle account is scheduled for deletion on ${data.purgeOn ?? "the date in your settings"} (7-day grace period). Nothing has been deleted yet and you have been signed out everywhere. Signing in before then cancels it.`,
      };

    case "account-deleted":
      return {
        subject: "Your Orindle account has been deleted",
        html: layout({
          heading: "Your account is deleted",
          body: `<p style="margin:0 0 10px;">Your Orindle account and files have been permanently deleted.</p>
                 <p style="margin:0;">Billing records are kept only for as long as accounting and tax law requires. Nothing else is retained.</p>`,
        }),
        text: "Your Orindle account and files have been permanently deleted. Billing records are kept only as accounting and tax law requires.",
      };

    case "data-export-ready":
      return {
        subject: "Your Orindle data export is ready",
        html: layout({
          heading: "Your data export is ready",
          body: `<p style="margin:0 0 10px;">Hi ${name}, your Orindle account data export has been generated.</p>
                 <p style="margin:0;">${data.expiresAt ? `This link is available until <strong>${esc(data.expiresAt)}</strong>.` : "You can download a fresh copy any time from Dashboard → Settings."} If you didn't request this export, change your password right away.</p>`,
          action: data.url ?? `${SITE.url}/dashboard/settings`,
          actionLabel: "Download export",
        }),
        text: `Hi ${rawName}, your Orindle data export is ready.${data.expiresAt ? ` Expires: ${data.expiresAt}.` : ""} Download: ${data.url ?? `${SITE.url}/dashboard/settings`}`,
      };

    default:
      if (template.startsWith("subscription-expiring-")) {
        const day = template.replace("subscription-expiring-", "");
        return {
          subject: `Your Orindle files are kept — here's what changes on ${data.date ?? "soon"}`,
          html: layout({
            heading: `Your plan ended ${esc(day)} days ago`,
            body: `<p style="margin:0 0 10px;">Your account is on the Free plan now. <strong>Every file is still here</strong>, and you can download all of them.</p>
                 <p style="margin:0;">You have until <strong>${esc(data.date ?? "the end of your recovery period")}</strong> to restore your plan. After that the account stays on Free and nothing is deleted.</p>`,
            action: data.url ?? `${SITE.url}/dashboard/billing`,
            actionLabel: "Restore plan",
          }),
          text: `Your account is on Free. All files are kept. Restore your plan before ${data.date ?? "the end of the recovery period"}: ${data.url ?? `${SITE.url}/dashboard/billing`}`,
        };
      }
      return null;
  }
}

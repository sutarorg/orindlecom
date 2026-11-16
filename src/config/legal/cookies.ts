import type { LegalDocument } from "./types";

/**
 * Cookie Policy — approved and published.
 *
 * The site sets no advertising or analytics cookies; only strictly necessary
 * auth/anti-abuse cookies and explicit user interface preferences are stored.
 */
export const COOKIE_POLICY: LegalDocument = {
  id: "cookies",
  path: "/cookies",
  title: "Cookie Policy",
  summary:
    "The site sets almost nothing. Here is everything Orindle stores on your device, why, and how to clear it.",
  purpose: "Storage on your device.",
  updated: "2026-11-16",
  approved: true,
  sections: [
    {
      id: "what",
      heading: "What a cookie is, and what Orindle uses",
      blocks: [
        {
          type: "p",
          text: "A cookie is a small file a website stores in your browser. Orindle uses cookies for three narrow purposes: keeping you signed in, preventing automated sign-up abuse on the free plan, and remembering the currency you chose on the pricing page. If you have never signed in, no cookie identifies you.",
        },
        {
          type: "p",
          text: "Orindle also uses two local-storage keys to remember interface preferences: whether the dashboard sidebar is collapsed, and whether your files are displayed as a grid or a list. Neither leaves your browser.",
        },
      ],
    },
    {
      id: "list",
      heading: "The complete list",
      gist: "Five entries, all strictly necessary or chosen by you.",
      blocks: [
        {
          type: "table",
          caption: "Everything Orindle stores on your device",
          head: ["Name", "Type", "Purpose", "Lifetime", "Consent needed?"],
          rows: [
            [
              "Session token (sb-*)",
              "Cookie, httpOnly, secure",
              "Keeps you signed in via Supabase authentication. Without it you would have to sign in on every page.",
              "Session, or until sign-out",
              "No — strictly necessary",
            ],
            [
              "orindle_currency",
              "Cookie, sameSite=lax",
              "Remembers the display currency you selected on the pricing page.",
              "1 year, or until you clear it",
              "No — user-requested preference",
            ],
            [
              "orindle:sidebar",
              "Local storage",
              "Remembers whether you collapsed the dashboard sidebar.",
              "Until you clear it",
              "No — user-requested preference",
            ],
            [
              "orindle:view",
              "Local storage",
              "Remembers whether your files are shown as a grid or a list.",
              "Until you clear it",
              "No — user-requested preference",
            ],
            [
              "orindle_did",
              "Cookie, httpOnly, secure",
              "A random identifier created on sign-up to detect automated bulk account creation and keep the free 10 GB tier available to genuine users. It is not a fingerprint and is never shared with third parties.",
              "1 year, or until you clear it",
              "No — strictly necessary for abuse prevention",
            ],
          ],
        },
        {
          type: "p",
          text: "When you complete a security check on sign-up, login or password reset, Cloudflare Turnstile may perform a privacy-preserving verification challenge strictly to distinguish humans from bots.",
        },
        {
          type: "p",
          text: "Server-side anti-abuse records — sign-up attempt logs and temporary cooldowns — are automatically pruned after 30 days for sign-up attempts and 90 days for security events.",
        },
        {
          type: "note",
          tone: "info",
          title: "What is not here",
          text: "No advertising cookies. No cross-site tracking pixels. No third-party analytics script running on public or dashboard pages. No social media embeds. No browser fingerprinting.",
        },
      ],
    },
    {
      id: "why-no-banner",
      heading: "Why there is no cookie banner",
      gist: "No tracking or non-essential cookies are set.",
      blocks: [
        {
          type: "p",
          text: "Under EU ePrivacy rules and the UK's PECR, consent is only required for non-essential storage such as advertising or tracking cookies. Strictly necessary authentication and security cookies, along with user-requested preferences like your chosen display currency, do not require a consent banner.",
        },
        {
          type: "p",
          text: "If Orindle ever introduces optional website analytics in the future, this policy will be updated first and an explicit consent control will be added before any measurement cookie is set.",
        },
      ],
    },
    {
      id: "india",
      heading: "Cookies under Indian law",
      blocks: [
        {
          type: "p",
          text: "India has no separate cookie statute; cookies that identify a person are governed as personal data under the DPDP Act 2023 and DPDP Rules 2025. Every cookie Orindle sets is itemised in this policy and in our Privacy Policy.",
        },
      ],
    },
    {
      id: "control",
      heading: "Removing them",
      blocks: [
        {
          type: "p",
          text: "Every browser lets you delete cookies and clear site data from its privacy settings. Deleting the session cookie signs you out; clearing local storage resets your currency and layout preferences. Blocking all cookies breaks sign-in and resets currency selection on each visit.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "Any addition of non-essential cookies or analytics scripts will be reflected on this page first with an updated effective date, along with a consent mechanism where required.",
        },
      ],
    },
  ],
};

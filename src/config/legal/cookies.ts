import type { LegalDocument } from "./types";

/**
 * Cookie Policy — draft.
 *
 * The site sets no analytics or advertising cookies, so the interesting content
 * here is not a cookie table but the explanation of why there is barely one. The
 * legal framing differs by regime and the document says so rather than picking
 * the strictest rule and applying it everywhere:
 *
 *   • EU/UK: storage on a device needs consent unless strictly necessary
 *     (ePrivacy Art. 5(3) / PECR reg. 6).
 *   • UK since 5 February 2026: the Data (Use and Access) Act 2025 added
 *     exceptions for statistics-only analytics and appearance preferences,
 *     provided visitors are informed and can object. Advertising still needs
 *     consent.
 *   • India: no cookie-specific statute. Cookies are personal data and fall under
 *     the DPDP Act where they identify a person.
 */
export const COOKIE_POLICY: LegalDocument = {
  id: "cookies",
  path: "/cookies",
  title: "Cookie Policy",
  summary:
    "The site sets almost nothing. Here is what exists, what it is for, and how to remove it.",
  purpose: "Storage on your device.",
  updated: "2026-11-16",
  sections: [
    {
      id: "what",
      heading: "What a cookie is, and what Orindle uses",
      blocks: [
        {
          type: "p",
          text: "A cookie is a small file a site stores in your browser. Orindle uses cookies for two things: keeping you signed in, and remembering which currency you chose on the pricing page. If you have never signed in, no cookie identifies you.",
        },
        {
          type: "p",
          text: "Orindle also uses two local-storage keys to remember interface preferences: whether the dashboard sidebar is collapsed, and whether your file list is shown as a grid or a list. Neither is a cookie, and neither leaves your browser.",
        },
      ],
    },
    {
      id: "list",
      heading: "The complete list",
      gist: "Five entries, all essential or pre-set by you.",
      blocks: [
        {
          type: "table",
          caption: "Everything Orindle stores on your device",
          head: ["Name", "Type", "Purpose", "Lifetime", "Consent needed?"],
          rows: [
            [
              "Session token",
              "Cookie, httpOnly, secure",
              "Keeps you signed in. Without it you would sign in on every page.",
              "Session, or until sign-out",
              "No — strictly necessary",
            ],
            [
              "orindle_currency",
              "Cookie, sameSite=lax",
              "Remembers the currency you chose on the pricing page so prices stay consistent.",
              "1 year, or until you clear it",
              "No — a user-requested preference",
            ],
            [
              "orindle:sidebar",
              "Local storage",
              "Remembers whether you collapsed the dashboard sidebar.",
              "Until you clear it",
              "No — a user-requested preference",
            ],
            [
              "orindle:view",
              "Local storage",
              "Remembers whether your files are shown as a grid or a list.",
              "Until you clear it",
              "No — a user-requested preference",
            ],
            [
              "orindle_did",
              "Cookie, httpOnly, secure",
              "A random identifier created the first time you sign up. It lets us notice repeated account creation from one browser, which is how the free 10 GB plan is kept available to genuine new accounts. It is not a fingerprint: it holds no information about your device, browser or behaviour, and it is never shared.",
              "1 year, or until you clear it",
              "No — strictly necessary to prevent abuse of the free plan",
            ],
          ],
        },
        {
          type: "p",
          text: "The sign-up identifier deserves its own sentence, because identifiers like it are sometimes used for things Orindle does not do. It is a random value we generate. It is not derived from your device, your screen, your fonts, your IP address or anything else about you, and it cannot be used to recognise you on another website, because it is never sent anywhere except to us.",
        },
        {
          type: "p",
          text: "The related server-side records — an attempt at a sign-up, the outcome, and a temporary cooldown if several accounts came from one browser — are kept for 30 days for sign-up attempts and 90 days for security events, then deleted automatically. They are not readable by any other user, and there is no screen that shows them.",
        },
        {
          type: "note",
          tone: "info",
          title: "What is not here",
          text: "No advertising cookies. No cross-site tracking pixels. No third-party analytics script. No social media embeds that set cookies before you interact with them. No browser fingerprinting.",
        },
      ],
      review:
        "Confirm against the deployed application that no analytics or error-reporting script sets a cookie. If one is added later this table is the thing that must change first.",
    },
    {
      id: "why-no-banner",
      heading: "Why there is no cookie banner",
      gist: "Because nothing here needs consent.",
      blocks: [
        {
          type: "p",
          text: "In the EU and the UK, storing information on your device requires your consent unless the storage is strictly necessary to provide a service you asked for, or falls within another legal exception. A sign-in cookie is strictly necessary: without it, the service you signed up for cannot function.",
        },
        {
          type: "p",
          text: "Since 5 February 2026 the UK's PECR has further exceptions, added by the Data (Use and Access) Act 2025, for storage used solely to produce statistics about how a site is used, and for storage that adapts how a site looks or works. Both require clear information and a simple way to object. Orindle does not currently rely on either exception, because Orindle sets no analytics.",
        },
        {
          type: "p",
          text: "A banner that asks permission for something the site does not do is not compliance; it trains people to dismiss the question. If an analytics tool is added, this policy changes first and the banner appears with it.",
        },
      ],
    },
    {
      id: "india",
      heading: "Cookies under Indian law",
      blocks: [
        {
          type: "p",
          text: "India has no cookie-specific statute. A cookie that identifies an individual is personal data, and the DPDP Act applies to it: the notice under Rule 3 of the DPDP Rules 2025 must itemise the data collected, which is why the sign-in cookie is disclosed in the Privacy Policy and on this page.",
        },
      ],
    },
    {
      id: "control",
      heading: "Removing them",
      blocks: [
        {
          type: "p",
          text: "Every major browser lets you delete cookies and clear site data; your browser's privacy settings have a 'cookies and site data' section. Deleting the session cookie signs you out, which is the only effect. Clearing local storage resets your currency and display preferences to their defaults.",
        },
        {
          type: "p",
          text: "Because Orindle does not use cookies for tracking or advertising, blocking all cookies on this site breaks sign-in and resets the currency on each visit. Nothing else changes.",
        },
      ],
    },
    {
      id: "changes",
      heading: "If this changes",
      blocks: [
        {
          type: "p",
          text: "Adding an analytics or marketing tool would change this page, the Privacy Policy, and — for visitors in the EU or UK — require a consent mechanism. The date at the top of this page is the date of the last change.",
        },
      ],
    },
  ],
};

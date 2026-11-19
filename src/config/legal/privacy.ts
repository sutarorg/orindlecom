import type { LegalDocument } from "./types";

/**
 * Privacy Policy — approved and published.
 *
 * Written against India's DPDP Act 2023 and DPDP Rules 2025, with GDPR and
 * UK GDPR obligations clearly stated where they apply to EEA and UK users.
 */
export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  path: "/privacy",
  title: "Privacy Policy",
  summary:
    "What Orindle collects, why, where it goes, who can see it, and how to get a copy of it or have it erased.",
  purpose: "Personal data, in detail.",
  updated: "2026-11-16",
  approved: true,
  sections: [
    {
      id: "scope",
      heading: "Scope of this policy",
      gist: "What this policy covers and which laws apply.",
      blocks: [
        {
          type: "p",
          text: "This policy covers Orindle's website (orindle.com) and the cloud storage service you sign in to, including personal workspaces and Business organizations. It does not cover third-party sites Orindle links to.",
        },
        {
          type: "p",
          text: "It describes how Orindle processes personal data under India's Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025, and, where Orindle handles the personal data of people in the European Economic Area or the United Kingdom, the additional rights provided under the GDPR and UK GDPR.",
        },
      ],
    },
    {
      id: "who",
      heading: "Who is responsible",
      gist: "The operator and how to reach us.",
      blocks: [
        {
          type: "p",
          text: "Orindle (orindle.com) is operated independently from India. Under the DPDP Act, Orindle is the Data Fiduciary for account, billing and usage data. For files that business organizations upload about their own clients or personnel, the organization is the Data Fiduciary and Orindle acts as a Data Processor on its instructions.",
        },
        {
          type: "p",
          text: "Questions about this policy, privacy notices, and requests to exercise any right described in section 8 can be sent through the contact form at orindle.com/contact?subject=privacy or directly by email to tejassutar.business@gmail.com. Orindle has not been notified as a Significant Data Fiduciary under the DPDP Act 2023; all privacy and data-protection requests are handled directly through this contact.",
        },
      ],
    },
    {
      id: "what",
      heading: "What we collect",
      gist: "Itemised, as the DPDP Rules require.",
      blocks: [
        {
          type: "p",
          text: "Rule 3 of the DPDP Rules requires this notice to itemise the personal data processed. Here is that complete list:",
        },
        {
          type: "table",
          caption: "Personal data processed by Orindle",
          head: ["Data", "What exactly", "Where it comes from"],
          rows: [
            [
              "Account",
              "Email address, display name, email verification status, optional TOTP two-factor factor status, and — if you set one — a password stored as a one-way hash. If you sign in with Google, the account identifier Google issues.",
              "You, at sign-up or in Settings",
            ],
            [
              "Files and folders",
              "The contents of files you upload, plus the metadata needed to display and share them: name, size, MIME type, timestamps, parent folder, sharing grants, and organization membership.",
              "You, while using the service",
            ],
            [
              "Billing",
              "A provider-issued payment and subscription identifier, plan tier, billing interval (monthly or yearly), and billing currency (INR, USD, GBP, EUR, AED, SGD, AUD or CAD).",
              "Dodo Payments, our payment processor",
            ],
            [
              "Technical and security",
              "IP address (stored hashed for anti-abuse rate limiting), browser user agent, sign-up abuse check records, timestamps, and error reports.",
              "Your browser and our servers",
            ],
            [
              "Support",
              "Your name, email address, selected subject, and the message you write.",
              "You, when you use the contact form or email support",
            ],
          ],
        },
        {
          type: "p",
          text: "Orindle does not collect or store your card number, bank credentials or UPI PIN. Payment details are entered directly into Dodo Payments' hosted checkout and never reach Orindle's servers.",
        },
        {
          type: "p",
          text: "Orindle does not use advertising trackers, does not build advertising profiles, and does not sell personal data or use your files to train machine-learning models.",
        },
      ],
    },
    {
      id: "why",
      heading: "Why we process it, and on what basis",
      gist: "Each purpose, with the lawful basis.",
      blocks: [
        {
          type: "p",
          text: "Under the DPDP Act, personal data is processed with your consent or for a legitimate use listed in section 7. Under the GDPR and UK GDPR, each processing activity relies on a specific Article 6 lawful basis:",
        },
        {
          type: "table",
          head: ["Purpose", "DPDP basis", "GDPR / UK GDPR basis"],
          rows: [
            [
              "Providing storage: authenticating you, storing, previewing and sharing your files and organizations",
              "Consent given at sign-up and voluntary provision of data for the requested service",
              "Performance of a contract (Art. 6(1)(b))",
            ],
            [
              "Taking payment and administering monthly or annual subscriptions",
              "Consent and performance of the subscription you select",
              "Performance of a contract (Art. 6(1)(b))",
            ],
            [
              "Keeping the service secure: rate limiting, Turnstile bot verification, abuse prevention and audit logs",
              "Certain legitimate uses — fraud prevention and network security",
              "Legitimate interests (Art. 6(1)(f))",
            ],
            [
              "Sending transactional emails (verification, password resets, billing receipts, invitations) and answering support messages",
              "Consent given by creating an account or writing to support",
              "Performance of a contract (Art. 6(1)(b)) or legitimate interests (Art. 6(1)(f))",
            ],
            [
              "Meeting accounting and legal record-keeping obligations on paid plans",
              "Legal obligation",
              "Legal obligation (Art. 6(1)(c))",
            ],
          ],
        },
      ],
    },
    {
      id: "where",
      heading: "Where your data is held",
      gist: "All six infrastructure providers acting for Orindle.",
      blocks: [
        {
          type: "p",
          text: "Orindle uses six third-party infrastructure providers, each acting under contract and processing data only to deliver the service:",
        },
        {
          type: "definitions",
          items: [
            {
              term: "Supabase",
              text: "Authentication records, TOTP MFA factors, and application metadata in managed PostgreSQL with Row Level Security.",
            },
            {
              term: "Cloudflare R2",
              text: "Private object storage for file contents, encrypted at rest and stored under opaque random object keys.",
            },
            {
              term: "Dodo Payments",
              text: "Domestic and international payment processing across all eight supported currencies. Orindle receives payment references, never card numbers.",
            },
            {
              term: "Resend",
              text: "Transactional email delivery for account verification, password resets, organization invitations, billing notices and support replies. No open-tracking pixels or link tracking.",
            },
            {
              term: "Vercel",
              text: "Web application hosting, TLS termination, and scheduled maintenance job execution.",
            },
            {
              term: "Cloudflare Turnstile",
              text: "Privacy-preserving anti-bot verification on sign-up, login and password-reset forms.",
            },
          ],
        },
        {
          type: "p",
          text: "All traffic moves over TLS in transit. File uploads and downloads go directly between your browser and Cloudflare R2 via short-lived signed URLs rather than being buffered on application servers.",
        },
      ],
    },
    {
      id: "transfers",
      heading: "Sending data outside your country",
      gist: "Cross-border transfers and safeguards.",
      blocks: [
        {
          type: "p",
          text: "Under section 16 of India's DPDP Act, personal data may be transferred outside India unless the Central Government restricts a specific country or territory. None of Orindle's infrastructure providers operate in a restricted territory.",
        },
        {
          type: "p",
          text: "Where GDPR or UK GDPR applies, cross-border transfers rely on our infrastructure providers' contractual data-protection commitments and Standard Contractual Clauses (Article 46), together with encryption in transit and at rest.",
        },
      ],
    },
    {
      id: "retention",
      heading: "How long we keep it",
      gist: "Exact retention windows enforced by the product.",
      blocks: [
        {
          type: "p",
          text: "Section 8(7) of the DPDP Act requires erasure once the purpose is served or consent is withdrawn, unless law requires retention. These are Orindle's approved retention rules:",
        },
        {
          type: "table",
          head: ["Category", "Retention window", "What happens at expiry"],
          rows: [
            [
              "Account record and profile",
              "Kept while your account is active. When you request deletion, a 7-day read-only grace period applies.",
              "Permanently deleted automatically after the 7-day grace period unless cancelled by signing back in.",
            ],
            [
              "Active files and folders",
              "Kept until you delete them or close your account.",
              "Moved to Trash when deleted; removed immediately when you empty Trash or purge an item.",
            ],
            [
              "Trash",
              "30 days from deletion.",
              "Permanently removed from primary object storage and database by the nightly cleanup job.",
            ],
            [
              "Anti-abuse sign-up and security events",
              "30 days for sign-up attempt logs; 90 days for security risk events.",
              "Automatically pruned by the scheduled maintenance job.",
            ],
            [
              "Billing and payment records",
              "Retained after account closure for the period required by applicable accounting and tax law.",
              "Contains transaction references and amounts only — never your files.",
            ],
            [
              "Infrastructure backups",
              "Rolling rotation managed by our database infrastructure provider.",
              "Deleted data is never restored into active accounts and ages out automatically on rotation.",
            ],
          ],
        },
      ],
    },
    {
      id: "rights",
      heading: "Your rights",
      gist: "Self-service tools and how to make a formal request.",
      blocks: [
        {
          type: "p",
          text: "Under the DPDP Act you have the right to a summary of your personal data and processing activities (section 11), to correction, completion, updating and erasure (section 12), to grievance redressal (section 13), and to nominate someone to exercise your rights in the event of death or incapacity (section 14).",
        },
        {
          type: "p",
          text: "Where GDPR or UK GDPR applies you also have the right to data portability, to object to processing, to restrict processing, to withdraw consent at any time, and to complain to your supervisory authority — the ICO in the UK, or your national authority in the EEA.",
        },
        {
          type: "note",
          tone: "info",
          title: "Self-service controls available in your dashboard",
          text: "You can download any file at any time, export your account data bundle from Dashboard → Settings, update your display name or email address, empty Trash immediately (or let items expire after 30 days), and initiate self-service account deletion (with a 7-day read-only grace period) directly from Dashboard → Settings.",
        },
        {
          type: "p",
          text: "To exercise any right that requires assistance, write through the contact form (subject: Privacy) or email tejassutar.business@gmail.com from your account email address. Orindle acknowledges requests within 48 hours and resolves them within one month (and never later than the 90-day outer statutory limit under DPDP Rule 14(3)).",
        },
      ],
    },
    {
      id: "consent",
      heading: "Withdrawing consent",
      gist: "As simple to withdraw as to give.",
      blocks: [
        {
          type: "p",
          text: "Under Rule 3(c)(i) of the DPDP Rules, withdrawing consent is as straightforward as giving it. You can close your account directly in Dashboard → Settings or withdraw consent through the contact form or by emailing tejassutar.business@gmail.com.",
        },
        {
          type: "p",
          text: "Withdrawing consent for the core storage service closes the account and schedules deletion of your files and personal data after the 7-day grace period. If you have an active paid subscription, cancel renewal from Billing before closing the account.",
        },
      ],
    },
    {
      id: "security",
      heading: "How we protect it",
      gist: "Implemented controls and clear boundaries.",
      blocks: [
        {
          type: "p",
          text: "Orindle implements encryption at rest in Cloudflare R2, TLS encryption in transit, database Row Level Security on every table, short-lived signed URLs for uploads and downloads, optional TOTP two-factor authentication (2FA), Cloudflare Turnstile anti-bot protection, PostgreSQL-backed rate limiting, and constant-time HMAC verification on all payment callbacks and webhooks.",
        },
        {
          type: "p",
          text: "Two things are stated transparently: Orindle does not hold third-party SOC 2, ISO 27001 or HIPAA certifications, and Orindle does not provide zero-knowledge client-side encryption — the service uses server-side encryption so it can serve previews, downloads and shared links to you.",
        },
      ],
    },
    {
      id: "breach",
      heading: "If something goes wrong",
      gist: "How breach notifications work.",
      blocks: [
        {
          type: "p",
          text: "Under section 8(6) of the DPDP Act and Rule 7 of the DPDP Rules, a personal data breach is reported to the Data Protection Board of India without delay, and to each affected user in plain language by email.",
        },
        {
          type: "p",
          text: "That notice describes the nature, extent and timing of the incident, likely consequences, steps Orindle is taking, steps you can take to protect your account, and how to reach us. Where GDPR or UK GDPR applies, the 72-hour supervisory authority notification deadline also applies.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children and minimum age",
      gist: "Accounts require you to be at least 18.",
      blocks: [
        {
          type: "p",
          text: "Orindle is intended for adults. You must be at least 18 years old (or the age of digital consent in your jurisdiction, if higher) to create an Orindle account. Orindle does not knowingly collect personal data from children under 18. If we learn an account belongs to someone under 18 without lawful parental authorisation, we will close the account and erase its data promptly.",
        },
      ],
    },
    {
      id: "complaints",
      heading: "Grievances and complaints",
      gist: "How to escalate a concern.",
      blocks: [
        {
          type: "p",
          text: "To raise a privacy grievance or complaint, contact Orindle Support at tejassutar.business@gmail.com or via orindle.com/contact?subject=privacy. Every grievance is acknowledged within 48 hours and resolved within one month.",
        },
        {
          type: "p",
          text: "If a grievance is not resolved to your satisfaction, you may escalate to the Data Protection Board of India (under DPDP section 13), the Information Commissioner's Office in the UK, or your national supervisory authority in the EEA.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      gist: "Advance notice for material changes.",
      blocks: [
        {
          type: "p",
          text: "The effective date at the top of this page shows when this policy was last updated. Material changes are posted here and notified to account holders by email before they take effect.",
        },
      ],
    },
  ],
};

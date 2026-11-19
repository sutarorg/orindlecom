import type { LegalDocument } from "./types";

/**
 * Terms of Service — approved and published.
 *
 * Covers personal accounts, paid subscriptions (monthly and annual with 20%
 * discount across 8 currencies), Business organizations (inheriting the owner's
 * plan), EU Data Act Chapter VI switching rights, and consumer protections.
 */
export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms",
  path: "/terms",
  title: "Terms of Service",
  summary:
    "The agreement between you and Orindle: what you get, how plans and workspaces work, and how either side ends it.",
  purpose: "The contract.",
  updated: "2026-11-16",
  approved: true,
  sections: [
    {
      id: "parties",
      heading: "Who you are contracting with",
      gist: "Orindle and your account.",
      blocks: [
        {
          type: "p",
          text: "Orindle (orindle.com) is operated independently from India. In these terms, 'Orindle', 'we' and 'us' refer to the operator of Orindle, and 'you' means the individual holding the account — and, where you create or administer a Business organization, the team or organization you represent.",
        },
        {
          type: "p",
          text: "By creating an account or using Orindle, you agree to these Terms of Service together with the Privacy Policy, Acceptable Use Policy, Cookie Policy and Data Deletion Policy. Formal notices and legal correspondence may be sent to tejassutar.business@gmail.com.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "Who may hold an account",
      gist: "Age 18+, accurate details, one free account per person.",
      blocks: [
        {
          type: "p",
          text: "You must be at least 18 years old (or the age of majority in your jurisdiction, if higher) and have a valid email address to hold an Orindle account. You are responsible for keeping your password and two-factor authentication credentials secure and for activity under your account.",
        },
        {
          type: "p",
          text: "One free account per person. Accounts may not be created in bulk or pooled to circumvent free-tier storage quotas.",
        },
      ],
    },
    {
      id: "service",
      heading: "What the service is",
      gist: "Cloud storage, personal and shared — not a backup guarantee.",
      blocks: [
        {
          type: "p",
          text: "Orindle provides cloud file storage across devices, private file sharing, and Business organization workspaces with role-based shared folders. Storage allowances range from 10 GB on the Free plan up to 5 TB on the Max plan and are shared across every device you sign in on.",
        },
        {
          type: "p",
          text: "There is no artificial per-file upload size cap — individual uploads are bounded only by your available storage quota and browser transfer limits. Business organizations inherit the organization owner's active Orindle plan and storage allowance.",
        },
        {
          type: "note",
          tone: "warning",
          title: "Keep an independent backup of irreplaceable files",
          text: "Orindle is a cloud storage service, not a guaranteed backup archive. Deleted files are permanently removed after 30 days in Trash, and accidental deletion, compromised credentials or technical faults can still happen. Keep a separate copy of anything you cannot recreate.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "Your content and acceptable use",
      gist: "You own your files; content must follow our Acceptable Use Policy.",
      blocks: [
        {
          type: "p",
          text: "You retain full ownership of every file and folder you upload. You grant Orindle only the limited technical licence necessary to store, encrypt, transmit, preview and share your files according to your instructions.",
        },
        {
          type: "p",
          text: "Files and shared links must comply with our Acceptable Use Policy and applicable law.",
        },
      ],
    },
    {
      id: "billing",
      heading: "Plans, payment, renewal and refunds",
      gist: "Eight currencies, monthly or annual (20% off), handled by Dodo Payments.",
      blocks: [
        {
          type: "p",
          text: "The Free plan (10 GB) costs nothing and requires no payment method. Paid plans (Basic 100 GB, Plus 500 GB, Premium 1 TB, Ultra 2 TB and Max 5 TB) are available on monthly billing or annual billing with a 20% discount, in eight published currencies: INR, USD, GBP, EUR, AED, SGD, AUD and CAD.",
        },
        {
          type: "p",
          text: "All domestic and international payments are processed securely by Dodo Payments. Orindle never sees or stores your card number or banking credentials. Payment receipts are displayed in Dashboard → Billing and sent by email. GST and downloadable tax invoices are not currently enabled.",
        },
        {
          type: "p",
          text: "Business organization billing inherits the organization owner's plan — there is no separate per-seat subscription charge.",
        },
        {
          type: "p",
          text: "Paid plans renew for the billing period you selected unless you cancel before the renewal date. If a renewal payment fails, we notify you and retry. If the subscription lapses, your account moves to the Free allowance; your existing files are never deleted on downgrade, and you can continue downloading or deleting files, though new uploads pause until usage is within your active allowance.",
        },
        {
          type: "p",
          text: "You may cancel at any time from Dashboard → Billing. Cancellation stops the next renewal while keeping your paid storage active until the end of the period you already paid for. Partial-period refunds are not issued automatically; if you were charged in error or hold a mandatory statutory withdrawal right in your country, email tejassutar.business@gmail.com and we will review and honour applicable legal entitlements.",
        },
      ],
    },
    {
      id: "availability",
      heading: "Availability and service changes",
      gist: "Continuous operation target without an SLA credit commitment.",
      blocks: [
        {
          type: "p",
          text: "Orindle aims for reliable, continuous availability and advance notice for planned maintenance, but does not offer a contractual uptime SLA or service-credit guarantee.",
        },
        {
          type: "p",
          text: "We may improve or update features over time. Any change that materially reduces the storage or capabilities of a paid plan is communicated in advance and will never restrict your ability to download or export your data.",
        },
      ],
    },
    {
      id: "suspension",
      heading: "When we may suspend an account",
      gist: "Narrow, specific grounds with notice where lawful.",
      blocks: [
        {
          type: "p",
          text: "We may temporarily restrict uploads or suspend access where the Acceptable Use Policy is breached, where automated abuse or multi-account pooling is detected, where a lawful court or regulatory order requires it, or where the account is being used to attack the service or harm others.",
        },
        {
          type: "p",
          text: "Except where law or urgent safety requires immediate action, we tell you why and give you a way to respond. Suspension is not deletion: your files remain intact while the issue is addressed.",
        },
      ],
    },
    {
      id: "switching",
      heading: "Leaving, switching and portability",
      gist: "Take your files with you at any time, at no switching charge.",
      blocks: [
        {
          type: "p",
          text: "You can download your files and export your account metadata bundle from Dashboard → Settings at any time, without asking permission and without paying an exit fee.",
        },
        {
          type: "p",
          text: "Consistent with Chapter VI of the EU Data Act (Regulation (EU) 2023/2854), Orindle extends the following switching commitments to every customer worldwide:",
        },
        {
          type: "table",
          caption: "Switching and data portability terms",
          head: ["Term", "What Orindle commits to"],
          rows: [
            ["Notice", "No more than two months before switching begins (and you may start self-service export immediately)."],
            ["Transition", "Up to 30 calendar days of assistance during migration."],
            ["Retrieval", "At least 30 calendar days after transition to retrieve files."],
            ["Format", "Original uploaded file formats plus structured, machine-readable JSON metadata export."],
            ["Erasure", "Permanent erasure on account closure after the 7-day grace period, per our Data Deletion Policy."],
            ["Charges", "Zero switching or egress fee for exporting your own data."],
          ],
        },
      ],
    },
    {
      id: "deletion",
      heading: "Ending the agreement",
      gist: "Close your account whenever you choose.",
      blocks: [
        {
          type: "p",
          text: "You may close your account at any time from Dashboard → Settings (which starts a 7-day read-only grace period before permanent deletion, cancelled automatically if you sign back in). Orindle may end this agreement for an uncured material breach, or with at least 30 days' advance notice and a working export path if the service is ever discontinued.",
        },
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      gist: "Clear limits that never override non-excludable statutory rights.",
      blocks: [
        {
          type: "p",
          text: "Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or for any statutory right that cannot be excluded under applicable consumer or data-protection law.",
        },
        {
          type: "p",
          text: "Subject to the above, Orindle is not liable for indirect, incidental or consequential loss, loss of profit, goodwill or business opportunity. To the fullest extent permitted by law, Orindle's aggregate liability arising out of or relating to the service in any twelve-month period is capped at the greater of the total fees you paid to Orindle during the twelve months preceding the claim, or INR 1,000 (or equivalent in your billing currency).",
        },
      ],
    },
    {
      id: "law",
      heading: "Governing law and grievances",
      gist: "Laws of India, preserving mandatory local consumer rights.",
      blocks: [
        {
          type: "p",
          text: "These terms are governed by the laws of India. If you are a consumer residing outside India, nothing in these terms deprives you of mandatory consumer-protection rights granted by the laws of your country of residence.",
        },
        {
          type: "p",
          text: "Grievances and consumer complaints may be sent to Orindle Support at tejassutar.business@gmail.com or through orindle.com/contact. Complaints are acknowledged within 48 hours and resolved within one month.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      gist: "Advance notice before material changes take effect.",
      blocks: [
        {
          type: "p",
          text: "Material changes to these terms are posted on this page with an updated effective date and emailed to account holders before they take effect. Continued use after the effective date constitutes acceptance; if you do not agree, you may export your data and close your account before the change takes effect.",
        },
      ],
    },
  ],
};

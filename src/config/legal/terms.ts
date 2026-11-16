import type { LegalDocument } from "./types";

/**
 * Terms of Service — draft.
 *
 * Two regimes shape this document beyond the usual contract terms:
 *
 *   • The EU Data Act (Regulation (EU) 2023/2854), Chapter VI, has applied since
 *     12 September 2025. A consumer cloud storage offering that meets the
 *     'data processing service' definition must give switching rights on written
 *     terms with a notice period of at most two months, a transition period of at
 *     most 30 days and a retrieval period of at least 30 days. Section 9 reflects
 *     that, because it is a legal floor, not a courtesy.
 *   • The Consumer Protection (E-Commerce) Rules, 2020 require the entity's legal
 *     name, address and a named grievance officer to be displayed, with a 48-hour
 *     acknowledgement and one-month resolution for complaints.
 */
export const TERMS_OF_SERVICE: LegalDocument = {
  id: "terms",
  path: "/terms",
  title: "Terms of Service",
  summary:
    "The agreement between you and Orindle: what you get, what you owe, and how either side ends it.",
  purpose: "The contract.",
  updated: "2026-11-16",
  sections: [
    {
      id: "status",
      heading: "Status of this document",
      gist: "A draft, not yet reviewed.",
      blocks: [
        {
          type: "note",
          tone: "warning",
          title: "This is a draft",
          text: "These terms describe how the product actually works. They have not been reviewed by a qualified lawyer, and the sections marked as open are decisions that still have to be made. They should not be relied on as final terms until that review is complete.",
        },
      ],
      review:
        "A full review of these terms is required before publication. Particular attention: the liability cap, the consumer-law carve-outs, and whether the document should be split into consumer and business terms.",
    },
    {
      id: "parties",
      heading: "Who you are contracting with",
      gist: "The entity, once it is named.",
      blocks: [
        {
          type: "p",
          text: "Orindle is operated by the entity named below. 'Orindle', 'we' and 'us' refer to that entity. 'You' means the person holding the account, and, where an account is created for an organisation, the organisation as well.",
        },
        { type: "placeholder", key: "legalEntity" },
        { type: "placeholder", key: "registeredAddress" },
        {
          type: "p",
          text: "By creating an account you agree to these terms and to the Privacy Policy and Acceptable Use Policy, which form part of them.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "Who may hold an account",
      gist: "Age, and one account per person.",
      blocks: [
        { type: "placeholder", key: "minimumAge" },
        {
          type: "p",
          text: "You need a working email address and the legal capacity to enter a contract. You are responsible for what happens under your account, and for keeping your credentials to yourself.",
        },
        {
          type: "p",
          text: "One person, one account. Accounts may not be shared to avoid paying for storage, and automated bulk sign-ups are not permitted.",
        },
      ],
    },
    {
      id: "service",
      heading: "What the service is",
      gist: "Storage, not a backup guarantee.",
      blocks: [
        {
          type: "p",
          text: "Orindle stores files, shows them to you across devices, and shares them with people you choose. Storage allowances are per account and shared across every device you sign in on.",
        },
        {
          type: "p",
          text: "Feature and allowance details are on the pricing page. Where this document and the pricing page disagree about an allowance, the pricing page at the time you subscribed governs.",
        },
        {
          type: "note",
          tone: "warning",
          title: "This is not a backup service",
          text: "Orindle is a storage service. Deleted files are removed after 30 days in Trash, and a mistake, a compromised account or a hardware fault can lose data. Keep a copy of anything you cannot recreate.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "What you may store",
      gist: "Summary only — the full list is its own policy.",
      blocks: [
        {
          type: "p",
          text: "Files and folders must be lawful and must not harm other people or the service. The Acceptable Use Policy sets out the full list and is part of these terms.",
        },
        {
          type: "p",
          text: "You keep ownership of everything you upload. You grant Orindle only the licence needed to store, transmit and display those files back to you and to the people you share them with.",
        },
      ],
    },
    {
      id: "billing",
      heading: "Plans, payment and renewal",
      gist: "What happens when a payment fails.",
      blocks: [
        {
          type: "p",
          text: "The free plan costs nothing and requires no payment method. Paid plans are sold at the prices shown at checkout in the currency you select, and are handled by Razorpay. Orindle never sees your card details.",
        },
        {
          type: "p",
          text: "Subscriptions renew automatically for the period you chose unless cancelled before the renewal date. Prices shown are inclusive of applicable taxes where the pricing page says so; where they are exclusive, tax is added at checkout.",
        },
        {
          type: "p",
          text: "If a payment fails, Orindle retries and notifies you. If the plan lapses, the account reverts to the free allowance. Files are not deleted on downgrade, but uploading stops once usage exceeds the free allowance, and read access continues so the data stays recoverable.",
        },
        {
          type: "p",
          text: "You can cancel at any time from the billing page. Cancelling stops the next renewal; it does not refund the current period, except as described in the next paragraph.",
        },
        { type: "placeholder", key: "subscriptionRefund" },
      ],
      review:
        "Refunds for digital services are constrained by consumer law — notably the EU right of withdrawal for digital services under Directive 2011/83/EU and the corresponding UK rules — and by whether a waiver was obtained at checkout. No policy should be published until this is settled.",
    },
    {
      id: "availability",
      heading: "Availability and changes",
      gist: "No uptime number is promised.",
      blocks: [
        {
          type: "p",
          text: "Orindle aims to be available continuously and to give notice before planned maintenance, but publishes no uptime guarantee and offers no service-level credit. A number that is not measured and not creditable would be a marketing claim rather than a term.",
        },
        {
          type: "p",
          text: "Features may change. A change that materially reduces what you paid for will be described before it takes effect, and will not remove your ability to export your data.",
        },
      ],
    },
    {
      id: "suspension",
      heading: "When we may suspend an account",
      gist: "Narrow, specific reasons.",
      blocks: [
        {
          type: "p",
          text: "Access may be suspended where the Acceptable Use Policy is breached, where storage exceeds the allowance after a downgrade, where a lawful order requires it, where a payment is not resolved after notice, or where the account is being used to attack the service or another person.",
        },
        {
          type: "p",
          text: "Except where the law requires immediate action, Orindle tells you why before suspending, and gives you a way to respond. Suspension is not deletion: your files stay, and the suspension is lifted when the cause is resolved.",
        },
      ],
    },
    {
      id: "switching",
      heading: "Leaving, switching and portability",
      gist: "A legal floor, not a courtesy.",
      blocks: [
        {
          type: "p",
          text: "You can export your files at any time from the dashboard, in standard formats, without asking permission and without paying to get your own data out.",
        },
        {
          type: "p",
          text: "Where the EU Data Act applies, a customer may switch to another provider or to on-premises infrastructure. The terms of that switching are:",
        },
        {
          type: "table",
          caption: "EU Data Act Chapter VI — switching terms",
          head: ["Term", "What Orindle commits to"],
          rows: [
            ["Notice", "No more than two months before the switching process begins."],
            ["Transition", "Up to 30 calendar days of support during the move."],
            ["Retrieval", "At least 30 calendar days after the transition to retrieve data."],
            ["Format", "Exportable data in a structured, commonly used and machine-readable format."],
            ["Erasure", "Erasure of exportable data after retrieval or a later agreed period."],
            ["Charges", "No switching charge for moving data out. Article 29 phases out any permitted charge by 12 January 2027."],
          ],
        },
        {
          type: "p",
          text: "These commitments apply from 12 September 2025 as required by Regulation (EU) 2023/2854. Orindle applies them to every customer, not only those in the EU, because a two-tier exit would be indefensible.",
        },
      ],
      review:
        "Confirm that the export tooling actually produces a machine-readable export of everything, and that the internal registry of data formats required by Article 26 exists.",
    },
    {
      id: "deletion",
      heading: "Ending the agreement",
      gist: "Who can end it, and what survives.",
      blocks: [
        {
          type: "p",
          text: "You may close your account at any time. Orindle may end the agreement for a material breach that is not cured, or with notice if the service is discontinued. The Data Deletion Policy describes exactly what happens to your data on closure.",
        },
        {
          type: "p",
          text: "If Orindle discontinues the service, account holders get at least 30 days' notice and a working export path, and no charge is made for exporting.",
        },
      ],
    },
    {
      id: "liability",
      heading: "Liability",
      gist: "What is and is not recoverable.",
      blocks: [
        {
          type: "p",
          text: "Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, for fraud, or for anything else that law does not allow to be excluded. Where GDPR or UK GDPR applies, nothing here limits the rights you have under those regimes.",
        },
        {
          type: "p",
          text: "Subject to that, Orindle is not liable for indirect or consequential loss, nor for loss of profit, goodwill or business opportunity. For loss of data, its liability is limited to the data the loss concerns and what a reasonable backup practice would have preserved — which is why this document says plainly that Orindle is not a backup service.",
        },
        {
          type: "p",
          text: "Where a limitation of liability applies, Orindle's total liability in any twelve-month period is capped at the greater of the amount you paid Orindle in that period, or a figure to be set in review.",
        },
      ],
      review:
        "The cap cannot be left as 'a figure to be set in review' in a published document. It also cannot be capped below the amount paid where consumer law forbids it. Legal review is required.",
    },
    {
      id: "law",
      heading: "Governing law and disputes",
      gist: "Depends on where the entity is registered.",
      blocks: [
        { type: "placeholder", key: "governingLaw" },
        {
          type: "p",
          text: "Consumers keep the protections of the law in the country where they live, whatever forum these terms name. Nothing in this section removes a right to bring a claim in a local court where consumer law grants it.",
        },
        { type: "placeholder", key: "grievanceOfficer" },
      ],
      review:
        "Under the Consumer Protection (E-Commerce) Rules, 2020 the grievance officer must acknowledge a complaint within 48 hours and resolve it within one month. Confirm the named officer and make the published timeline match.",
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      gist: "Notice before, not after.",
      blocks: [
        {
          type: "p",
          text: "A material change is described on this page and emailed to account holders before it takes effect, with the date at the top updated. Continuing to use the service after a change takes effect means accepting it; if you do not accept it, you may close your account and export your data first.",
        },
      ],
    },
  ],
};

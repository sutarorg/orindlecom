import type { LegalDocument } from "./types";

/**
 * Privacy Policy — draft.
 *
 * Written against the DPDP Act 2023 and the DPDP Rules 2025 as notified
 * (G.S.R. 846(E), 13 November 2025), with the GDPR and UK GDPR obligations
 * marked where they add something the Indian regime does not require.
 *
 * Structure follows Rule 3 of the DPDP Rules: the notice must be understandable
 * independently of other information, must itemise the personal data collected,
 * and must state the purpose. That is why section 3 is a table of data items
 * rather than prose.
 */
export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  path: "/privacy",
  title: "Privacy Policy",
  summary:
    "What Orindle collects, why, where it goes, who can see it, and how to get a copy of it or have it erased.",
  purpose: "Personal data, in detail.",
  updated: "2026-11-16",
  sections: [
    {
      id: "scope",
      heading: "Scope and status of this document",
      gist: "A draft, not yet reviewed by a lawyer.",
      blocks: [
        {
          type: "note",
          tone: "warning",
          title: "This is a draft policy",
          text: "Every factual statement below matches how the product is built. The sections marked as open are business or legal decisions that have not been made yet — they are shown as placeholders rather than filled with plausible-sounding text. This draft must be reviewed by a qualified lawyer before it is relied on as Orindle's published policy.",
        },
        {
          type: "p",
          text: "This policy covers Orindle's website and the storage service you sign in to. It does not cover third-party sites Orindle links to.",
        },
        {
          type: "p",
          text: "It describes processing under India's Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025, and, where Orindle handles the personal data of people in the European Economic Area or the United Kingdom, the obligations those regimes add.",
        },
      ],
      review:
        "Confirm the intended territorial scope and whether the policy should state it claims to meet GDPR Chapter III requirements for EEA and UK data subjects.",
    },
    {
      id: "who",
      heading: "Who is responsible",
      gist: "The operating entity, and how to reach it.",
      blocks: [
        {
          type: "p",
          text: "Under the DPDP Act, Orindle is the Data Fiduciary for account and usage data. For files that business customers upload about their own customers, the business is the Data Fiduciary and Orindle is a Data Processor acting on its instructions.",
        },
        { type: "placeholder", key: "legalEntity" },
        { type: "placeholder", key: "registeredAddress" },
        {
          type: "p",
          text: "Questions about this policy, and requests to exercise any right described in section 7, can be sent through the contact form on this site or by email to the support address published in the footer. Both reach a person, not a ticket queue.",
        },
        { type: "placeholder", key: "businessContact" },
        { type: "placeholder", key: "dpoName" },
      ],
      review:
        "Rule 9 of the DPDP Rules requires the published contact to be 'business contact information' of a person able to answer processing questions. Confirm whether a personal support inbox satisfies this or whether a dedicated address is needed.",
    },
    {
      id: "what",
      heading: "What we collect",
      gist: "Itemised, as the DPDP Rules require.",
      blocks: [
        {
          type: "p",
          text: "Rule 3 of the DPDP Rules requires the notice to itemise the personal data being processed. This is that itemisation.",
        },
        {
          type: "table",
          caption: "Personal data processed by Orindle",
          head: ["Data", "What exactly", "Where it comes from"],
          rows: [
            [
              "Account",
              "Email address, display name, and — if you set one — a password stored as a one-way hash. If you sign in with a third-party provider, the identifier that provider issues.",
              "You, at sign-up",
            ],
            [
              "Files",
              "The contents of files you upload, plus the metadata needed to show them: name, size, type, timestamps, parent folder.",
              "You, while using the service",
            ],
            [
              "Billing",
              "A provider-issued customer and subscription identifier, plan, and the currency and country used to price it.",
              "Razorpay, our payment processor",
            ],
            [
              "Technical",
              "IP address, browser user agent, timestamps, and error reports.",
              "Your browser and our servers",
            ],
            [
              "Support",
              "Your name, email address, the subject you select, and the message you write.",
              "You, when you use the contact form",
            ],
          ],
        },
        {
          type: "p",
          text: "Orindle does not collect your card number. Payment details are entered directly into Razorpay's interface and never reach Orindle's servers.",
        },
        {
          type: "p",
          text: "Orindle does not use advertising trackers and does not build advertising profiles. There is no analytics or marketing pixel on this site.",
        },
      ],
    },
    {
      id: "why",
      heading: "Why we process it, and on what basis",
      gist: "Each purpose, with the basis claimed.",
      blocks: [
        {
          type: "p",
          text: "Under the DPDP Act, personal data may be processed for a lawful purpose either with consent or for a 'certain legitimate use' listed in section 7. Under the GDPR, a lawful basis must be identified for each purpose. These are the purposes and the bases Orindle relies on.",
        },
        {
          type: "table",
          head: ["Purpose", "DPDP basis", "GDPR basis"],
          rows: [
            [
              "Providing storage: authenticating you, storing and serving your files",
              "Consent, given at sign-up and in the notice shown when you create an account",
              "Performance of a contract (Art. 6(1)(b))",
            ],
            [
              "Taking payment and administering a subscription",
              "Consent",
              "Performance of a contract (Art. 6(1)(b))",
            ],
            [
              "Keeping the service secure: logs, abuse prevention, rate limiting",
              "Certain legitimate uses — fraud prevention and network security",
              "Legitimate interests (Art. 6(1)(f))",
            ],
            [
              "Answering your support message",
              "Consent, given by sending the message",
              "Legitimate interests, or steps taken at your request before a contract (Art. 6(1)(b))",
            ],
            [
              "Meeting tax and accounting obligations on paid plans",
              "Legal obligation — retention required by law",
              "Legal obligation (Art. 6(1)(c))",
            ],
          ],
        },
        {
          type: "p",
          text: "Orindle does not sell personal data, does not share it with advertisers, and does not use your files to train machine-learning models.",
        },
      ],
      review:
        "Consent as the DPDP basis for core service delivery is a defensible but debatable choice — some counsel prefer relying on section 7(i)-style legitimate uses or treating the service itself as the consent object. Confirm the position and make section 6's withdrawal wording consistent with it.",
    },
    {
      id: "where",
      heading: "Where your data is held",
      gist: "Named providers and confirmed regions.",
      blocks: [
        {
          type: "p",
          text: "Orindle runs on three infrastructure providers, each acting under contract and processing data only on Orindle's instructions:",
        },
        {
          type: "definitions",
          items: [
            {
              term: "Supabase",
              text: "Authentication records and application data in PostgreSQL.",
            },
            {
              term: "Cloudflare R2",
              text: "File contents, encrypted at rest, stored under random object keys.",
            },
            {
              term: "Razorpay",
              text: "Payment method handling and subscription billing. Orindle receives identifiers, never card data.",
            },
          ],
        },
        { type: "placeholder", key: "hostingRegions" },
        { type: "placeholder", key: "subProcessors" },
        {
          type: "p",
          text: "Data moves between your browser and these services over TLS. File transfers go directly to object storage and are not buffered on Orindle's application server.",
        },
      ],
      review:
        "Publish a maintained sub-processor list and a change-notification commitment if Orindle will offer Data Processing Agreements to business customers.",
    },
    {
      id: "transfers",
      heading: "Sending data outside your country",
      gist: "Permitted by default in India; restricted regimes elsewhere.",
      blocks: [
        {
          type: "p",
          text: "Under section 16 of the DPDP Act, personal data may be transferred outside India unless the Central Government has restricted a specific country or territory. No such restriction has been notified that affects Orindle's providers.",
        },
        {
          type: "p",
          text: "Where GDPR applies, a transfer outside the EEA needs an Article 46 mechanism. Where UK GDPR applies, the UK's own transfer test applies.",
        },
        { type: "placeholder", key: "transferMechanism" },
      ],
      review:
        "If EEA or UK data is handled, the transfer mechanism must be documented before this section can be published. Consider also the EU Data Act Article 28(2) infrastructure-jurisdiction disclosure.",
    },
    {
      id: "retention",
      heading: "How long we keep it",
      gist: "What the product actually does, and what is undecided.",
      blocks: [
        {
          type: "p",
          text: "Section 8(7) of the DPDP Act requires erasure once the purpose is served or consent is withdrawn, unless retention is required by law. This is what that means in practice for each category:",
        },
        {
          type: "table",
          head: ["Category", "What happens", "Status"],
          rows: [
            [
              "Account record",
              "Kept while your account exists. Deleted when you close the account.",
              "In place",
            ],
            [
              "Files",
              "Kept until you delete them. Deleted files sit in Trash for 30 days, then are removed permanently.",
              "In place",
            ],
            [
              "Server logs",
              "Retained for a short operational window, then discarded.",
              "Period not yet approved",
            ],
            [
              "Security and access logs",
              "Rule 6(1)(e) of the DPDP Rules requires logs be kept for one year to support detection, investigation and remediation of unauthorised access.",
              "Requires implementation before 13 May 2027",
            ],
            [
              "Billing records",
              "Retained after account closure where tax and accounting law requires it.",
              "Period not yet approved",
            ],
            [
              "Backups",
              "Deleted data ages out of backups on a rolling cycle.",
              "Window not yet approved",
            ],
          ],
        },
        { type: "placeholder", key: "retentionPeriods" },
        { type: "placeholder", key: "backupWindow" },
        {
          type: "note",
          tone: "info",
          title: "Why some periods are blank",
          text: "A retention period is a commitment that has to be enforced by a deletion job. Writing '12 months' here before that job exists would be a statement about a process that does not run.",
        },
      ],
      review:
        "Rule 8(3) of the DPDP Rules separately requires personal data, traffic data and processing logs to be kept for at least one year for the purposes in the Seventh Schedule. Assess whether Orindle's current log window meets that minimum, and whether the 30-day trash window interacts with it.",
    },
    {
      id: "rights",
      heading: "Your rights",
      gist: "What you can ask for, and how fast.",
      blocks: [
        {
          type: "p",
          text: "Under the DPDP Act you have the right to a summary of the personal data being processed and the processing activities (section 11), to correction, completion, updating and erasure (section 12), to grievance redressal (section 13), and to nominate someone to exercise your rights if you die or become incapacitated (section 14).",
        },
        {
          type: "p",
          text: "Rule 14 of the DPDP Rules requires Orindle to publish how to make these requests and what identifies you for the purpose. Your account email address is the identifier. Requests go through the contact form with the privacy subject, or by email.",
        },
        {
          type: "p",
          text: "Where GDPR or UK GDPR applies you also have the right to data portability, to object to processing, to restrict processing, to withdraw consent at any time, and to complain to a supervisory authority — the ICO in the UK, or the authority in your EU member state.",
        },
        {
          type: "p",
          text: "Rule 14(3) caps the grievance response period at ninety days. Orindle aims to answer much sooner, but ninety days is the outer limit it publishes.",
        },
        {
          type: "note",
          tone: "info",
          title: "What you can do yourself, right now",
          text: "Download any file or folder from the dashboard without asking. Trash is self-service. Erasure of an entire account currently requires a request, because there is no self-service delete-account flow yet.",
        },
      ],
    },
    {
      id: "consent",
      heading: "Withdrawing consent",
      gist: "As easy to withdraw as to give.",
      blocks: [
        {
          type: "p",
          text: "Rule 3(c)(i) of the DPDP Rules requires withdrawing consent to be as easy as giving it. Orindle meets this by putting withdrawal behind the same contact form used to give the data in the first place, rather than requiring a written letter.",
        },
        {
          type: "p",
          text: "Withdrawing consent for the core service means the account is closed and the data is deleted. Consent for a paid plan cannot be withdrawn in a way that leaves the plan running without the data that supports it; closing the account ends the subscription.",
        },
      ],
      review:
        "Confirm the interaction between consent withdrawal and any minimum subscription term before the cancellation policy is published.",
    },
    {
      id: "security",
      heading: "How we protect it",
      gist: "What is implemented, and what is not claimed.",
      blocks: [
        {
          type: "p",
          text: "Rule 6 of the DPDP Rules sets out minimum reasonable security safeguards. Orindle implements encryption at rest in object storage, TLS in transit, scoped short-lived credentials for every operation, per-request authorisation with database row-level security, and signature-verified payment webhooks.",
        },
        {
          type: "p",
          text: "Two things are deliberately not claimed. Orindle holds no SOC 2, ISO 27001 or HIPAA certification. Orindle does not offer end-to-end zero-knowledge encryption — the service can decrypt data in order to serve it to you.",
        },
        {
          type: "note",
          tone: "warning",
          title: "Gap against Rule 6(1)(e)",
          text: "The one-year retention of logs for detecting and investigating unauthorised access is required from 13 May 2027 and is not implemented yet. This is recorded here rather than omitted.",
        },
      ],
      review:
        "Verify that a one-year log retention window is actually in place, or record it as an open compliance item with an owner and a date.",
    },
    {
      id: "breach",
      heading: "If something goes wrong",
      gist: "How you would be told.",
      blocks: [
        {
          type: "p",
          text: "Under section 8(6) of the DPDP Act and Rule 7 of the DPDP Rules, a personal data breach is reported to the Data Protection Board of India without delay, and to each affected person in concise and plain language through their account or registered contact.",
        },
        {
          type: "p",
          text: "That notice would describe the nature, extent and timing of the breach, the consequences likely to affect you, what Orindle is doing about it, what you can do to protect yourself, and who to contact with questions.",
        },
        {
          type: "p",
          text: "Where GDPR applies, the additional 72-hour notification to a supervisory authority applies.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      gist: "The age question is open.",
      blocks: [
        {
          type: "p",
          text: "The DPDP Act treats anyone under eighteen as a child. Section 9 requires verifiable parental consent before processing a child's personal data, and prohibits tracking, behavioural monitoring and targeted advertising directed at children.",
        },
        { type: "placeholder", key: "minimumAge" },
        {
          type: "p",
          text: "Because Orindle does not run behavioural advertising, and because the service requires an email address and a payment method for paid plans, the practical question is whether to set the minimum age at eighteen or to build a parental-consent flow. That decision is open.",
        },
      ],
      review:
        "This is the single largest unresolved compliance question for a consumer storage product in India. Rule 10 sets out what verifiable parental consent would require.",
    },
    {
      id: "complaints",
      heading: "Complaints",
      gist: "Where to take a problem that support cannot fix.",
      blocks: [
        {
          type: "p",
          text: "Section 13(3) of the DPDP Act requires a grievance to be raised with Orindle before it is taken to the Data Protection Board. Orindle publishes a ninety-day outer limit for answering, in line with Rule 14(3).",
        },
        {
          type: "p",
          text: "If Orindle does not resolve a grievance, a complaint may be made to the Data Protection Board of India. In the UK, a complaint may be made to the Information Commissioner's Office; in the EEA, to your national supervisory authority.",
        },
        { type: "placeholder", key: "grievanceOfficer" },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      gist: "How a change reaches you.",
      blocks: [
        {
          type: "p",
          text: "The date at the top of this page is the date this draft last changed. A material change will be described on this page, and account holders will be told by email before it takes effect rather than after.",
        },
      ],
    },
  ],
};

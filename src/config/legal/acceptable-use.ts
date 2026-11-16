import type { LegalDocument } from "./types";

/**
 * Acceptable Use Policy — draft.
 *
 * Written to be enforceable, which means specific. "No illegal content" is not a
 * rule anybody can apply; a list of the categories Orindle will act on, plus the
 * process it follows, is.
 */
export const ACCEPTABLE_USE_POLICY: LegalDocument = {
  id: "acceptable-use",
  path: "/acceptable-use",
  title: "Acceptable Use Policy",
  summary:
    "What you can and cannot store, what happens when a line is crossed, and how to report something.",
  purpose: "The rules for content.",
  updated: "2026-11-16",
  sections: [
    {
      id: "principle",
      heading: "The principle",
      blocks: [
        {
          type: "p",
          text: "Orindle stores private files. What you keep there is your business, and Orindle does not scan, read or mine it. This policy exists only to name the narrow set of uses that would harm other people, harm the service, or break the law — and to be clear about what happens if one occurs.",
        },
      ],
    },
    {
      id: "prohibited",
      heading: "What you may not store or share",
      gist: "Eleven specific categories.",
      blocks: [
        {
          type: "list",
          items: [
            "Material that is illegal in India or in the country where you are located. Where laws differ, the stricter one applies to you.",
            "Child sexual abuse material. This is reported to the appropriate authorities wherever Orindle becomes aware of it, without notice to the account holder.",
            "Content that infringes another person's copyright, trademark or other intellectual property, when you do not have permission to store or share it.",
            "Other people's personal data that you have no lawful basis to hold — including stolen datasets, doxxing material, and records obtained without consent.",
            "Malware, ransomware, exploit kits, phishing kits, or command-and-control infrastructure.",
            "Content intended to defraud, including forged documents presented as genuine and financial scams.",
            "Terrorist or violent extremist material, or material that incites violence against a person or group.",
            "Non-consensual intimate imagery, including synthetic imagery of a real person created or shared without their consent.",
            "Content that sexually exploits or endangers a minor in any way.",
            "Material that harasses, threatens or stalks a specific person.",
            "Bulk unsolicited content distributed through shared links — storage used as a spam delivery mechanism.",
          ],
        },
      ],
    },
    {
      id: "technical",
      heading: "What you may not do to the service",
      gist: "Abuse of the platform itself.",
      blocks: [
        {
          type: "list",
          items: [
            "Attempt to access an account, folder or file you have not been given access to.",
            "Probe, scan or test the service for vulnerabilities without written permission. If you want to test something, write to support first — good-faith security research reported privately is welcome.",
            "Circumvent storage allowances, rate limits or plan restrictions, including by creating multiple free accounts to pool storage.",
            "Resell or rebrand the service as your own without a written agreement.",
            "Use automated means to create accounts or upload in bulk in a way that degrades the service for others.",
            "Introduce code intended to disable, overload or damage the service.",
          ],
        },
      ],
    },
    {
      id: "shared",
      heading: "Shared links and other people's access",
      blocks: [
        {
          type: "p",
          text: "A shared link is a public URL unless you set an expiry or a password. Anyone with the link can open it. You are responsible for who you send it to, and for turning it off when it is no longer needed.",
        },
        {
          type: "p",
          text: "If you share a folder with someone in a business workspace, removing them revokes their access going forward. Anything they already downloaded is outside Orindle's control, and this is stated on the sharing screen rather than buried here.",
        },
      ],
    },
    {
      id: "enforcement",
      heading: "What happens when a rule is broken",
      gist: "The escalation, in order.",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "Orindle tells you what the problem is and asks you to fix it, except where the law or the seriousness of the content requires immediate action.",
            "If it is not fixed, the specific content is removed or the account is suspended from uploading, so nothing else is affected.",
            "For a serious or repeated breach, the account is suspended entirely. Files are retained, not deleted, while the situation is resolved.",
            "For content that is illegal, Orindle may report it to law enforcement and preserve the relevant records, and will not give advance notice where doing so would obstruct an investigation.",
          ],
        },
        {
          type: "p",
          text: "Where an account is suspended under this policy, Orindle will still let you export your data if the suspension is later lifted, and will tell you how to appeal.",
        },
      ],
      review:
        "Under India's IT Act and the Intermediary Guidelines and Digital Media Ethics Code Rules 2021, a service that stores user content may have intermediary obligations including a published grievance mechanism and specified response windows. Confirm whether Orindle's storage service falls within the Rules' definition of an intermediary and, if so, build the required notice-and-takedown process.",
    },
    {
      id: "report",
      heading: "Reporting a violation",
      blocks: [
        {
          type: "p",
          text: "If you believe content on Orindle breaks this policy, report it through the contact form with the subject set to 'Something else', and include the shared link. Reports about child safety are prioritised and handled without delay.",
        },
        {
          type: "p",
          text: "If you are reporting a copyright infringement, include the work you own, the link to the material you say infringes it, and a statement that you have a good-faith belief the use is unauthorised.",
        },
        { type: "placeholder", key: "grievanceOfficer" },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "This policy is part of the Terms of Service. A material change is described here and notified to account holders before it takes effect.",
        },
      ],
    },
  ],
};

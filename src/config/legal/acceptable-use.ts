import type { LegalDocument } from "./types";

/**
 * Acceptable Use Policy — approved and published.
 */
export const ACCEPTABLE_USE_POLICY: LegalDocument = {
  id: "acceptable-use",
  path: "/acceptable-use",
  title: "Acceptable Use Policy",
  summary:
    "What you can and cannot store, what happens when a line is crossed, and how to report abuse.",
  purpose: "The rules for content.",
  updated: "2026-11-16",
  approved: true,
  sections: [
    {
      id: "principle",
      heading: "The principle",
      blocks: [
        {
          type: "p",
          text: "Orindle stores private files. What you keep there is your business, and Orindle does not mine your files for advertising or AI training. This policy names the narrow set of uses that harm other people, harm the service, or break the law — and states plainly how reports are handled.",
        },
      ],
    },
    {
      id: "prohibited",
      heading: "What you may not store or share",
      gist: "Eleven specific prohibited categories.",
      blocks: [
        {
          type: "list",
          items: [
            "Material that is illegal in India or in the country where you are located. Where laws differ, the stricter rule applies.",
            "Child sexual abuse material (CSAM). Reported immediately to the appropriate authorities wherever Orindle becomes aware of it, without notice to the account holder.",
            "Content that infringes another person's copyright, trademark or intellectual property without permission.",
            "Other people's personal data held without a lawful basis — including stolen datasets, doxxing material, and records obtained unlawfully.",
            "Malware, ransomware, exploit kits, phishing kits, or command-and-control infrastructure.",
            "Content intended to defraud, including forged documents presented as genuine and financial scams.",
            "Terrorist or violent extremist material, or material that incites violence against any person or group.",
            "Non-consensual intimate imagery, including synthetic imagery of a real person created or shared without consent.",
            "Content that sexually exploits or endangers a minor in any way.",
            "Material that harasses, threatens or stalks a specific person.",
            "Bulk unsolicited content or spam distributed through shared links.",
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
            "Attempt to access an account, organization, folder or file you have not been granted access to.",
            "Probe, scan or test the service for vulnerabilities without prior written permission. Responsible private vulnerability reports sent to tejassutar.business@gmail.com are welcome.",
            "Circumvent storage allowances, rate limits or plan restrictions, including creating multiple free accounts to pool storage.",
            "Resell or rebrand the service without a written agreement.",
            "Use automated tools to create accounts or upload in bulk in a way that degrades the service for others.",
            "Introduce code intended to disable, overload or damage the service.",
          ],
        },
      ],
    },
    {
      id: "shared",
      heading: "Shared links and organization access",
      blocks: [
        {
          type: "p",
          text: "A shared link grants access to anyone holding the URL until you revoke it or it expires. You are responsible for who receives your links and for turning them off when they are no longer needed.",
        },
        {
          type: "p",
          text: "In a Business workspace, removing a member revokes their future access immediately. Files they already downloaded to their own devices are outside Orindle's control.",
        },
      ],
    },
    {
      id: "enforcement",
      heading: "What happens when a rule is broken",
      gist: "Proportionate escalation, in order.",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "Where lawful and safe to do so, Orindle notifies you of the issue and asks you to resolve it.",
            "If unresolved, the offending shared link or content is disabled or uploads are paused while the rest of your account stays intact.",
            "For serious or repeated breaches, the account may be suspended while the issue is investigated.",
            "For illegal content — including CSAM or valid law-enforcement requests — Orindle removes access immediately, preserves relevant records as required by law, and reports to the appropriate authorities without advance notice where notice would obstruct an investigation.",
          ],
        },
        {
          type: "p",
          text: "If you believe an enforcement action was taken in error, write to tejassutar.business@gmail.com to appeal.",
        },
      ],
    },
    {
      id: "report",
      heading: "Reporting a violation or grievance",
      blocks: [
        {
          type: "p",
          text: "To report abuse, illegal content or a policy violation, use the contact form at orindle.com/contact or email tejassutar.business@gmail.com with the shared link and relevant details. Child-safety reports are prioritised immediately.",
        },
        {
          type: "p",
          text: "For copyright notices, identify the copyrighted work, include the exact Orindle link, and include a good-faith statement that the use is unauthorised. Grievances and takedown notices are acknowledged within 48 hours and resolved within one month (and faster where required by law).",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "This policy forms part of the Terms of Service. Material changes are posted on this page with an updated effective date and notified to account holders before they take effect.",
        },
      ],
    },
  ],
};

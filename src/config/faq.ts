/**
 * FAQ content.
 *
 * Content rules: every answer here describes something the product actually
 * does or a policy that has been decided. Questions whose policy is not yet
 * settled are answered by naming the open question and pointing at support
 * instead of inventing a rule.
 */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  /** Help article that covers this in more depth, when one exists. */
  helpSlug?: string;
}

export type FaqCategory = "Getting started" | "Storage & plans" | "Files & sharing" | "Privacy & security" | "Billing" | "Business";

export const FAQ_CATEGORIES: FaqCategory[] = [
  "Getting started",
  "Storage & plans",
  "Files & sharing",
  "Privacy & security",
  "Billing",
  "Business",
];

export const HOME_FAQ: FaqItem[] = [
  {
    id: "free-plan",
    question: "What do I get on the free plan?",
    answer:
      "10 GB of storage, shared across every device you sign in on, with folders, file sharing and trash recovery. No credit card is required at any point to start.",
    category: "Getting started",
    helpSlug: "how-storage-is-counted",
  },
  {
    id: "upgrade-later",
    question: "Can I move to a bigger plan later?",
    answer:
      "Yes. Plans are storage tiers on the same account, so upgrading keeps your folders, links and files exactly where they are. Only the available space changes.",
    category: "Storage & plans",
    helpSlug: "upgrade-a-plan",
  },
  {
    id: "storage-is-shared",
    question: "Is storage per device or per account?",
    answer:
      "Per account. Your allowance is one shared pool for everything in your library, whichever device you open it from.",
    category: "Storage & plans",
    helpSlug: "how-storage-is-counted",
  },
  {
    id: "billing-currency",
    question: "Which currency will I be charged in?",
    answer:
      "India is billed in INR and the United States in USD. Other regions are billed in USD until their local pricing is finalised. Once you subscribe, your billing currency stays fixed — changing your display currency in the site settings never changes what an existing subscription is charged.",
    category: "Billing",
    helpSlug: "find-an-invoice",
  },
  {
    id: "yearly-pricing",
    question: "Is there a yearly plan?",
    answer:
      "Annual pricing is not announced yet. The monthly and yearly switch exists so you can compare once it is, but until then every plan is priced monthly and no annual discount is applied.",
    category: "Billing",
    helpSlug: "upgrade-a-plan",
  },
  {
    id: "delete-recovery",
    question: "What happens when I delete a file?",
    answer:
      "Deleted items move to Trash, where they can be restored. Emptying the Trash is permanent, and any link you have already shared to that file stops working.",
    category: "Files & sharing",
    helpSlug: "recover-deleted-files",
  },
  {
    id: "sharing-links",
    question: "How does sharing work?",
    answer:
      "You can share a file or an entire folder by inviting people or by sending a link, and set whether recipients can view or edit. You can revoke access at any time.",
    category: "Files & sharing",
    helpSlug: "share-a-link",
  },
  {
    id: "encryption",
    question: "Is my data encrypted?",
    answer:
      "Files are encrypted in transit with TLS and encrypted at rest in object storage. Details of the architecture are on the Security page. Orindle does not yet hold third-party security certifications, and we do not claim any.",
    category: "Privacy & security",
    helpSlug: "keep-your-account-secure",
  },
];

export const ALL_FAQ: FaqItem[] = [
  ...HOME_FAQ,
  {
    id: "supported-devices",
    question: "Which devices and browsers are supported?",
    answer:
      "Orindle runs in any current browser on desktop, tablet and mobile, including Safari, Chrome, Firefox and Edge. No plugin or desktop install is needed to reach your files.",
    category: "Getting started",
    helpSlug: "understand-your-dashboard",
  },
  {
    id: "file-size",
    question: "Is there a maximum file size?",
    answer:
      "Files are uploaded directly to object storage rather than through the application server. Per-file limits are still being finalised and will be published before paid plans open for purchase.",
    category: "Files & sharing",
    helpSlug: "upload-your-first-file",
  },
  {
    id: "refunds",
    question: "What is the refund policy?",
    answer:
      "A refund policy has not been finalised yet, so we are not going to publish terms we may not honour. Until paid plans open, everything available is free. For a specific case, contact support and you will get a direct answer.",
    category: "Billing",
  },
  {
    id: "cancel",
    question: "Can I cancel a paid plan?",
    answer:
      "Plans are monthly with no lock-in. When you cancel, the account returns to the free 10 GB tier at the end of the current billing period rather than being cut off immediately.",
    category: "Billing",
    helpSlug: "cancel-a-subscription",
  },
  {
    id: "data-export",
    question: "Can I get my files out?",
    answer:
      "Yes. Your files remain yours: you can download individual files or your whole library at any time, and you can delete your data permanently. Orindle is not a place your files get stuck.",
    category: "Privacy & security",
    helpSlug: "close-your-account",
  },
  {
    id: "team-storage",
    question: "Does a business account share one storage pool?",
    answer:
      "A business account holds one organisation-level storage pool that team members draw from, with per-member folder permissions managed by an administrator.",
    category: "Business",
    helpSlug: "business-roles",
  },
  {
    id: "team-billing",
    question: "How is business billing handled?",
    answer:
      "Business plans are not published yet. Rather than guess at seat pricing, the Business page describes what the organisation account does today. Contact sales for a discussion about your team.",
    category: "Business",
    helpSlug: "business-roles",
  },
  {
    id: "support",
    question: "How do I reach a human?",
    answer:
      "Use the contact form or email tejassutar.business@gmail.com. Every message is read, and support replies directly rather than sending an automated acknowledgement.",
    category: "Getting started",
    helpSlug: "create-your-account",
  },
];

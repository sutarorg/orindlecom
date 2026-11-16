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
      "Your currency is set automatically from your location across our 8 supported currencies: INR (India), USD (United States), GBP (United Kingdom), EUR (Eurozone), AED (UAE), SGD (Singapore), AUD (Australia) and CAD (Canada). If your country does not match one of these currencies, prices default to USD. Currencies cannot be manually switched, and once you subscribe your billing currency stays fixed.",
    category: "Billing",
    helpSlug: "find-an-invoice",
  },
  {
    id: "yearly-pricing",
    question: "Is there a yearly plan?",
    answer:
      "Yes. Every paid plan is available on monthly or annual billing, and paying annually saves 20% compared to twelve monthly payments.",
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
      "No fixed per-file cap. Files upload directly from your browser to object storage (using multipart upload for large files) and are bounded only by your remaining storage quota.",
    category: "Files & sharing",
    helpSlug: "upload-your-first-file",
  },
  {
    id: "refunds",
    question: "What is the refund policy?",
    answer:
      "Subscriptions are billed in advance and non-refundable except where required by applicable law, for verified duplicate charges, or for confirmed billing errors. See our Terms of Service or contact tejassutar.business@gmail.com for billing assistance.",
    category: "Billing",
  },
  {
    id: "cancel",
    question: "Can I cancel a paid plan?",
    answer:
      "Yes, with no lock-in. When you cancel, your paid allowance stays active through the end of the current billing period, after which the account returns to the free 10 GB tier without deleting any files.",
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
      "Business workspaces inherit the organisation owner's active storage plan (from 10 GB Free up to 5 TB Max) with no separate per-seat fee. Manage your workspace plan from Dashboard → Billing.",
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

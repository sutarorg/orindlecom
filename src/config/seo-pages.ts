/**
 * Approved page metadata.
 *
 * Every value here was supplied as the approved SEO configuration and is used
 * verbatim — a title is not "improved" on its way into the build. The only thing
 * added at render time is the ` · Orindle` suffix from the root layout's title
 * template, so the supplied string is always the leading part of the title.
 *
 * `metaKeywords` is carried because it was requested. It is worth being honest in
 * the accompanying document: Google has ignored the keywords meta tag since 2009,
 * and no major engine uses it for ranking. It is emitted because a stakeholder
 * asked for it and because some non-Google crawlers and internal search tools read
 * it — not because it does anything for rankings.
 */

export interface PageSeo {
  /** Route path, used for the canonical. */
  path: string;
  /** Approved HTML title, without the brand suffix. */
  title: string;
  /** Approved meta description. */
  description: string;
  /** Approved primary target keyword. */
  primaryKeyword: string;
  /** Approved secondary target keywords. */
  secondaryKeywords: string[];
  /** Approved keywords meta tag contents. */
  metaKeywords: string[];
  /** The page's H1, kept next to the metadata so the two are reviewed together. */
  h1: string;
}

export const PAGE_SEO = {
  home: {
    path: "/",
    title: "Secure Cloud Storage with 10 GB Free",
    description:
      "Store and share files securely with Orindle Cloud. Get 10 GB free with encrypted storage, fast uploads and downloads, and flexible plans that grow with you.",
    primaryKeyword: "cloud storage",
    secondaryKeywords: [
      "online cloud storage",
      "file storage online",
      "personal cloud storage",
      "secure file storage",
      "online file sharing",
      "cloud storage service",
      "free cloud storage",
      "cloud storage for individuals",
    ],
    metaKeywords: [
      "cloud storage",
      "online cloud storage",
      "file storage online",
      "personal cloud storage",
      "secure file storage",
      "online file sharing",
      "free cloud storage",
      "cloud storage service",
      "cloud storage platform",
    ],
    h1: "Your files. Your world. One simple place.",
  },

  pricing: {
    path: "/pricing",
    title: "Cloud Storage Plans & Pricing",
    description:
      "Compare Orindle cloud storage plans from 10 GB free to 5 TB. Explore affordable monthly and annual storage options across 8 currencies for personal and business use.",
    primaryKeyword: "cloud storage pricing",
    secondaryKeywords: [
      "cloud storage plans",
      "affordable cloud storage",
      "cheap cloud storage",
      "online storage plans",
      "100 GB cloud storage",
      "500 GB cloud storage",
      "1 TB cloud storage",
      "5 TB cloud storage",
    ],
    metaKeywords: [
      "cloud storage pricing",
      "cloud storage plans",
      "affordable cloud storage",
      "cheap cloud storage",
      "online storage plans",
      "100GB cloud storage",
      "500GB cloud storage",
      "1TB cloud storage",
      "5TB cloud storage",
    ],
    h1: "Room for every kind of digital life.",
  },

  features: {
    path: "/features",
    title: "Cloud Storage Features for Files & Sharing",
    description:
      "Discover Orindle cloud storage features for organizing, accessing and sharing files. Explore simple file management for personal and business use.",
    primaryKeyword: "cloud storage features",
    secondaryKeywords: [
      "file management",
      "cloud file sharing",
      "online file storage",
      "cloud folder management",
      "file access across devices",
      "digital file organization",
      "cloud storage tools",
    ],
    metaKeywords: [
      "cloud storage features",
      "file management",
      "cloud file sharing",
      "online file storage",
      "cloud folder management",
      "digital file organization",
      "cloud storage tools",
      "file access",
    ],
    h1: "Everything you need. Nothing you don't.",
  },

  security: {
    path: "/security",
    title: "Cloud Storage Security & Privacy",
    description:
      "Learn how Orindle approaches cloud storage security, account protection, file access and privacy. Explore the safeguards and policies behind your files.",
    primaryKeyword: "cloud storage security",
    secondaryKeywords: [
      "secure cloud storage",
      "cloud storage privacy",
      "file security",
      "secure online file storage",
      "cloud data protection",
      "file access permissions",
      "cloud storage protection",
    ],
    metaKeywords: [
      "cloud storage security",
      "secure cloud storage",
      "cloud storage privacy",
      "file security",
      "secure online file storage",
      "cloud data protection",
      "file access permissions",
    ],
    h1: "Your files deserve thoughtful protection.",
  },

  business: {
    path: "/business",
    title: "Business Cloud Storage for Teams",
    description:
      "Explore business cloud storage with Orindle. Organize company files, manage team access and share folders with a cloud storage workspace built for teams.",
    primaryKeyword: "business cloud storage",
    secondaryKeywords: [
      "cloud storage for business",
      "team file storage",
      "business file sharing",
      "cloud storage for teams",
      "company file storage",
      "shared business folders",
      "online business storage",
    ],
    metaKeywords: [
      "business cloud storage",
      "cloud storage for business",
      "team file storage",
      "business file sharing",
      "cloud storage for teams",
      "company file storage",
      "shared business folders",
    ],
    h1: "A simpler space for your team's files.",
  },

  about: {
    path: "/about",
    title: "About Us",
    description:
      "Discover Orindle, a cloud storage platform designed to make storing, organizing, accessing and sharing digital files simpler for individuals and teams.",
    primaryKeyword: "Orindle cloud storage",
    secondaryKeywords: [
      "about Orindle",
      "Orindle cloud storage",
      "online storage platform",
      "cloud storage company",
      "digital file storage",
    ],
    metaKeywords: [
      "Orindle",
      "Orindle cloud storage",
      "online storage platform",
      "cloud storage company",
      "digital file storage",
      "file storage platform",
    ],
    h1: "A simpler way to keep everything together.",
  },

  contact: {
    path: "/contact",
    title: "Contact Us",
    description:
      "Contact Orindle for cloud storage questions, account assistance, business enquiries and support. Send your message to the Orindle team.",
    primaryKeyword: "contact Orindle",
    secondaryKeywords: [
      "Orindle support",
      "cloud storage support",
      "cloud storage help",
      "file storage customer support",
      "business enquiries",
    ],
    metaKeywords: [
      "contact Orindle",
      "Orindle support",
      "cloud storage support",
      "cloud storage help",
      "file storage customer support",
      "business enquiries",
    ],
    h1: "We're here to help.",
  },

  faq: {
    path: "/faq",
    title: "Cloud Storage FAQs",
    description:
      "Find answers to common Orindle cloud storage questions about plans, storage limits, file management, sharing, accounts and billing.",
    primaryKeyword: "cloud storage FAQ",
    secondaryKeywords: [
      "cloud storage questions",
      "online storage FAQ",
      "cloud storage plans FAQ",
      "file sharing questions",
      "cloud storage help",
      "storage limits",
    ],
    metaKeywords: [
      "cloud storage FAQ",
      "cloud storage questions",
      "online storage FAQ",
      "cloud storage plans FAQ",
      "file sharing questions",
      "cloud storage help",
      "storage limits",
    ],
    h1: "Frequently asked questions.",
  },

  help: {
    path: "/help",
    title: "Help Center",
    description:
      "Get help using Orindle. Find guides and answers about cloud storage, uploading files, managing folders, sharing files and managing your account.",
    primaryKeyword: "Orindle help center",
    secondaryKeywords: [
      "cloud storage help",
      "file upload help",
      "file sharing help",
      "cloud storage guides",
      "online storage support",
      "Orindle support",
    ],
    metaKeywords: [
      "Orindle help center",
      "cloud storage help",
      "file upload help",
      "file sharing help",
      "cloud storage guides",
      "online storage support",
      "Orindle support",
    ],
    h1: "How can we help?",
  },

  legal: {
    path: "/legal",
    title: "Legal Information & Policies",
    description:
      "Read Orindle's legal information, policies and important terms covering the use of its cloud storage website and services.",
    primaryKeyword: "Orindle legal policies",
    secondaryKeywords: [
      "Orindle legal",
      "cloud storage terms",
      "online storage policies",
      "service policies",
    ],
    metaKeywords: [
      "Orindle legal",
      "Orindle legal policies",
      "cloud storage terms",
      "online storage policies",
      "service policies",
    ],
    h1: "Legal information and policies.",
  },

  privacy: {
    path: "/privacy",
    title: "Privacy Policy",
    description:
      "Read the Orindle Privacy Policy to understand how personal information is collected, used, stored, protected and managed when using our services.",
    primaryKeyword: "Orindle privacy policy",
    secondaryKeywords: [
      "cloud storage privacy policy",
      "online storage privacy",
      "data privacy",
      "personal information protection",
      "user data policy",
    ],
    metaKeywords: [
      "Orindle privacy policy",
      "cloud storage privacy policy",
      "online storage privacy",
      "data privacy",
      "personal information protection",
      "user data policy",
    ],
    h1: "Privacy Policy.",
  },

  terms: {
    path: "/terms",
    title: "Terms of Service",
    description:
      "Review the Orindle Terms of Service for information about accounts, subscriptions, payments, file storage, acceptable use and service conditions.",
    primaryKeyword: "Orindle terms of service",
    secondaryKeywords: [
      "cloud storage terms",
      "online storage terms",
      "service agreement",
      "subscription terms",
      "file storage conditions",
    ],
    metaKeywords: [
      "Orindle terms of service",
      "cloud storage terms",
      "online storage terms",
      "service agreement",
      "subscription terms",
      "file storage conditions",
    ],
    h1: "Terms of Service.",
  },

  cookies: {
    path: "/cookies",
    title: "Cookie Policy",
    description:
      "Learn how Orindle uses cookies and similar technologies, what they are used for and how you can manage your cookie preferences.",
    primaryKeyword: "Orindle cookie policy",
    secondaryKeywords: [
      "cookie policy",
      "website cookies",
      "cookie preferences",
      "tracking technologies",
      "online privacy",
    ],
    metaKeywords: [
      "Orindle cookie policy",
      "cookie policy",
      "website cookies",
      "cookie preferences",
      "tracking technologies",
      "online privacy",
    ],
    h1: "Cookie Policy.",
  },

  acceptableUse: {
    path: "/acceptable-use",
    title: "Acceptable Use Policy",
    description:
      "Read Orindle's Acceptable Use Policy and understand the rules for accounts, cloud storage, file uploads, sharing and responsible use of our services.",
    primaryKeyword: "Orindle acceptable use policy",
    secondaryKeywords: [
      "cloud storage acceptable use",
      "file sharing rules",
      "online storage policy",
      "prohibited content policy",
      "account usage policy",
    ],
    metaKeywords: [
      "Orindle acceptable use policy",
      "cloud storage acceptable use",
      "file sharing rules",
      "online storage policy",
      "prohibited content policy",
      "account usage policy",
    ],
    h1: "Acceptable Use Policy.",
  },

  dataDeletion: {
    path: "/data-deletion",
    title: "Data Deletion Policy",
    description:
      "Understand how to request Orindle account deletion, what happens to stored files and personal information, and how the data deletion process works.",
    primaryKeyword: "Orindle data deletion",
    secondaryKeywords: [
      "delete cloud storage account",
      "cloud storage data deletion",
      "delete online files",
      "account deletion policy",
      "personal data removal",
    ],
    metaKeywords: [
      "Orindle data deletion",
      "delete cloud storage account",
      "cloud storage data deletion",
      "delete online files",
      "account deletion policy",
      "personal data removal",
    ],
    h1: "Your data. Your choice.",
  },

  blog: {
    path: "/blog",
    title: "Cloud Storage Guides, Comparisons & Tips",
    description:
      "Explore cloud storage guides, comparison articles, file management tips and practical advice about online storage, Google Drive alternatives and file sharing.",
    primaryKeyword: "cloud storage blog",
    secondaryKeywords: [
      "cloud storage guides",
      "cloud storage tips",
      "Google Drive alternatives",
      "cloud storage comparisons",
      "file management guides",
      "online storage tips",
      "cloud storage advice",
    ],
    metaKeywords: [
      "cloud storage blog",
      "cloud storage guides",
      "cloud storage tips",
      "Google Drive alternatives",
      "cloud storage comparisons",
      "file management guides",
      "online storage tips",
    ],
    h1: "Ideas for a more organized digital life.",
  },
} as const satisfies Record<string, PageSeo>;

export type PageSeoKey = keyof typeof PAGE_SEO;

/** Every indexable route, in the order they appear in the sitemap. */
export const INDEXABLE_PAGES: PageSeo[] = [
  PAGE_SEO.home,
  PAGE_SEO.pricing,
  PAGE_SEO.features,
  PAGE_SEO.security,
  PAGE_SEO.business,
  PAGE_SEO.about,
  PAGE_SEO.contact,
  PAGE_SEO.faq,
  PAGE_SEO.help,
  PAGE_SEO.legal,
  PAGE_SEO.privacy,
  PAGE_SEO.terms,
  PAGE_SEO.cookies,
  PAGE_SEO.acceptableUse,
  PAGE_SEO.dataDeletion,
  PAGE_SEO.blog,
];

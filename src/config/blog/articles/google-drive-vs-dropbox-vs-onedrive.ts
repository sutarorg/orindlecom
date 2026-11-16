import type { BlogArticle } from "../types";

export const googleDriveVsDropboxVsOneDrive: BlogArticle = {
  slug: "google-drive-vs-dropbox-vs-onedrive",
  title: "Google Drive vs Dropbox vs OneDrive: Which Cloud Storage Is Best?",
  metaTitle: "Google Drive vs Dropbox vs OneDrive: Comparison",
  metaDescription:
    "Compare Google Drive, Dropbox and OneDrive by storage, sharing, pricing, integrations, privacy and usability to find the right cloud storage service.",
  primaryKeyword: "Google Drive vs Dropbox vs OneDrive",
  secondaryKeywords: [
    "Dropbox vs Google Drive",
    "OneDrive vs Google Drive",
    "best cloud storage comparison",
    "Dropbox vs OneDrive",
    "cloud storage services comparison",
    "online file storage",
  ],
  metaKeywords: [
    "Google Drive vs Dropbox vs OneDrive",
    "Dropbox vs Google Drive",
    "OneDrive vs Google Drive",
    "best cloud storage comparison",
    "Dropbox vs OneDrive",
    "cloud storage services comparison",
  ],
  summary:
    "Three services, three different products. What actually separates them, beyond the storage number on the pricing page.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 90,
  factsChecked: "14 November 2026",
  image: {
    src: "/images/blog/google-drive-vs-dropbox-vs-onedrive.webp",
    width: 1200,
    height: 675,
    alt: "Three abstract file-storage environments shown side by side in balanced editorial composition, each with original geometric iconography",
  },
  related: ["best-google-drive-alternatives", "best-free-cloud-storage", "best-cloud-storage-for-small-business"],
  faqs: [
    {
      question: "Which of the three is cheapest for 2 TB?",
      answer:
        "At 2 TB the prices are close: Google One and iCloud have both been listed at $9.99 a month, and Dropbox Plus has been listed at $9.99 a month billed annually or $11.99 billed monthly. Confirm on each provider's page before buying — this is the tier that changes most often.",
    },
    {
      question: "Which has the best free plan?",
      answer:
        "Google's, at up to 15 GB, though it is shared with Gmail and Photos and new accounts in some regions start at 5 GB until phone verification. OneDrive gives 5 GB and Dropbox 2 GB.",
    },
    {
      question: "Can I use more than one?",
      answer:
        "Yes, and many people do — OneDrive because it came with Office, Drive because of a shared document, Dropbox because a client sends links. The cost is fragmentation: you now have three places to look.",
    },
  ],
  body: [
    {
      type: "p",
      text: "These three are compared constantly and the comparisons usually come down to a storage number. That number matters less than it looks. All three are competent file storage; the differences that decide the choice are what each one is bundled with, how its sharing behaves with people outside your organisation, and how much of your working life already lives in the same company's ecosystem.",
    },
    {
      type: "note",
      tone: "info",
      text: "Prices and allowances below were checked on 14 November 2026 in USD. This tier of the market reprices regularly; treat every figure as a snapshot with a date on it.",
    },
    { type: "h2", id: "storage", text: "Storage and what you actually get" },
    {
      type: "table",
      caption: "Headline allowances, checked 14 November 2026.",
      head: ["", "Google Drive", "Dropbox", "OneDrive"],
      rows: [
        ["Free", "Up to 15 GB, shared with Gmail and Photos; new accounts in some regions 5 GB until phone verification", "2 GB", "5 GB"],
        ["Cheapest paid", "~100 GB tier", "2 TB on Plus", "100 GB standalone"],
        ["Bundled with", "Docs, Sheets, Slides, Gmail", "Nothing — storage only", "Microsoft 365 apps on Personal and above"],
        ["Max file size (paid)", "Very large per-file cap", "Very large per-file cap", "250 GB per file"],
        ["Free-tier device limits", "None stated", "Limited concurrent signed-in devices", "None stated"],
      ],
    },
    {
      type: "p",
      text: "The shared-quota detail is the one people underestimate. Google's 15 GB covers Gmail and Google Photos, so a mailbox you have not cleaned since 2016 is consuming the storage you thought you had for files. OneDrive's free 5 GB sits alongside a separate Outlook.com mailbox allowance, which is a distinction worth understanding before assuming you have less room than you do. Dropbox's 2 GB is dedicated to files and nothing else — accurate, and still the smallest number here.",
    },
    { type: "h2", id: "sharing", text: "Sharing and collaboration" },
    {
      type: "p",
      text: "Google's sharing model is the most frictionless of the three for documents, because the document is the product. You can hand someone a link and they are editing in a browser within seconds, with no account prompt in the common case. That is the feature people miss most when they leave.",
    },
    {
      type: "p",
      text: "Dropbox sharing is built around files and folders rather than documents, and its advanced link controls — passwords, expiry dates, download permissions — are a paid-tier feature rather than something free accounts get. If your work is delivering large files to clients rather than co-editing a paragraph, Dropbox's model is the better fit.",
    },
    {
      type: "p",
      text: "OneDrive's sharing is strongest inside an organisation that already runs Microsoft 365: permissions follow the tenant, external sharing is governed by admin policy, and the co-authoring experience in Office files is native. Outside that context it is functional but more bureaucratic than Drive.",
    },
    { type: "h2", id: "sync-desktop", text: "Desktop and mobile experience" },
    {
      type: "list",
      items: [
        "**Dropbox** has the most reliable sync engine of the three, and it is the one thing reviewers consistently agree on. Selective sync and conflict handling are mature.",
        "**OneDrive** is built into Windows 11 — no install, folder backup offered during setup, and Files On-Demand works well. The macOS client is competent but a second-class citizen.",
        "**Google Drive** has a solid desktop app and the best browser experience. Its mobile apps are excellent, particularly for photo backup, which is also why the quota fills up.",
      ],
    },
    { type: "h2", id: "integrations", text: "Integrations" },
    {
      type: "p",
      text: "This is where the decision is often already made. Google Drive integrates with the Google workspace and a wide set of third-party tools through its APIs. OneDrive integrates with Microsoft 365, Teams, Power Automate and Windows itself. Dropbox integrates with a long list of productivity tools — Slack, Notion, Asana and others — and is often the lowest-friction option when the tool you use has one cloud storage integration and it is Dropbox.",
    },
    { type: "h2", id: "privacy", text: "Privacy and account considerations" },
    {
      type: "p",
      text: "All three encrypt data in transit and at rest, and all three hold the keys for that at-rest encryption — meaning the provider can technically access your files, and all three have processes that do so for abuse detection, search indexing or feature development. The meaningful differences are about process and jurisdiction rather than cryptography: Google's scale means automated scanning, Microsoft's is governed by enterprise compliance tooling and default-on content scanning in some consumer features, and Dropbox's is comparatively narrower in scope because it has fewer products to feed.",
    },
    {
      type: "p",
      text: "If the requirement is that the provider cannot read your files, none of these three is the answer at consumer prices. End-to-end encrypted providers — Proton Drive, Sync.com, MEGA's default encryption, or pCloud's paid Crypto add-on — are the category you want. [Our guide to whether cloud storage is safe](/blog/is-cloud-storage-safe) covers what that distinction does and does not protect you from.",
    },
    { type: "h2", id: "recommendations", text: "Use-case recommendations" },
    {
      type: "list",
      items: [
        "**You write documents with other people all day:** Google Drive. Nothing else is as frictionless, and the storage is a secondary benefit.",
        "**You already pay for Microsoft 365:** OneDrive, without much deliberation. The 1 TB is included and the Office apps are the reason you are paying.",
        "**You send large files to clients for a living:** Dropbox, for its link controls and sync reliability.",
        "**You need one of them to be cheap at 100 GB and you use Windows:** OneDrive's standalone 100 GB tier.",
        "**You want a small number of simple monthly plans and no ecosystem:** that is the gap Orindle is built for — [six plans, published in full](/pricing), no annual commitment.",
      ],
    },
    { type: "h2", id: "verdict", text: "Is one of them best?" },
    {
      type: "p",
      text: "No — and any article that names a single winner without asking what you do all day is guessing. Google Drive wins for document collaboration, OneDrive wins for Microsoft 365 households and organisations, and Dropbox wins for file delivery and sync under load. If you are choosing between them, the honest shortcut is to look at which ecosystem already holds your work and pick the storage that ships with it. The switching cost is real, and it is usually larger than the price difference.",
    },
    { type: "h2", id: "sources", text: "Sources" },
    {
      type: "source",
      label: "Google One — plans",
      href: "https://one.google.com/about/plans",
    },
    {
      type: "source",
      label: "Dropbox — plans and link controls",
      href: "https://www.dropbox.com/plans",
    },
    {
      type: "source",
      label: "Microsoft — OneDrive plan comparison",
      href: "https://www.microsoft.com/microsoft-365/onedrive/compare-onedrive-plans",
    },
  ],
};

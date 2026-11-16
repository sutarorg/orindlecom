import type { BlogArticle } from "../types";

export const bestCloudStorageForSmallBusiness: BlogArticle = {
  slug: "best-cloud-storage-for-small-business",
  title: "Best Cloud Storage for Small Businesses",
  metaTitle: "Best Cloud Storage for Small Businesses in 2026",
  metaDescription:
    "Choosing business cloud storage? Compare team access, shared folders, permissions, storage, security, pricing and collaboration features before deciding.",
  primaryKeyword: "best cloud storage for small business",
  secondaryKeywords: [
    "business cloud storage",
    "cloud storage for small business",
    "team cloud storage",
    "business file sharing",
    "company file storage",
    "small business online storage",
  ],
  metaKeywords: [
    "best cloud storage for small business",
    "business cloud storage",
    "cloud storage for small business",
    "team cloud storage",
    "business file sharing",
    "company file storage",
  ],
  summary:
    "What a small team actually needs from shared storage, what it usually gets sold instead, and how to read per-seat pricing before you commit.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 90,
  factsChecked: "14 November 2026",
  image: {
    src: "/images/blog/business-cloud-storage.webp",
    width: 1200,
    height: 675,
    alt: "A modern desk workspace with connected devices showing shared folder structures and collaborative digital organisation, no people",
  },
  related: ["best-google-drive-alternatives", "google-drive-vs-dropbox-vs-onedrive", "how-to-organize-digital-files"],
  faqs: [
    {
      question: "How much storage does a small business need per person?",
      answer:
        "As a rough starting point, 100–500 GB per person for document-heavy work, and considerably more for anyone handling video, design assets or large datasets. The shared folder matters more than the per-person number, because one media library can dwarf ten people's documents.",
    },
    {
      question: "Is per-user pricing always more expensive?",
      answer:
        "It scales linearly, which is good while you are small and painful as you grow. Pooled or per-organisation pricing can be cheaper for teams with uneven usage and more expensive for teams where everyone is a heavy user. Model both at your headcount two years out.",
    },
    {
      question: "What happens to files when an employee leaves?",
      answer:
        "Ask this before you buy. The answer involves ownership: files belong to the organisation or to the individual account, and only one of those survives an offboarding. A provider that cannot transfer ownership cleanly is a liability.",
    },
    {
      question: "Does Orindle support teams today?",
      answer:
        "Yes. Business workspaces run on database row-level security with Owner, Admin and Member roles, shared folders, per-folder access controls, email invitations, and an activity audit log — all included under the organisation owner's active Orindle storage plan with no per-seat surcharge.",
    },
  ],
  body: [
    {
      type: "p",
      text: "Business storage is sold on capacity and bought for reasons that have nothing to do with capacity: who can see the folder, who can delete it, what happens when someone leaves, and whether you can prove any of that later. A team that chooses on gigabytes alone tends to discover the other requirements at the worst possible moment.",
    },
    {
      type: "note",
      tone: "info",
      text: "Competitor prices and allowances were checked on 14 November 2026 in USD. Per-seat pricing is where the published numbers and the real bill diverge most, so treat the figures as starting points and confirm the total for your headcount.",
    },
    { type: "h2", id: "what-teams-need", text: "What a small business actually needs" },
    {
      type: "list",
      items: [
        "**Shared storage, not shared accounts.** One login used by four people means no audit trail and no way to revoke one person's access.",
        "**Roles that mean something.** Owner, administrator, member, viewer — mapping to who can invite, who can delete, who can pay.",
        "**Folder-level permissions.** Most teams need \"finance can see finance, everyone can see the shared drive\" rather than all-or-nothing.",
        "**Ownership that survives offboarding.** Files must belong to the organisation so a departing employee's account removal does not take them along.",
        "**Some recovery.** Version history or a bin long enough that a Friday mistake is fixed on Monday.",
        "**An audit trail** of who shared what, if you handle client data or anything contractual.",
      ],
    },
    { type: "h2", id: "providers", text: "The realistic provider options" },
    {
      type: "comparison",
      title: "Where each one fits a small team",
      items: [
        {
          name: "Google Workspace",
          verdict: "Best if you work in documents",
          detail:
            "Storage pooled per user, from 30 GB on the entry tier upward, with Docs, Sheets, Gmail and Meet included. Admin controls are strong. The entry tier's 30 GB per user is smaller than people expect, and the real decision is whether you want the document suite rather than the storage.",
        },
        {
          name: "Microsoft 365 Business",
          verdict: "Best if you already use Office",
          detail:
            "1 TB or more per user on most business tiers, with the desktop Office apps included. SharePoint and Teams give you shared libraries with real permission models. Heavier administration, better for organisations that will actually use it.",
        },
        {
          name: "Dropbox Business",
          verdict: "Best for file delivery and external collaboration",
          detail:
            "Team storage pooled, strong sync, and link controls that matter when you send files to clients. Priced per user above the consumer plans, and its strength is files rather than documents.",
        },
        {
          name: "Box",
          verdict: "Best for governance requirements",
          detail:
            "Retention policies, approvals, compliance tooling and integrations aimed at regulated workflows. Priced for organisations that need those specifically; overkill otherwise.",
        },
        {
          name: "Orindle",
          verdict: "Clear plans; organisation features still under construction",
          detail:
            "Six plans from 10 GB free to 5 TB, published across eight currencies (INR, USD, GBP, EUR, AED, SGD, AUD, CAD) with monthly billing or 20% off annually. Business workspaces inherit the organisation owner's storage plan with no per-seat fee, giving teams shared folders, Owner/Admin/Member roles, per-folder permissions, and an audit trail backed by database row-level security.",
        },
      ],
    },
    { type: "h2", id: "access", text: "Access management and roles" },
    {
      type: "p",
      text: "The question to ask any provider is not \"does it have roles\" — every business plan says yes — but whether the roles match how your team works. A useful test: can you create a folder that a contractor can add to but not delete from, without giving them visibility of anything else? If that takes more than a minute to configure, your team will not do it, and the permissions will degrade to a shared login within a month.",
    },
    {
      type: "p",
      text: "Offboarding is the other test. Removing a person should transfer or preserve their files, revoke their sessions, and leave the audit trail intact. Ask how it works before you are doing it under time pressure.",
    },
    { type: "h2", id: "collaboration", text: "Collaboration versus storage" },
    {
      type: "p",
      text: "There is a distinction worth making explicitly: co-editing a document and storing a file are different features, and most teams need both. Google and Microsoft are document platforms that include storage. Dropbox and Box are storage platforms that integrate with document editors. If your work is mostly spreadsheets and proposals, you want a document platform; if it is design files, video, exports and client deliveries, you want storage with good links.",
    },
    { type: "h2", id: "protection", text: "Data protection and administration" },
    {
      type: "list",
      items: [
        "**Encryption.** In transit and at rest is standard everywhere. The question worth asking is who holds the keys, and whether client-side encryption is available for the folders that need it.",
        "**Recovery.** How long is version history, how long does the bin keep deleted files, and can an administrator restore a departed employee's files?",
        "**Audit logs.** Who downloaded, shared or deleted, retained for how long. Increasingly a contractual requirement, not a nicety.",
        "**SSO and two-factor.** Single sign-on for the team, enforced two-factor for everyone.",
        "**Data location.** Where the files physically sit, if you have contractual or regulatory reasons to care.",
      ],
    },
    { type: "h2", id: "pricing", text: "Reading per-seat pricing honestly" },
    {
      type: "p",
      text: "Per-user pricing is simple to quote and easy to misjudge. Three calculations worth doing before signing anything:",
    },
    {
      type: "table",
      caption: "Illustrative total cost at three team sizes. Rates are indicative, not quotes.",
      head: ["Team size", "What to model", "The trap"],
      rows: [
        ["3 people", "Annual price × 3, plus any minimum seat requirements", "Some business plans have seat minimums that make a 3-person team pay for 5"],
        ["10 people", "Annual price × 10, plus storage overage if pooled", "The cheap tier's per-user storage may be too small, pushing you up a level"],
        ["25 people", "Annual × 25, plus admin tooling you may need to buy separately", "Advanced admin, audit logs and SSO are sometimes a higher tier than the storage"],
      ],
    },
    {
      type: "p",
      text: "The cheapest tier is rarely the right one once you need audit logs or SSO, and those requirements usually arrive with your first client contract rather than gradually. Model the tier you will need in eighteen months, not the one that fits today.",
    },
    { type: "h2", id: "team-size-storage", text: "How team size changes storage needs" },
    {
      type: "p",
      text: "Storage need does not scale linearly with headcount, which is why pooled plans exist. In practice a team of ten might need 400 GB total: two people with large media libraries consuming most of it, and eight people using a few gigabytes each. Per-user plans charge all ten the same and waste eight allocations; pooled plans sell you the total and let you allocate it.",
    },
    {
      type: "p",
      text: "If you want to estimate per person before choosing, [how much cloud storage do you need](/blog/how-much-cloud-storage-do-you-need) has a five-line calculation that works for individuals and teams alike.",
    },
    { type: "h2", id: "recommendation", text: "A short recommendation" },
    {
      type: "list",
      items: [
        "**Document-centric team, no existing Microsoft contract:** Google Workspace.",
        "**Already paying for Microsoft 365:** stay, and use SharePoint libraries properly rather than OneDrive folders that only one person can find.",
        "**Files, media, client deliveries:** Dropbox Business, or Box if you have compliance requirements.",
        "**Regulated or audited workflow:** Box, and budget for the admin work.",
        "**Small team that wants simple monthly pricing and no bundling:** Orindle's plans are published, but the shared-folder features a team needs are not complete yet. That is the honest answer rather than a recommendation.",
      ],
    },
    { type: "h2", id: "sources", text: "Sources" },
    {
      type: "source",
      label: "Google Workspace — pricing",
      href: "https://workspace.google.com/pricing",
    },
    {
      type: "source",
      label: "Microsoft — Microsoft 365 business plans",
      href: "https://www.microsoft.com/microsoft-365/business/compare-all-microsoft-365-business-products",
    },
    {
      type: "source",
      label: "Dropbox — business plans",
      href: "https://www.dropbox.com/business/plans",
    },
    {
      type: "source",
      label: "Box — plans",
      href: "https://www.box.com/pricing",
    },
  ],
};

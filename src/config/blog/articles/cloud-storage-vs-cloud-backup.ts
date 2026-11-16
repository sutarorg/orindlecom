import type { BlogArticle } from "../types";

export const cloudStorageVsCloudBackup: BlogArticle = {
  slug: "cloud-storage-vs-cloud-backup",
  title: "Cloud Storage vs Cloud Backup: What's the Difference?",
  metaTitle: "Cloud Storage vs Cloud Backup: Key Differences Explained",
  metaDescription:
    "Understand cloud storage vs cloud backup, including file syncing, recovery, version history, data protection and when you may need both services.",
  primaryKeyword: "cloud storage vs cloud backup",
  secondaryKeywords: [
    "cloud backup vs cloud storage",
    "online file backup",
    "cloud data backup",
    "file synchronization",
    "cloud backup services",
    "backup and storage differences",
  ],
  metaKeywords: [
    "cloud storage vs cloud backup",
    "cloud backup vs cloud storage",
    "online file backup",
    "cloud data backup",
    "file synchronization",
    "cloud backup services",
  ],
  summary:
    "Sync, storage and backup are three different promises. Confusing them is how people lose files that were 'in the cloud'.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 365,
  image: {
    src: "/images/blog/cloud-storage-vs-cloud-backup.webp",
    width: 1200,
    height: 675,
    alt: "Two contrasting abstract scenes: an active file synchronisation path between devices on one side, a protected recovery vault on the other",
  },
  related: ["how-to-share-large-files-online", "is-cloud-storage-safe", "how-to-organize-digital-files"],
  faqs: [
    {
      question: "Does cloud storage count as a backup?",
      answer:
        "Only if the copy is independent of the original failure. If deleting a file deletes it in the cloud too, you have synchronisation, not backup. A backup survives the mistake as well as the disk failure.",
    },
    {
      question: "Does Orindle provide backup?",
      answer:
        "No, and it should be described carefully. Orindle stores files and moves deleted files to a bin with a configurable retention period before removing them. That helps with accidental deletion. It is not a backup service, does not take point-in-time snapshots of your whole account, and should not be your only copy of anything irreplaceable.",
    },
    {
      question: "What is the 3-2-1 rule?",
      answer:
        "Three copies of the data, on two different types of media, with one copy offsite. It is old, it is boring, and it remains the standard because most data loss involves more than one failure at once.",
    },
  ],
  body: [
    {
      type: "p",
      text: "A file on your laptop, synced to a folder in the cloud, is one file in two places. That sounds like a backup and behaves like one — right up until you delete the wrong folder, or ransomware encrypts your documents, and the change propagates faithfully in seconds. Synchronisation is not protection. It is a very fast mirror.",
    },
    { type: "h2", id: "three-things", text: "Storage, sync and backup are three different promises" },
    {
      type: "table",
      caption: "What each one actually guarantees.",
      head: ["", "Cloud storage", "File sync", "Cloud backup"],
      rows: [
        ["Primary job", "Hold files somewhere you can reach them", "Keep two locations identical", "Keep a recoverable copy over time"],
        ["Survives disk failure", "Yes", "Yes", "Yes"],
        ["Survives accidental deletion", "Often, via a bin", "No — the delete propagates", "Yes, for the retention window"],
        ["Survives ransomware", "Sometimes, if a clean version exists", "No", "Usually, with versioning"],
        ["Survives account compromise", "Rarely", "No", "Sometimes, if the backup is separate"],
        ["Typical interface", "A web app and drive", "A synced folder", "An agent that runs on a schedule"],
      ],
    },
    {
      type: "p",
      text: "Most consumer products blur these together, and reasonably so: Google Drive, OneDrive and Dropbox all store files, sync them and keep some version history. The distinction matters less as a category question and more as a question about *your* failure modes — what does the product do when you make a mistake, versus when your hardware fails.",
    },
    { type: "h2", id: "version-history", text: "Version history and recovery: the part that decides everything" },
    {
      type: "p",
      text: "The single most useful thing to check in any product is how far back you can recover and whether a deleted file is still there afterwards. Providers differ widely and quietly: 30 days is a common consumer window, some plans extend it to 180 days or a year, and end-to-end encrypted services vary in whether older versions are recoverable at all without a key.",
    },
    {
      type: "p",
      text: "A concrete example of how this plays out. You overwrite a spreadsheet with an empty file at 10:00 and do not notice for three weeks. If your provider keeps versions for 30 days, you can recover it. If it keeps seven, you cannot, and the file exists — with the right name, the right location and no data. That is the specific shape of loss that catches people who believe they are backed up.",
    },
    { type: "h2", id: "failure-scenarios", text: "Common data-loss scenarios, and what protects you" },
    {
      type: "list",
      items: [
        "**Laptop drive fails.** Cloud storage alone protects you. The file is elsewhere; the disk is irrelevant.",
        "**You delete the wrong folder.** A bin with a retention window protects you. Sync alone does not — the deletion is replicated before you notice.",
        "**Ransomware encrypts your documents overnight.** Version history and an independent backup protect you. A continuously synced folder does not: the encrypted versions overwrite the clean ones.",
        "**Your account is compromised and files are deleted.** Only a separate copy survives. Anything inside the compromised account is under the attacker's control.",
        "**You overwrite a file and notice a month later.** Version history protects you — if the window is longer than a month.",
        "**The provider makes a mistake.** Rare, and the reason a second copy at a different provider or on a local drive is worth having for anything irreplaceable.",
      ],
    },
    { type: "h2", id: "real-world", text: "Two real-world examples" },
    {
      type: "callout",
      title: "The freelance designer",
      text: "Works entirely from a synced cloud folder so every project is available on both machines. Deletes a client folder after a project closes, meaning to archive it first. Every machine syncs within seconds. The bin saves her — for the retention period. If the retention period had been a week and she had tidied up on a Friday before a two-week holiday, the folder would be gone permanently. Storage and sync did their job; they were never asked to do backup's job.",
    },
    {
      type: "callout",
      title: "The small business",
      text: "Runs on a shared drive with 30 days of version history, which covers accidental deletion well. It does not cover an account-level compromise, or a sync client bug that propagates a corrupt state. A weekly export to a separate destination is dull, cheap and the reason the business still has its finance files. The lesson is not that their cloud storage is bad — it is that the cloud was doing one job and they assumed it was doing two.",
    },
    { type: "h2", id: "when-you-need-both", text: "When you need both" },
    {
      type: "p",
      text: "If losing a file would be an inconvenience, storage with a bin and some version history is genuinely enough. If losing it would be a problem — irreplaceable photos, client work under contract, financial records, a book you are writing — you need a second, independent copy, because every single-copy arrangement has exactly one failure mode that ends it.",
    },
    {
      type: "list",
      items: [
        "**Storage covers:** the disk dying, needing files on another device, sharing, and everyday convenience.",
        "**A bin covers:** your own mistake, briefly.",
        "**Version history covers:** overwriting, and damage you notice within the retention window.",
        "**Backup covers:** all of the above plus compromise, ransomware and provider error — because it is independent.",
      ],
    },
    {
      type: "p",
      text: "The practical version of 3-2-1 for a person rather than a company: files in cloud storage, synced to one machine, plus an external drive that is plugged in monthly, plus the provider's version history. That is three copies, two media, one offsite, and it takes about an hour a year to maintain.",
    },
    { type: "h2", id: "where-orindle-fits", text: "Where Orindle fits in this" },
    {
      type: "p",
      text: "Orindle is cloud storage. Files live in Cloudflare R2 with encryption at rest, deletes move to a bin with a retention period, and the account is protected by server-side authorisation on every request. That covers storage and it covers the common accidental deletion case.",
    },
    {
      type: "note",
      tone: "warning",
      text: "Orindle does not currently offer automated backup, point-in-time snapshots of a whole account, or version history beyond the trash retention window. If those are requirements — and for irreplaceable data they probably are — use a dedicated backup service alongside it, or keep a scheduled export somewhere independent. We would rather say that than let \"it's in the cloud\" do work it cannot do.",
    },
    {
      type: "p",
      text: "If you are choosing storage for files you intend to share as well as keep, [our guide to sharing large files online](/blog/how-to-share-large-files-online) covers the access-control side of the same question.",
    },
    { type: "h2", id: "sources", text: "Further reading" },
    {
      type: "source",
      label: "CISA — Data backup options",
      href: "https://www.cisa.gov/sites/default/files/publications/data_backup_options.pdf",
      note: "The 3-2-1 framing and its rationale, from a government security agency.",
    },
    {
      type: "source",
      label: "Orindle — Trash and retention",
      href: "https://orindle.com/help/articles/recover-deleted-files",
      note: "What Orindle's bin does and does not do.",
    },
  ],
};

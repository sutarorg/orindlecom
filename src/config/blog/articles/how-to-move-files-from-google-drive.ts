import type { BlogArticle } from "../types";

export const howToMoveFilesFromGoogleDrive: BlogArticle = {
  slug: "how-to-move-files-from-google-drive",
  title: "How to Move Files from Google Drive to Another Cloud Storage Service",
  metaTitle: "How to Move Files from Google Drive to Another Cloud | Orindle",
  metaDescription:
    "Learn how to move files from Google Drive to another cloud storage service. Plan your transfer, preserve important data and verify files after migration.",
  primaryKeyword: "move files from Google Drive",
  secondaryKeywords: [
    "transfer Google Drive files",
    "Google Drive migration",
    "migrate files to cloud storage",
    "move files between cloud services",
    "export Google Drive",
    "cloud storage migration",
  ],
  metaKeywords: [
    "move files from Google Drive",
    "transfer Google Drive files",
    "Google Drive migration",
    "migrate files to cloud storage",
    "move files between cloud services",
    "export Google Drive",
    "cloud storage migration",
  ],
  summary:
    "Takeout works, but it is only half the job. The other half is ownership, shared links and verifying that what arrived is what left.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 180,
  factsChecked: "14 November 2026",
  image: {
    src: "/images/blog/move-files-from-google-drive.webp",
    width: 1200,
    height: 675,
    alt: "A file migration path between two abstract storage environments, with files travelling along a clear transfer route",
  },
  related: ["best-google-drive-alternatives", "how-to-organize-digital-files", "how-much-cloud-storage-do-you-need"],
  faqs: [
    {
      question: "What is the fastest way to move files out of Google Drive?",
      answer:
        "For a large library, enable Google Takeout with the Drive archive split into multiple files and download them over a wired connection, or install Google Drive for desktop and let it download everything locally before uploading elsewhere. Takeout is more reliable for a full export; the desktop client is faster when you have a fast connection and only part of the library to move.",
    },
    {
      question: "Do Google Docs, Sheets and Slides convert?",
      answer:
        "Takeout exports them as Office formats (docx, xlsx, pptx) or PDF. The content survives; the live collaboration, comments and revision history do not. Download them in a standard format and re-upload, expecting some layout differences.",
    },
    {
      question: "What happens to shared links after I move?",
      answer:
        "They stop working when the original is deleted — Google's links point at Google's files. Anyone you have shared with needs a new link from the new service, and any link pasted into a document, email or ticket becomes dead. Export a list of shared files before you start.",
    },
    {
      question: "Does Orindle have a one-click Google Drive import?",
      answer:
        "No. Moving files means exporting from Google Drive and uploading to Orindle — the upload flow handles large files and folders, but there is no automated migration tool. This article describes the manual path, which is the one that works today.",
    },
  ],
  body: [
    {
      type: "p",
      text: "Moving out of Google Drive is not difficult. It is easy to do incompletely, which is worse. The files usually survive; what gets lost is the context around them — who owned what, which links were live, which documents were shared with whom — and that is invisible until someone asks for a file you thought you had.",
    },
    { type: "h2", id: "planning", text: "Plan before you move anything" },
    {
      type: "steps",
      items: [
        {
          title: "Measure what you have",
          text: "Check storage used and count the files. Google's storage page shows the split between Drive, Gmail and Photos — only the Drive portion is moving, and this figure tells you which plan you need on the other side.",
        },
        {
          title: "Inventory what is shared",
          text: "List files and folders shared with other people, and note who has access. This is the part people skip and later regret. Google's Drive has a shared-with-others view; capture it as a screenshot or export.",
        },
        {
          title: "Identify what is not actually yours",
          text: "Files shared with you count against the owner's quota, not yours, and you cannot move them. Either ask the owner, or accept that they will disappear from your view when your account changes.",
        },
        {
          title: "Choose a target large enough",
          text: "Account for growth, not just current usage. [How much storage you need](/blog/how-much-cloud-storage-do-you-need) has the arithmetic.",
        },
        {
          title: "Pick a window",
          text: "Do the export when you are not relying on Google Drive for active work. Both services stay available throughout, but a long download competes for bandwidth.",
        },
      ],
    },
    { type: "h2", id: "export", text: "Exporting your data" },
    {
      type: "p",
      text: "Two approaches, and the right one depends on how much you are moving and whether you need a complete archive.",
    },
    {
      type: "table",
      caption: "Export methods compared.",
      head: ["Method", "Best for", "Preserves structure", "Caveats"],
      rows: [
        ["Google Takeout", "Full export, archival, large libraries", "Yes, in a folder hierarchy", "Split into multiple archives; slow; needs local disk space"],
        ["Google Drive for desktop", "Partial moves, fast connections", "Yes, exactly", "Downloads to your disk first; needs enough free space"],
        ["Manual download", "A handful of files", "Only if you rebuild it", "Tedious and error-prone at scale"],
        ["Third-party migration tools", "Organisations with budget", "Usually", "Requires OAuth access to your account; vet the vendor carefully"],
      ],
    },
    {
      type: "p",
      text: "Takeout is the safest option for a complete move because it produces a single dated export you can keep as an archive even after the new service is live. Request it, choose only Drive rather than every Google product, and select the archive size that suits your disk space — Takeout will split a large export into 2 GB, 10 GB or 50 GB parts.",
    },
    {
      type: "note",
      tone: "info",
      text: "Takeout exports Google-native files into standard formats (docx, xlsx, pptx and so on) or PDF. Layout will shift slightly in some documents, especially complex ones. If pixel-exact preservation matters, also export a PDF of the important ones.",
    },
    { type: "h2", id: "structure", text: "Preserving folder structure" },
    {
      type: "p",
      text: "Takeout preserves the hierarchy inside the Drive archive, but it nests it inside an archive folder with a name you will want to strip. When you re-upload, upload the folder rather than its contents, or you will flatten a tree you spent years building.",
    },
    {
      type: "p",
      text: "Orindle's upload accepts folders and keeps their structure. This is the moment to fix the structure rather than reproduce it — if the old hierarchy was five levels deep and full of `New folder (3)`, [reorganise it now](/blog/how-to-organize-digital-files). A migration is the only time you will ever look at all of it.",
    },
    { type: "h2", id: "ownership", text: "Ownership and permission limitations" },
    {
      type: "p",
      text: "This is where most migrations quietly lose things, and none of it is obvious until after the original is deleted.",
    },
    {
      type: "list",
      items: [
        "**Shared links die.** A Google link is a pointer to a Google file. Once the file is gone, every pasted copy of that link is broken, including ones in contracts, tickets and old emails.",
        "**Collaboration history does not travel.** Comments, suggestion mode and revision history are Google-side features. The exported document has none of them.",
        "**Ownership changes hands.** Files you owned become files you uploaded. In an organisation that matters — the account that uploaded them becomes the owner.",
        "**Permissions are not portable.** Google's sharing model does not map onto another service's. Every grant has to be rebuilt, which is the reason to inventory sharing before you start.",
        "**Files shared with you do not come along.** They belong to someone else. Copying them is fine if you have the right to; deleting them from your view is not the same as deleting them.",
      ],
    },
    { type: "h2", id: "large-transfers", text: "Large transfers" },
    {
      type: "p",
      text: "Beyond a few gigabytes, the constraint stops being storage and becomes bandwidth and patience. A few practical notes: do the download over a wired connection, expect the upload to be the slower half unless you have symmetric fibre, and split the work into batches of tens of gigabytes so a failure costs you an hour rather than a day. Takeout's multiple archives are helpful here — you can verify one part while the next downloads.",
    },
    {
      type: "p",
      text: "If your library is measured in terabytes, budget real time. At a typical 20 Mbps upload, one terabyte takes a little over four days of continuous transfer. That is arithmetic, not a defect in either service.",
    },
    { type: "h2", id: "verification", text: "Verifying the transfer" },
    {
      type: "p",
      text: "Do not delete anything at the source until you have verified the destination. Two checks are worth doing:",
    },
    {
      type: "steps",
      items: [
        {
          title: "Compare totals",
          text: "File count and total bytes on both sides. A 2% difference is usually hidden files or Google-native exports that changed size; a large difference means something did not move.",
        },
        {
          title: "Spot-check the important 1%",
          text: "Open a handful of the files you would most regret losing — the ones that are scanned, large, or oddly formatted. This catches corruption that a file count cannot.",
        },
        {
          title: "Test a share link end to end",
          text: "Send yourself a link from the new service and open it in a private window. It confirms the link works for someone who is not signed in, which is the case that fails silently.",
        },
        {
          title: "Keep the export for a month",
          text: "A dated Takeout archive is a cheap insurance policy against discovering a missing folder three weeks later.",
        },
      ],
    },
    { type: "h2", id: "checklist", text: "Final migration checklist" },
    {
      type: "list",
      ordered: true,
      items: [
        "Measure Drive usage and confirm the target plan is large enough, with room to grow.",
        "Capture a list of files and folders shared with other people.",
        "Request a Google Takeout export of Drive only.",
        "Download the archives; keep them dated and intact.",
        "Upload the folder (not its contents) to the new service, so the structure survives.",
        "Reorganise anything that was already a mess — this is the one chance you get.",
        "Verify file count and total size; spot-check the most important files.",
        "Rebuild shares, and send new links to everyone who needs one.",
        "Test a link as a signed-out visitor.",
        "Keep the Takeout archive for at least a month before deleting anything at Google.",
        "Only then remove the originals — and check the bin afterwards, in both services.",
      ],
    },
    {
      type: "p",
      text: "If you are still deciding where to move to rather than how, [our comparison of Google Drive alternatives](/blog/best-google-drive-alternatives) covers ten services on free space, pricing, sharing and privacy, with a checked date on every figure.",
    },
    { type: "h2", id: "sources", text: "Sources" },
    {
      type: "source",
      label: "Google — Download your data with Takeout",
      href: "https://takeout.google.com/",
      note: "The export tool described above, including archive splitting.",
    },
    {
      type: "source",
      label: "Google — Manage files in your Google Drive storage",
      href: "https://support.google.com/drive/answer/9312312",
      note: "How Drive, Gmail and Photos share one quota.",
    },
    {
      type: "source",
      label: "Orindle — Uploading files",
      href: "https://orindle.com/help/articles/upload-your-first-file",
      note: "How folder uploads preserve structure.",
    },
  ],
};

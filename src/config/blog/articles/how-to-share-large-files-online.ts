import type { BlogArticle } from "../types";

export const howToShareLargeFilesOnline: BlogArticle = {
  slug: "how-to-share-large-files-online",
  title: "How to Share Large Files Online: Secure Links, Permissions and Expiry",
  metaTitle: "How to Share Large Files Online Safely",
  metaDescription:
    "Learn how to share large files online using cloud storage, sharing links, access permissions and expiration settings while avoiding common security mistakes.",
  primaryKeyword: "how to share large files online",
  secondaryKeywords: [
    "share large files online",
    "secure file sharing",
    "send large files online",
    "share files with links",
    "cloud file sharing",
    "online file transfer",
  ],
  metaKeywords: [
    "how to share large files online",
    "share large files online",
    "secure file sharing",
    "send large files online",
    "share files with links",
    "cloud file sharing",
  ],
  summary:
    "Email attachments stop working at about 25 MB. Here is what to use instead, and the four settings that decide whether the link you sent is safe.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 365,
  image: {
    src: "/images/blog/share-large-files-online.webp",
    width: 1200,
    height: 675,
    alt: "A large digital file transferring between two devices through a refined sharing link, with abstract permission and access-control indicators",
  },
  related: ["cloud-storage-vs-cloud-backup", "is-cloud-storage-safe", "how-to-organize-digital-files"],
  faqs: [
    {
      question: "What is the maximum email attachment size?",
      answer:
        "Commonly around 20–25 MB across major providers, though the exact figure varies and some corporate mail servers are stricter. Anything above that needs a link instead of an attachment.",
    },
    {
      question: "Are share links safe?",
      answer:
        "A link with no expiry, no password and public access is a public URL — anyone who finds it can read the file, and it may be indexed or forwarded. Links are as safe as the four settings behind them: who can access, what they can do, whether a password is required, and when it stops working.",
    },
    {
      question: "What Orindle sharing controls exist today?",
      answer:
        "Per-person grants with a permission level, and share links with a permission level and an expiry in days, which can be revoked at any time. Downloads are short-lived signed URLs, so no permanent public address to a file exists. Password-protected links are not currently available.",
    },
    {
      question: "Should I send a file or a link to a folder?",
      answer:
        "A link to a file for one-off delivery — it is clear what is being shared. A folder when the recipient needs to browse or add things, with the permission level set to match: read-only unless they genuinely need to edit.",
    },
  ],
  body: [
    {
      type: "p",
      text: "Sharing a large file is easy. Sharing it *safely* is a question of four settings that most people leave at their defaults, because the defaults are chosen to reduce friction rather than exposure. This guide covers the methods, then the settings that matter more than the method.",
    },
    { type: "h2", id: "methods", text: "The main ways to send a large file" },
    {
      type: "table",
      caption: "Methods compared. Limits are typical rather than universal.",
      head: ["Method", "Typical size limit", "Recipient needs an account", "Link can expire", "Good for"],
      rows: [
        ["Email attachment", "~20–25 MB", "No", "N/A", "Documents and images, small teams"],
        ["Cloud storage link", "Plan-dependent, often very large", "Usually not", "Yes", "Most sharing, especially repeat or ongoing"],
        ["Transfer service (upload-and-send)", "Often 2–5 GB on free tiers", "No", "Yes", "One-off sends to someone without storage"],
        ["Direct peer-to-peer transfer", "Unlimited, both online", "No", "N/A", "Large one-off sends on good connections"],
        ["Physical media", "Disk-dependent", "No", "N/A", "Archives, offline delivery, very large volumes"],
      ],
    },
    {
      type: "p",
      text: "For almost everything, a cloud storage link is the right answer: the file is uploaded once, the link carries permissions you control, and you can revoke it later. Transfer services are better when you do not want the file to persist — they exist to move bytes and then forget. Email attachments are for things small enough that the question does not arise.",
    },
    { type: "h2", id: "permissions", text: "Access permissions: the decision people skip" },
    {
      type: "p",
      text: "Most sharing mistakes are permission mistakes. The four questions to answer before you send a link:",
    },
    {
      type: "steps",
      items: [
        {
          title: "Who should be able to open it?",
          text: "Anyone with the link, or only specific people? Link-sharing is convenient and means the URL is the credential — forward it and you have forwarded access. Per-person grants are stricter and survive forwarding badly, which is what you want for anything confidential.",
        },
        {
          title: "What should they be able to do?",
          text: "View, or edit? Read-only is the correct default for delivery; choose edit only when someone is genuinely collaborating. An edit link to a client is an invitation to a version-conflict problem neither of you asked for.",
        },
        {
          title: "For how long?",
          text: "An expiry turns a permanent decision into a temporary one. Project files, contracts and invoices rarely need to be accessible in a year, and an expiring link means a leaked URL stops being useful.",
        },
        {
          title: "Can you take it back?",
          text: "Revocation must actually cut off access, not just hide the link. With signed URLs that expire, revoking a grant stops new links from being issued; a link already downloaded cannot be recalled, which is a property of the internet rather than of any provider.",
        },
      ],
    },
    { type: "h2", id: "expiry-revocation", text: "Expiry and revocation, and what they cannot do" },
    {
      type: "p",
      text: "Expiry is the cheapest security control available and the least used. A link that expires in seven days means a URL pasted into the wrong chat window has a bounded problem. Revocation handles the case where you noticed sooner.",
    },
    {
      type: "p",
      text: "It is worth being precise about the limit of both. Once someone has opened a file, they have a copy. Revoking access stops future access; it does not un-share what was already downloaded. This is why expiry and permission level matter more than revocation — they decide what can happen before it happens.",
    },
    { type: "h2", id: "mistakes", text: "Common security mistakes" },
    {
      type: "list",
      items: [
        "**Sending an edit link when view is enough.** Recipients change things by accident, and now there are two versions nobody can reconcile.",
        "**Links with no expiry for permanent projects.** A URL created for a 2023 invoice is still live in 2026 because nobody revisited it.",
        "**Sharing a parent folder.** Permissions cascade. Sharing the folder above the one you meant can expose everything beside it.",
        "**Putting sensitive data in the filename.** Filenames can appear in previews, notifications and mail subjects. \"Contract_Acme_Layoffs.pdf\" is a disclosure before the file is even opened.",
        "**Forwarding a link instead of inviting a person.** Once a link is out, you cannot tell who has it or revoke it for one person.",
        "**Assuming a private link cannot be found.** Links get pasted into tickets, shared in group chats, and occasionally indexed. Treat a link as public unless it requires authentication.",
      ],
    },
    { type: "h2", id: "practical", text: "A practical process for sending a file" },
    {
      type: "steps",
      items: [
        {
          title: "Decide whether it should be a file or a folder",
          text: "One deliverable: a file link. A set the recipient needs to browse or extend: a folder, with the narrowest permission that works.",
        },
        {
          title: "Upload, then set the permission",
          text: "In Orindle, open the share dialog on the file or folder. You can grant access to a specific email address, or create a link with a permission level and an expiry in days.",
        },
        {
          title: "Set an expiry that matches the project",
          text: "A day for something urgent, a week for a delivery, thirty days for an ongoing collaboration. If the work continues, a fresh link is a minute's work.",
        },
        {
          title: "Send the link, and the context, separately",
          text: "Where possible send the link by one channel and the password or context by another. For a confidential document this halves the exposure if one channel leaks.",
        },
        {
          title: "Revoke when done",
          text: "The [help article on revoking a shared link](/help/articles/revoke-a-shared-link) covers the steps. Doing it at project close is the habit that keeps the number of live links small.",
        },
      ],
    },
    { type: "h2", id: "orindle-controls", text: "What Orindle's sharing actually offers" },
    {
      type: "p",
      text: "Being specific about this matters more than describing sharing in general terms, because a feature list is a promise. Orindle currently supports:",
    },
    {
      type: "list",
      items: [
        "**Per-person grants** on a file, with a permission level, revocable individually.",
        "**Share links** with a permission level and an expiry expressed in days.",
        "**Short-lived signed download URLs**, so a file's location is not a permanent address and expires quickly.",
        "**Server-side authorisation on every request**, backed by database row-level security, so a modified client cannot read rows it should not reach.",
      ],
    },
    {
      type: "note",
      tone: "warning",
      text: "Not available today: password-protected links, download limits per link, watermarking, and link-level analytics showing who opened a file. If any of those are requirements — they often are in legal or HR contexts — Orindle is not the right tool for that specific share yet, and it is better to know that before uploading.",
    },
    {
      type: "p",
      text: "If your question is closer to whether any of this is safe at all, [is cloud storage safe](/blog/is-cloud-storage-safe) covers encryption, account security and where the responsibility actually sits.",
    },
    { type: "h2", id: "sources", text: "Further reading" },
    {
      type: "source",
      label: "Orindle — How to share a link",
      href: "https://orindle.com/help/articles/share-a-link",
      note: "Steps for the flow described above.",
    },
    {
      type: "source",
      label: "OWASP — Insecure direct object reference prevention",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html",
      note: "Why a link must be authorised server-side rather than trusted because it is hard to guess.",
    },
  ],
};

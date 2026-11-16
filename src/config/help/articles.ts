import type { HelpArticle } from "./types";

/**
 * Help articles.
 *
 * Content rule, same as the FAQ: every instruction here describes something the
 * product actually does. Where a feature exists in the UI but its backend is not
 * connected, the article says so — an article that promises a flow which cannot
 * complete is worse than no article.
 *
 * Articles are ordered by how often the question is likely to be asked, because
 * the ordering is what the category list shows.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  /* ---------------------------------------------------------------- */
  /*  Getting started                                                  */
  /* ---------------------------------------------------------------- */
  {
    slug: "create-your-account",
    title: "Create an account and sign in",
    category: "getting-started",
    summary: "What you need to sign up, and what happens to your email address afterwards.",
    updated: "2026-11-16",
    featured: true,
    related: ["upload-your-first-file", "change-your-password"],
    keywords: ["sign up", "register", "login", "email"],
    body: [
      {
        type: "p",
        text: "An account needs one thing: an email address you can receive mail at. No card is taken and none is asked for.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Go to the sign-up page",
            text: "Choose a display name and your email address. Your display name is what other people see if you share something with them; your email address is never shown to them.",
          },
          {
            title: "Set a password, or use a provider",
            text: "Either set a password of at least eight characters, or continue with the third-party provider. With a provider, Orindle receives only the identifier that provider issues — never your password there.",
          },
          {
            title: "Confirm your email",
            text: "A confirmation link is sent to the address you entered. The link is valid for a limited time; if it expires, request another from the sign-in page.",
          },
        ],
      },
      {
        type: "note",
        tone: "info",
        text: "You land on the free plan with 10 GB, which is one allowance shared across every device you sign in on.",
      },
    ],
  },
  {
    slug: "upload-your-first-file",
    title: "Upload your first file",
    category: "getting-started",
    summary: "Drag, drop, and where the file actually goes.",
    updated: "2026-11-16",
    featured: true,
    related: ["create-your-account", "find-a-missing-file"],
    keywords: ["upload", "drag and drop", "add file"],
    body: [
      {
        type: "p",
        text: "Open My Files and either drag a file onto the page or use the upload button. The file goes straight to storage from your browser — it is not routed through the application server, which is why large files upload at your connection's own speed.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Drop or choose",
            text: "Drag files or a folder onto the file area, or press the upload button and pick them. A folder keeps its structure.",
          },
          {
            title: "Watch the queue",
            text: "Each upload shows progress. Pausing is not available; cancelling removes that upload from the queue without leaving a partial file behind.",
          },
          {
            title: "Confirm it landed",
            text: "The file appears in the list as soon as storage confirms the write. If it does not appear, the write did not complete — retry rather than assuming it is there.",
          },
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "An upload that is interrupted mid-transfer is not stored as a partial file. The whole transfer has to complete before the file exists.",
      },
    ],
  },
  {
    slug: "understand-your-dashboard",
    title: "What each part of the dashboard does",
    category: "getting-started",
    summary: "A map of the sidebar, so you know where things live.",
    updated: "2026-11-16",
    related: ["upload-your-first-file", "how-storage-is-counted"],
    keywords: ["sidebar", "navigation", "overview", "layout"],
    body: [
      {
        type: "p",
        text: "The sidebar is the whole map. Everything in Orindle is one of seven places:",
      },
      {
        type: "table",
        head: ["Section", "What is there"],
        rows: [
          ["Overview", "Recent files, storage summary, and shortcuts."],
          ["My Files", "Everything you have uploaded, in folders."],
          ["Folders", "Every folder in one flat list, without the tree."],
          ["Collections", "Groups of files you assembled by hand."],
          ["Recent / Starred", "Sorted by when you touched them, and what you pinned."],
          ["Shared", "Folders the team can reach, and links you have created."],
          ["Trash", "Deleted files, recoverable for 30 days. Last in the Collections group."],
        ],
      },
      {
        type: "p",
        text: "Account settings, billing and the organization workspace sit below that, in a separate group, because they are about the account rather than about your files.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Account                                                          */
  /* ---------------------------------------------------------------- */
  {
    slug: "change-your-password",
    title: "Change or reset your password",
    category: "account",
    summary: "Both directions, and what happens to your other sessions.",
    updated: "2026-11-16",
    featured: true,
    related: ["create-your-account", "close-your-account"],
    keywords: ["password", "reset", "forgot", "sign out everywhere"],
    body: [
      {
        type: "p",
        text: "To change a password you know, use Account → Security in the dashboard. To reset one you have forgotten, use the 'forgot password' link on the sign-in page and follow the emailed link.",
      },
      {
        type: "steps",
        items: [
          {
            title: "From the dashboard",
            text: "Account → Security, then enter the current password and the new one twice. The new password takes effect immediately.",
          },
          {
            title: "From the sign-in page",
            text: "Choose 'forgot password', enter your account email, and follow the link that arrives. The link expires; if it has, request another.",
          },
        ],
      },
      {
        type: "note",
        tone: "info",
        text: "A password reset does not sign out your other devices. If you think somebody else has your password, change it and then sign out of every session from the same Security page.",
      },
    ],
  },
  {
    slug: "close-your-account",
    title: "Close your account",
    category: "account",
    summary: "What is deleted, what is kept, and how to ask.",
    updated: "2026-11-16",
    related: ["change-your-password", "recover-deleted-files"],
    keywords: ["delete account", "close account", "erase", "leave"],
    body: [
      {
        type: "p",
        text: "Account closure is currently a request rather than a button in the dashboard. That is the honest description of the product today.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Export what you want to keep",
            text: "Download your files first. Closing an account removes them, and there is no undo.",
          },
          {
            title: "Cancel any subscription",
            text: "Cancelling stops the next renewal. Closing the account does not refund the current period on its own.",
          },
          {
            title: "Send the request",
            text: "Use the contact form with the subject 'Privacy or data request', writing from the account's email address so the request can be verified.",
          },
        ],
      },
      {
        type: "link",
        href: "/data-deletion",
        label: "Read the Data Deletion Policy",
        text: "The full sequence — what is removed, in what order, and what survives in billing and security logs.",
      },
    ],
  },
  {
    slug: "keep-your-account-secure",
    title: "Keep your account secure",
    category: "account",
    summary: "The things that actually matter, in order.",
    updated: "2026-11-16",
    related: ["change-your-password", "revoke-a-shared-link"],
    keywords: ["security", "2fa", "two factor", "session"],
    body: [
      {
        type: "list",
        items: [
          "Use a password you have not used anywhere else. A password manager makes this free.",
          "Never share a signed-in browser session or a screen with your dashboard visible.",
          "Check Shared → Links occasionally and turn off anything you no longer need. An old public link is the most common way a file gets out.",
          "If you use a shared computer, sign out rather than closing the tab.",
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "Two-factor authentication is not available yet. It is the next security feature planned, and until it ships, a strong unique password is the whole defence.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Storage                                                          */
  /* ---------------------------------------------------------------- */
  {
    slug: "how-storage-is-counted",
    title: "How storage is counted",
    category: "storage",
    summary: "One allowance per account, and what uses it.",
    updated: "2026-11-16",
    featured: true,
    related: ["what-happens-when-storage-is-full", "upgrade-a-plan"],
    keywords: ["storage", "quota", "allowance", "gb", "limit"],
    body: [
      {
        type: "p",
        text: "Your allowance is per account, not per device. Sign in on a phone and a laptop and the same 10 GB is shared between them, because it is the same library.",
      },
      {
        type: "p",
        text: "Everything in your library counts: files in folders, files in Collections, and files in Trash. Trash counts because the file still exists — emptying Trash is how you get the space back immediately rather than waiting for the 30-day window.",
      },
      {
        type: "note",
        tone: "info",
        text: "The number in the sidebar is measured, not estimated. If it disagrees with the storage page, the storage page is the authoritative one and the sidebar is stale.",
      },
    ],
  },
  {
    slug: "what-happens-when-storage-is-full",
    title: "What happens when you run out of space",
    category: "storage",
    summary: "Uploads stop. Your files do not disappear.",
    updated: "2026-11-16",
    related: ["how-storage-is-counted", "upgrade-a-plan", "recover-deleted-files"],
    keywords: ["full", "out of space", "upload failed", "limit reached"],
    body: [
      {
        type: "p",
        text: "At 100% of your allowance, new uploads fail. Nothing is deleted, nothing is hidden, and every existing file stays downloadable and shareable.",
      },
      {
        type: "list",
        items: [
          "Empty Trash to reclaim space immediately — deleted files still count until they are purged.",
          "Check Collections and Recent for large files you no longer need.",
          "Upgrade to a larger plan; existing files stay exactly where they are.",
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "An upload that fails at the limit leaves no partial file behind. Retry once there is space rather than assuming half of it landed.",
      },
    ],
  },
  {
    slug: "upgrade-a-plan",
    title: "Upgrade to a bigger plan",
    category: "storage",
    summary: "What changes, and what does not.",
    updated: "2026-11-16",
    related: ["how-storage-is-counted", "find-an-invoice", "cancel-a-subscription"],
    keywords: ["upgrade", "plan", "pricing", "bigger"],
    body: [
      {
        type: "p",
        text: "Plans are storage tiers on the same account. Upgrading changes the size of the allowance and nothing else — folders, links, shares and file names are untouched.",
      },
      {
        type: "p",
        text: "The new allowance applies immediately, in the same currency you were already being charged. Prices are published on the pricing page for the Indian rupee and the US dollar; other currencies are shown as unavailable rather than converted at a made-up rate.",
      },
      {
        type: "note",
        tone: "info",
        text: "Downgrading does not delete anything. Uploading stops until your usage fits the smaller allowance, and reading and sharing continue so nothing becomes unreachable.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Files                                                            */
  /* ---------------------------------------------------------------- */
  {
    slug: "recover-deleted-files",
    title: "Recover a deleted file",
    category: "files",
    summary: "Thirty days in Trash, then gone.",
    updated: "2026-11-16",
    featured: true,
    related: ["find-a-missing-file", "close-your-account"],
    keywords: ["restore", "trash", "deleted", "recover", "undelete"],
    body: [
      {
        type: "p",
        text: "Deleting a file moves it to Trash. It stays there for 30 days and can be restored to its original folder at any point in that window.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Open Trash",
            text: "It is the last entry in the Collections group, above Storage and Billing. Everything deleted in the last 30 days is listed with the date it was deleted.",
          },
          {
            title: "Restore",
            text: "Pick the file and restore it. It returns to the folder it came from; if that folder no longer exists, it lands in My Files.",
          },
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "After 30 days the file is removed from primary storage and cannot be recovered by you or by support. Emptying Trash does the same thing immediately.",
      },
    ],
  },
  {
    slug: "find-a-missing-file",
    title: "Find a file you cannot see",
    category: "files",
    summary: "Four places to look before assuming it is gone.",
    updated: "2026-11-16",
    related: ["recover-deleted-files", "upload-your-first-file"],
    keywords: ["missing", "lost", "search", "not there"],
    body: [
      {
        type: "steps",
        items: [
          {
            title: "Search from the top bar",
            text: "Search covers file names across the whole library, not just the folder you are looking at.",
          },
          {
            title: "Check Folders",
            text: "A file inside a subfolder will not appear in the top level of My Files. The Folders page lists every folder flat, which is usually faster than clicking down a tree.",
          },
          {
            title: "Check Collections",
            text: "If you added a file to a collection, that is where you may remember seeing it.",
          },
          {
            title: "Check Trash",
            text: "If it was deleted within the last 30 days it is there, and restorable.",
          },
        ],
      },
      {
        type: "note",
        tone: "info",
        text: "If a search finds nothing and Trash is empty, the file was likely never uploaded successfully. An interrupted upload does not leave a partial file behind.",
      },
    ],
  },
  {
    slug: "organise-with-folders",
    title: "Organise files into folders",
    category: "files",
    summary: "Nesting, moving, and what a folder rename does to links.",
    updated: "2026-11-16",
    related: ["find-a-missing-file", "share-a-folder"],
    keywords: ["folders", "move", "rename", "organise", "nest"],
    body: [
      {
        type: "p",
        text: "Folders nest as deeply as you need. Create one from My Files, then drag files into it or use the move action on a file's menu.",
      },
      {
        type: "p",
        text: "Renaming a folder changes its name only. Existing share links keep working, because a link points at the folder rather than at its name.",
      },
      {
        type: "note",
        tone: "warning",
        text: "Deleting a folder deletes everything inside it. The confirmation asks you to type the folder's name, because the contents go with it.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Sharing                                                          */
  /* ---------------------------------------------------------------- */
  {
    slug: "share-a-link",
    title: "Share a file with a link",
    category: "sharing",
    summary: "What a link is, and what it is not.",
    updated: "2026-11-16",
    featured: true,
    related: ["revoke-a-shared-link", "share-a-folder"],
    keywords: ["share", "link", "public", "send"],
    body: [
      {
        type: "p",
        text: "A share link is a URL that grants access to one file to anybody who has it. It is not tied to an email address, so it does not matter who opens it — only whether they have the link.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Create the link",
            text: "Open the file's menu and choose Share. Choose the permission level and, if you want, an expiry.",
          },
          {
            title: "Send it",
            text: "Copy the link and send it however you normally would. Orindle does not email it for you.",
          },
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "Anyone with the link can open the file. Treat it like a key: send it to the person, not to a group chat. If it goes somewhere it shouldn't, revoke it.",
      },
    ],
  },
  {
    slug: "revoke-a-shared-link",
    title: "Revoke a shared link",
    category: "sharing",
    summary: "Immediate, and it does not reach files already downloaded.",
    updated: "2026-11-16",
    related: ["share-a-link", "keep-your-account-secure"],
    keywords: ["revoke", "remove access", "stop sharing", "disable link"],
    body: [
      {
        type: "p",
        text: "Open Shared → Links and switch the link off, or delete it. The URL stops working immediately for everyone who has it.",
      },
      {
        type: "p",
        text: "What revocation cannot do is un-download a file. Anything already saved to somebody's device stays on their device. This is stated on the sharing screen rather than only here, because it is the one thing people expect revocation to do that it cannot.",
      },
    ],
  },
  {
    slug: "share-a-folder",
    title: "Share a folder",
    category: "sharing",
    summary: "One link, everything inside it, changes included.",
    updated: "2026-11-16",
    related: ["share-a-link", "organise-with-folders", "business-roles"],
    keywords: ["folder sharing", "share folder", "collaborate"],
    body: [
      {
        type: "p",
        text: "Sharing a folder shares its contents, and keeps sharing them: anything you add later is visible through the same link without a new one being sent.",
      },
      {
        type: "note",
        tone: "info",
        text: "If you want to share one file from a folder without exposing the rest, share the file rather than the folder.",
      },
      {
        type: "p",
        text: "If you are working inside a business workspace, folder access works differently — it is granted to specific teammates with a level, rather than through a public URL. See the roles article.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Billing                                                          */
  /* ---------------------------------------------------------------- */
  {
    slug: "find-an-invoice",
    title: "Find an invoice or receipt",
    category: "billing",
    summary: "Where they are, and what they contain.",
    updated: "2026-11-16",
    related: ["cancel-a-subscription", "upgrade-a-plan"],
    keywords: ["invoice", "receipt", "tax", "gst", "proof of payment"],
    body: [
      {
        type: "p",
        text: "Every successful charge appears under Billing in the dashboard, with the amount, the currency and the date. Payment itself is processed by Razorpay, so the receipt in your inbox will come from them rather than from Orindle.",
      },
      {
        type: "note",
        tone: "warning",
        text: "Downloadable tax invoices with GST details are not generated yet. If you need one for a company expense, write to support and say so — a proper document needs the registered entity details, which are still being finalised.",
      },
    ],
  },
  {
    slug: "cancel-a-subscription",
    title: "Cancel a subscription",
    category: "billing",
    summary: "What stops, when it stops, and what happens to your files.",
    updated: "2026-11-16",
    related: ["find-an-invoice", "what-happens-when-storage-is-full"],
    keywords: ["cancel", "unsubscribe", "downgrade", "stop paying"],
    body: [
      {
        type: "p",
        text: "Cancel from Billing in the dashboard. Cancelling stops the next renewal; the plan runs to the end of the period you have already paid for.",
      },
      {
        type: "list",
        items: [
          "Your files stay exactly where they are.",
          "At the end of the period the account reverts to the free 10 GB allowance.",
          "If you are using more than 10 GB at that point, uploading stops but reading and sharing continue, so nothing becomes unreachable.",
          "Emptying Trash or upgrading again both restore uploading.",
        ],
      },
      {
        type: "placeholder",
        text: "Refunds are not covered here because Orindle has not published a refund policy yet. Write to support with your situation and you will get a direct answer.",
      },
    ],
  },
  {
    slug: "payment-failed",
    title: "A payment failed",
    category: "billing",
    summary: "What happens next, and what does not.",
    updated: "2026-11-16",
    related: ["cancel-a-subscription", "what-happens-when-storage-is-full"],
    keywords: ["payment failed", "declined", "card", "retry"],
    body: [
      {
        type: "p",
        text: "A failed payment is retried, and you are notified. Nothing is deleted during this: the plan stays active through the retry window and your files are untouched.",
      },
      {
        type: "p",
        text: "If the retries all fail, the account reverts to the free allowance in the same way a cancellation does — files stay, uploading stops above 10 GB.",
      },
      {
        type: "note",
        tone: "info",
        text: "Card details are held by Razorpay, not by Orindle. Updating a card happens in their interface, which is why support cannot do it for you.",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  /*  Business                                                         */
  /* ---------------------------------------------------------------- */
  {
    slug: "business-roles",
    title: "What each team role can do",
    category: "business",
    summary: "Owner, admin, member — and where the boundaries are.",
    updated: "2026-11-16",
    featured: true,
    related: ["invite-a-teammate", "share-a-folder"],
    keywords: ["roles", "owner", "admin", "member", "permissions", "team"],
    body: [
      {
        type: "p",
        text: "A business workspace has exactly three roles. They are fixed: there is no per-folder role and no custom role builder yet.",
      },
      {
        type: "table",
        head: ["Role", "Can do", "Cannot do"],
        rows: [
          [
            "Owner",
            "Everything, including billing and transferring ownership.",
            "Nothing — but there is only ever one.",
          ],
          [
            "Admin",
            "Invite, remove, change roles up to admin, and manage folder access.",
            "Change billing, or transfer ownership.",
          ],
          [
            "Member",
            "Create folders, upload and edit inside folders they can reach.",
            "Manage people, or change who can reach a folder.",
          ],
        ],
      },
      {
        type: "note",
        tone: "info",
        text: "Nobody can promote anybody past their own role, and nobody can change their own role. That is deliberate: it makes every escalation a two-person event.",
      },
      {
        type: "link",
        href: "/dashboard/business/permissions",
        label: "See the full capability table",
        text: "Every permission, checked against each role, inside the workspace.",
      },
    ],
  },
  {
    slug: "invite-a-teammate",
    title: "Invite a teammate",
    category: "business",
    summary: "The invitation, the seven-day window, and what the invitee sees.",
    updated: "2026-11-16",
    related: ["business-roles", "remove-a-teammate"],
    keywords: ["invite", "add member", "team", "onboard"],
    body: [
      {
        type: "p",
        text: "An owner or admin invites from Members. You choose the email address and the role; the invitee does not choose their own role, which is what stops self-promotion being an invitation away.",
      },
      {
        type: "steps",
        items: [
          {
            title: "Send the invitation",
            text: "Members → Invite member, then enter the email and pick a role. You can optionally grant access to one folder at the same time.",
          },
          {
            title: "Wait for acceptance",
            text: "The person appears in the list as Invited. They appear as a full member with their name only after they accept.",
          },
          {
            title: "If it expires",
            text: "Invitations stop working after seven days. Resend from the row menu to issue a fresh one; the expired record stays in the list so the history is honest.",
          },
        ],
      },
    ],
  },
  {
    slug: "remove-a-teammate",
    title: "Remove someone from the team",
    category: "business",
    summary: "What they lose, and what they keep.",
    updated: "2026-11-16",
    related: ["invite-a-teammate", "business-roles"],
    keywords: ["remove", "offboard", "revoke access", "leaver"],
    body: [
      {
        type: "p",
        text: "Removing somebody revokes their access to shared folders. It does not delete anything in their personal workspace, and it does not delete files they uploaded into shared folders — those belong to the organization.",
      },
      {
        type: "note",
        tone: "warning",
        text: "The last owner cannot be removed. Transfer ownership first, which moves the owner role to another admin and makes you an admin in the same step.",
      },
      {
        type: "p",
        text: "Anything the person already downloaded onto their own device stays there. Offboarding changes what they can reach, not what they have seen.",
      },
    ],
  },
];

export function articleBySlug(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

export function articlesInCategory(categoryId: string): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.category === categoryId);
}

export function featuredArticles(): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => article.featured);
}

/** Ordered navigation across all articles, used for previous/next. */
export function articleNeighbours(slug: string): {
  previous: HelpArticle | null;
  next: HelpArticle | null;
} {
  const index = HELP_ARTICLES.findIndex((article) => article.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: index > 0 ? HELP_ARTICLES[index - 1] : null,
    next: index < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[index + 1] : null,
  };
}

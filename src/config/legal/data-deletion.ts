import type { LegalDocument } from "./types";

/**
 * Data Deletion Policy — approved and published.
 *
 * Matches the live product exactly: 30-day Trash retention, self-service
 * account deletion with a 7-day read-only grace period, automated purge job,
 * and email deletion assistance at tejassutar.business@gmail.com.
 */
export const DATA_DELETION_POLICY: LegalDocument = {
  id: "data-deletion",
  path: "/data-deletion",
  title: "Data Deletion Policy",
  summary:
    "What happens to your files, Trash, account and backups when you delete something — or everything.",
  purpose: "Deletion, step by step.",
  updated: "2026-11-16",
  approved: true,
  sections: [
    {
      id: "summary",
      heading: "The short version",
      blocks: [
        {
          type: "list",
          items: [
            "Delete a file and it moves to Trash, where you can restore it for 30 days.",
            "After 30 days — or immediately when you empty Trash — the file is permanently deleted from primary storage.",
            "Account deletion is self-service in Dashboard → Settings with a 7-day read-only grace period.",
            "Signing back in during those 7 days cancels the deletion automatically. After 7 days, your files, folders, shares and account record are permanently purged.",
            "Billing records survive only where accounting and tax law requires them, and never contain your files.",
          ],
        },
      ],
    },
    {
      id: "files",
      heading: "Deleting a file or folder",
      gist: "30-day Trash retention, or immediate purge.",
      blocks: [
        {
          type: "p",
          text: "Deleting a file moves it to Trash rather than destroying it immediately so accidental deletions can be undone. Items remain in Trash for 30 days.",
        },
        {
          type: "p",
          text: "During those 30 days you can restore individual items, restore everything at once, or permanently purge items immediately by emptying Trash. After 30 days, our automated nightly cleanup job deletes the file from Cloudflare R2 primary storage and removes its database record. Once purged, it cannot be recovered.",
        },
        {
          type: "p",
          text: "Deleting a folder moves the folder and everything inside it to Trash. Permanently deleting a folder requires explicit confirmation because its contents are removed with it.",
        },
      ],
    },
    {
      id: "account",
      heading: "Closing and deleting your account",
      gist: "Self-service, 7-day grace period, then ordered permanent purge.",
      blocks: [
        {
          type: "p",
          text: "You can schedule account deletion directly from Dashboard → Settings by confirming your email address. Deletion runs in two stages so an accidental request or unauthorised click can be reversed:",
        },
        {
          type: "list",
          ordered: true,
          items: [
            "Grace period (7 days): Your account is marked for deletion, becomes read-only, and a confirmation email is sent to your address. Signing back in at any time during these 7 days cancels the deletion automatically and restores normal access.",
            "Permanent purge (after 7 days): Our automated purge job revokes sharing links, deletes every stored object from Cloudflare R2 first, deletes your database records (files, folders, grants, profile and preferences), and removes your authentication record last so no orphaned file can ever be left behind. A final confirmation email is sent when purge completes.",
          ],
        },
        {
          type: "p",
          text: "Anyone you shared files or links with loses access when sharing links are revoked. Files someone already downloaded to their own device are outside Orindle's control.",
        },
      ],
    },
    {
      id: "subscriptions",
      heading: "Subscriptions when an account closes",
      blocks: [
        {
          type: "p",
          text: "Cancel any active paid subscription in Dashboard → Billing before closing your account to prevent future renewals. Closing an account does not automatically issue a partial-period refund; if you have a billing question or statutory refund request, email tejassutar.business@gmail.com.",
        },
        {
          type: "p",
          text: "Payment identifiers and amounts needed for accounting, tax compliance or refund processing are retained separately from your files.",
        },
      ],
    },
    {
      id: "backups",
      heading: "Backups",
      gist: "Rolling infrastructure rotation.",
      blocks: [
        {
          type: "p",
          text: "Orindle's managed database infrastructure maintains automated backups for disaster recovery. While primary file objects in Cloudflare R2 are deleted immediately upon Trash purge or account purge, metadata snapshots in infrastructure backups age out on the provider's rolling rotation cycle.",
        },
        {
          type: "p",
          text: "Deleted accounts and files are never restored from backup into active service.",
        },
      ],
    },
    {
      id: "retained",
      heading: "What may be kept, and why",
      gist: "Narrow statutory and security exceptions only.",
      blocks: [
        {
          type: "table",
          head: ["What", "Why it is kept", "Contains your files?"],
          rows: [
            [
              "Billing and payment records",
              "Retained for the period required by applicable accounting and tax law.",
              "No",
            ],
            [
              "Security and anti-abuse logs",
              "Retained for 30 to 90 days (or longer where required for investigating unauthorised access under DPDP Rule 6(1)(e)).",
              "No — metadata only",
            ],
            [
              "Records subject to a legal hold",
              "Held only where required by a valid court order, legal dispute or statutory obligation until resolved.",
              "Only what the order specifies",
            ],
            [
              "Anonymous aggregate totals",
              "Non-identifying platform statistics (such as aggregate account counts).",
              "No",
            ],
          ],
        },
        {
          type: "p",
          text: "Nothing else survives account purge. Orindle never retains a dormant archive of your files.",
        },
      ],
    },
    {
      id: "request",
      heading: "How to delete your data",
      gist: "Self-service in the dashboard, or by email if you cannot sign in.",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "Individual files and folders: delete them in your dashboard. Restore within 30 days or empty Trash immediately.",
            "Your entire account (self-service): open Dashboard → Settings → Danger zone → Delete account and confirm with your email address. Your account enters the 7-day read-only grace period and purges automatically once 7 days pass.",
            "If you cannot sign in (or are acting for a deceased or incapacitated account holder): write to tejassutar.business@gmail.com or use orindle.com/contact?subject=privacy. We will verify authority and complete erasure in the same order described in section 3.",
          ],
        },
      ],
    },
    {
      id: "rights",
      heading: "Your legal rights around erasure",
      blocks: [
        {
          type: "p",
          text: "Under section 12 of India's DPDP Act and Article 17 of the GDPR and UK GDPR, you have the right to erasure of your personal data. Orindle refuses erasure only to the extent retention is required by law, and always identifies the legal basis when doing so.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "Any material change to Trash retention, the account deletion grace period, or our purge process is published on this page with an updated effective date and emailed to account holders before it takes effect.",
        },
      ],
    },
  ],
};

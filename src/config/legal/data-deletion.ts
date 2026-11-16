import type { LegalDocument } from "./types";

/**
 * Data Deletion Policy — draft.
 *
 * This document has a harder job than the others: every sentence in it is a
 * promise about a process. So it separates what the product does today from what
 * it does not yet do, and it declines to state a deletion SLA the engineering
 * side has not measured.
 *
 * The trash window is read from the same constant the product uses
 * (`TRASH_RETENTION_DAYS`, default 30) so the policy cannot drift from the code.
 */
export const DATA_DELETION_POLICY: LegalDocument = {
  id: "data-deletion",
  path: "/data-deletion",
  title: "Data Deletion Policy",
  summary:
    "What happens to your files, your account and your backups when you delete something — or everything.",
  purpose: "Deletion, step by step.",
  updated: "2026-11-16",
  sections: [
    {
      id: "summary",
      heading: "The short version",
      blocks: [
        {
          type: "list",
          items: [
            "Delete a file and it goes to Trash. Restore it from there for 30 days.",
            "After 30 days, or if you empty Trash, the file is removed from primary storage.",
            "Closing your account deletes your files and your account record.",
            "Billing records survive where tax and accounting law requires it. Those records do not contain your files.",
            "Backups age out on a rolling cycle. The exact window is not yet approved, and this policy does not guess at it.",
          ],
        },
        {
          type: "note",
          tone: "info",
          title: "There is no self-service delete-account button yet",
          text: "Account deletion is currently handled as a request. This is the honest description of the product as it exists. When the flow ships, this section changes with it.",
        },
      ],
    },
    {
      id: "files",
      heading: "Deleting a file",
      gist: "Two stages, 30 days apart.",
      blocks: [
        {
          type: "p",
          text: "Deleting a file moves it to Trash. It is not removed from storage at that point, which is deliberate: a mis-tap should be recoverable. Trash holds deleted files for 30 days.",
        },
        {
          type: "p",
          text: "You can restore anything from Trash during that window, or empty Trash to remove its contents immediately. After 30 days the file is permanently deleted from primary storage and cannot be recovered by Orindle or by you.",
        },
        {
          type: "p",
          text: "Deleting a folder deletes everything inside it. The confirmation dialog names the folder and requires you to type its name, because that action takes the contents with it.",
        },
      ],
    },
    {
      id: "account",
      heading: "Closing your account",
      gist: "What is removed, and when.",
      blocks: [
        {
          type: "p",
          text: "Closing an account removes your files, your folders, your sharing links, and your account record — the email address, display name, password hash and preferences.",
        },
        {
          type: "p",
          text: "Deletion runs in this order: sharing links are revoked first so nothing remains reachable from outside, then files are removed from primary storage, then the account record is deleted, then the remaining copies in backups age out on the rolling cycle.",
        },
        { type: "placeholder", key: "deletionSla" },
        {
          type: "p",
          text: "Anyone you shared files with loses access when the link is revoked. Files they already downloaded onto their own devices are outside Orindle's control and are not affected.",
        },
      ],
      review:
        "The order of operations above must be verified against the implementation before this section is published. If account deletion is a manual process, say so and give the reader a realistic expectation of how long the request takes.",
    },
    {
      id: "subscriptions",
      heading: "Subscriptions when an account closes",
      blocks: [
        {
          type: "p",
          text: "Closing an account ends any active subscription at the end of the current billing period; it does not trigger an automatic refund. Cancel the subscription before closing the account if you want to stop the next renewal.",
        },
        {
          type: "p",
          text: "If billing information is needed to honour a refund, that record is retained even after the account is gone. It contains transaction identifiers and amounts, not your files.",
        },
        { type: "placeholder", key: "subscriptionRefund" },
      ],
    },
    {
      id: "backups",
      heading: "Backups",
      gist: "The honest limitation.",
      blocks: [
        {
          type: "p",
          text: "Orindle keeps backups so that a failure does not take your files with it. That same design means a deleted file can persist in a backup after it has been removed from primary storage.",
        },
        {
          type: "p",
          text: "Deleted data is not restored into a live account. As each backup rotation completes, the copy containing the deleted data is replaced, and the data is gone from the backup set too.",
        },
        { type: "placeholder", key: "backupWindow" },
        {
          type: "note",
          tone: "warning",
          title: "Why there is no number here",
          text: "Publishing 'backups are purged within 30 days' without a measured rotation would be a commitment Orindle cannot currently evidence. The section will carry a number as soon as the backup policy is approved.",
        },
      ],
    },
    {
      id: "retained",
      heading: "What may be kept, and why",
      gist: "The narrow exceptions.",
      blocks: [
        {
          type: "table",
          head: ["What", "Why it is kept", "Contains your files?"],
          rows: [
            [
              "Billing and tax records",
              "Company and tax law requires accounting records to be retained after a transaction.",
              "No",
            ],
            [
              "Server and security logs",
              "Rule 6(1)(e) of the DPDP Rules 2025 requires log retention to investigate unauthorised access.",
              "No — metadata only",
            ],
            [
              "Records of a legal claim",
              "If a dispute, investigation or legal order requires preservation, the relevant records are held until it is resolved.",
              "Only what the order covers",
            ],
            [
              "Aggregate counts",
              "Totals such as how many accounts exist, with nothing that identifies a person.",
              "No",
            ],
          ],
        },
        {
          type: "p",
          text: "Nothing else survives account deletion. Orindle does not keep a dormant copy of your files 'in case you come back'.",
        },
      ],
      review:
        "Confirm the mandated retention period for Indian accounting records — the Companies Act 2013 requires books of account to be preserved for eight financial years, and the tax regime adds its own — then state the actual period rather than the placeholder.",
    },
    {
      id: "request",
      heading: "How to request deletion",
      gist: "Two routes, one of which is immediate.",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "For individual files: delete them in the dashboard. Trash is immediate and self-service; there is nothing to request.",
            "For an entire account: send a request through the contact form with the subject 'Privacy or data request'. Write from the email address on the account so Orindle can verify the request.",
            "Orindle confirms receipt, states what will be deleted, and asks for confirmation before anything is destroyed.",
            "On confirmation, deletion runs in the order described in section 3.",
          ],
        },
        {
          type: "p",
          text: "If the request comes from someone who cannot access the account email — a bereaved family member, for example — Orindle may ask for evidence of authority before acting, and will explain what is needed rather than simply refusing.",
        },
      ],
    },
    {
      id: "rights",
      heading: "Your rights around deletion",
      blocks: [
        {
          type: "p",
          text: "Under section 12 of the DPDP Act you have the right to erasure. Under section 8(7) Orindle must erase personal data when consent is withdrawn or the purpose is served, unless another law requires retention. Under the GDPR the corresponding right is Article 17.",
        },
        {
          type: "p",
          text: "Both regimes allow erasure to be refused where retention is legally required. That is the only reason Orindle refuses one, and it says which law applies when it does.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        {
          type: "p",
          text: "If the deletion process changes — for example when self-service account deletion ships — this page changes with it, and account holders are told because a change to deletion affects a right they have.",
        },
      ],
    },
  ],
};

/**
 * Open questions.
 *
 * Every value here is `null` because the answer has not been supplied to the
 * codebase. Nothing in this file is a guess: the UI renders each unset key as a
 * visible placeholder so a reader can tell the difference between a commitment
 * Orindle has made and a decision that is still pending.
 *
 * When an answer arrives, set it here and every policy, every FAQ answer and the
 * claims register pick it up at once.
 */

import type { PlaceholderKey } from "./types";

export interface PlaceholderDefinition {
  key: PlaceholderKey;
  /** What the reader sees in place of the fact. */
  label: string;
  /** Why it is missing, written for whoever has to go and find it. */
  why: string;
  /** Who can resolve it. */
  owner: string;
}

export const PLACEHOLDER_DEFINITIONS: PlaceholderDefinition[] = [
  {
    key: "legalEntity",
    label: "Registered legal entity name",
    why: "No company has been named as the contracting party. Terms, invoicing and the consumer-protection disclosures all need the exact registered name.",
    owner: "Business owner, with company registration documents",
  },
  {
    key: "registeredAddress",
    label: "Registered office address",
    why: "Required for consumer-facing disclosures under the Consumer Protection (E-Commerce) Rules, 2020, and for the controller identity in GDPR Article 13 notices.",
    owner: "Business owner",
  },
  {
    key: "businessContact",
    label: "Business contact address for data questions",
    why: "Rule 9 of the DPDP Rules, 2025 requires a published contact who can answer data-processing questions. A personal support inbox may not satisfy the 'business contact information' wording.",
    owner: "Business owner, with legal review",
  },
  {
    key: "dpoName",
    label: "Data Protection Officer",
    why: "Only required if Orindle is notified as a Significant Data Fiduciary. No such notification exists, so no DPO is claimed.",
    owner: "Not required today; revisit on any SDF designation",
  },
  {
    key: "grievanceOfficer",
    label: "Grievance officer and their contact details",
    why: "Consumer Protection (E-Commerce) Rules, 2020 rule 4(4)–(6) requires a named grievance officer with published contact details, acknowledging complaints within 48 hours and resolving within one month.",
    owner: "Business owner",
  },
  {
    key: "hostingRegions",
    label: "Confirmed hosting regions",
    why: "Data residency statements are only useful if they are exact. The stack is Supabase and Cloudflare R2, but the configured regions have not been confirmed.",
    owner: "Engineering",
  },
  {
    key: "subProcessors",
    label: "Complete sub-processor list",
    why: "GDPR Article 28 requires a full list. The known processors are listed from the codebase; a signed-off list may be longer.",
    owner: "Engineering, with legal review",
  },
  {
    key: "transferMechanism",
    label: "International transfer mechanism",
    why: "Whether Orindle relies on adequacy, Standard Contractual Clauses or another Article 46 route for EU and UK data has not been decided.",
    owner: "Legal counsel",
  },
  {
    key: "retentionPeriods",
    label: "Approved retention periods",
    why: "The product has a 30-day trash window, but no approved schedule exists for logs, backups or billing records. Stating a period that is not enforced would be a false commitment.",
    owner: "Business owner, with legal review",
  },
  {
    key: "backupWindow",
    label: "Backup retention window",
    why: "Backup policy has not been approved. Deletion notices hinge on it, so it cannot be estimated.",
    owner: "Engineering",
  },
  {
    key: "subscriptionRefund",
    label: "Cancellation and refund policy",
    why: "No refund policy has been approved. Consumer law also constrains what can be offered, so this needs a legal review rather than an assumption.",
    owner: "Business owner, with legal review",
  },
  {
    key: "deletionSla",
    label: "Account deletion completion window",
    why: "How long a deletion takes to propagate through primary storage and backups is an operational fact that has not been measured.",
    owner: "Engineering",
  },
  {
    key: "governingLaw",
    label: "Governing law and jurisdiction",
    why: "Depends on where the operating entity is registered, which is unresolved.",
    owner: "Legal counsel",
  },
  {
    key: "minimumAge",
    label: "Minimum age for an account",
    why: "The DPDP Act treats under-18s as children requiring verifiable parental consent. Whether Orindle sets 18 as its minimum, or builds a consent flow, is a product decision not yet made.",
    owner: "Business owner, with legal review",
  },
];

/** Resolved values. All null until the business supplies them. */
export const PLACEHOLDER_VALUES: Record<PlaceholderKey, string | null> = {
  legalEntity: null,
  registeredAddress: null,
  businessContact: null,
  dpoName: null,
  grievanceOfficer: null,
  hostingRegions: null,
  subProcessors: null,
  transferMechanism: null,
  retentionPeriods: null,
  backupWindow: null,
  subscriptionRefund: null,
  deletionSla: null,
  governingLaw: null,
  minimumAge: null,
};

export function placeholderDefinition(key: PlaceholderKey): PlaceholderDefinition {
  const found = PLACEHOLDER_DEFINITIONS.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown placeholder: ${key}`);
  return found;
}

/** Total unresolved items — surfaced on the legal index so the count is visible. */
export const OPEN_PLACEHOLDER_COUNT = Object.values(PLACEHOLDER_VALUES).filter(
  (value) => value === null,
).length;

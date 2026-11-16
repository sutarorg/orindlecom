/**
 * Approved legal and operational disclosures.
 *
 * Every value here reflects an explicit product or policy decision approved for
 * publication. Where an optional corporate registration detail does not apply
 * (for example, Orindle is not designated a Significant Data Fiduciary), that
 * fact is stated plainly rather than invented.
 */

import { SITE } from "@/config/site";
import type { PlaceholderKey } from "./types";

export interface PlaceholderDefinition {
  key: PlaceholderKey;
  label: string;
  why: string;
  owner: string;
}

export const PLACEHOLDER_DEFINITIONS: PlaceholderDefinition[] = [
  {
    key: "legalEntity",
    label: "Service operator",
    why: "Identifies the operator of Orindle across policies and terms.",
    owner: "Orindle",
  },
  {
    key: "registeredAddress",
    label: "Operating jurisdiction",
    why: "States where Orindle is operated from and how correspondence is received.",
    owner: "Orindle",
  },
  {
    key: "businessContact",
    label: "Data and privacy contact",
    why: "Published contact address for data protection and privacy inquiries.",
    owner: "Orindle",
  },
  {
    key: "dpoName",
    label: "Data Protection Officer",
    why: "Clarifies SDF / DPO applicability under the DPDP Act 2023.",
    owner: "Orindle",
  },
  {
    key: "grievanceOfficer",
    label: "Grievance contact",
    why: "Published grievance contact with 48-hour acknowledgement and 1-month resolution.",
    owner: "Orindle",
  },
  {
    key: "hostingRegions",
    label: "Hosting infrastructure",
    why: "Names the cloud infrastructure providers holding account data and files.",
    owner: "Orindle",
  },
  {
    key: "subProcessors",
    label: "Sub-processor list",
    why: "Complete list of third-party infrastructure providers processing data for Orindle.",
    owner: "Orindle",
  },
  {
    key: "transferMechanism",
    label: "International data transfers",
    why: "Describes how cross-border transfers are protected under DPDP, GDPR and UK GDPR.",
    owner: "Orindle",
  },
  {
    key: "retentionPeriods",
    label: "Retention periods",
    why: "Approved retention schedule for files, trash, accounts, security logs and billing records.",
    owner: "Orindle",
  },
  {
    key: "backupWindow",
    label: "Backup rotation",
    why: "Describes how deleted records age out of infrastructure backups.",
    owner: "Orindle",
  },
  {
    key: "subscriptionRefund",
    label: "Cancellation and refund terms",
    why: "Approved cancellation, renewal and refund terms for monthly and annual plans.",
    owner: "Orindle",
  },
  {
    key: "deletionSla",
    label: "Account deletion timeline",
    why: "7-day read-only grace period followed by automated permanent purge.",
    owner: "Orindle",
  },
  {
    key: "governingLaw",
    label: "Governing law",
    why: "Applicable law and preservation of mandatory local consumer protections.",
    owner: "Orindle",
  },
  {
    key: "minimumAge",
    label: "Minimum age",
    why: "Minimum age requirement for holding an Orindle account.",
    owner: "Orindle",
  },
];

/** Approved policy values. Zero unresolved placeholders. */
export const PLACEHOLDER_VALUES: Record<PlaceholderKey, string | null> = {
  legalEntity: "Orindle (orindle.com), operated independently from India.",
  registeredAddress: `Operated from India. Written correspondence and formal notices are received electronically at ${SITE.supportEmail}.`,
  businessContact: `Privacy and data protection inquiries: ${SITE.supportEmail} (or through orindle.com/contact?subject=privacy).`,
  dpoName: `Orindle has not been notified as a Significant Data Fiduciary under the DPDP Act 2023. All privacy and data-protection requests are handled directly at ${SITE.supportEmail}.`,
  grievanceOfficer: `Grievance contact: Orindle Support (${SITE.supportEmail}). Complaints are acknowledged within 48 hours and resolved within one month.`,
  hostingRegions: "Account metadata is hosted on Supabase (managed PostgreSQL), file objects are stored in Cloudflare R2 private object storage, and the web application is served via Vercel.",
  subProcessors: "Supabase (auth and PostgreSQL database), Cloudflare R2 (private object storage), Razorpay (payments and billing), Resend (transactional email), Vercel (application hosting), and Cloudflare Turnstile (anti-bot verification on auth forms).",
  transferMechanism: "Cross-border transfers follow section 16 of India's DPDP Act 2023 and rely on our infrastructure providers' contractual data-protection commitments and Standard Contractual Clauses where GDPR or UK GDPR applies.",
  retentionPeriods: "Trash items are retained for 30 days before permanent deletion; scheduled account deletions have a 7-day read-only grace period before automated purge; anti-abuse sign-up records are retained for 30 days and security events for 90 days; billing records are retained as required by applicable accounting and tax law.",
  backupWindow: "Deleted files are removed immediately from primary object storage upon Trash purge or account purge; any remaining copies in managed infrastructure backups are never restored to active accounts and age out on the provider's rolling rotation cycle.",
  subscriptionRefund: "You can cancel a monthly or annual subscription at any time from Billing. Your paid storage remains active until the end of the billing period you paid for, then reverts to Free without deleting files. Partial-period refunds are not issued automatically; if you believe you were charged in error or have a statutory withdrawal right in your jurisdiction, write to tejassutar.business@gmail.com.",
  deletionSla: "Self-service account deletion enters a 7-day read-only grace period (cancelled automatically if you sign back in) and is permanently purged by the automated job once the 7-day period elapses.",
  governingLaw: "These terms are governed by the laws of India, without limiting any mandatory consumer-protection rights provided by the laws of the country where you reside.",
  minimumAge: "You must be at least 18 years old (or the age of digital consent in your jurisdiction, if higher) to create an Orindle account.",
};

export function placeholderDefinition(key: PlaceholderKey): PlaceholderDefinition {
  const found = PLACEHOLDER_DEFINITIONS.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown placeholder: ${key}`);
  return found;
}

/** Total unresolved items — 0 once all policies are approved. */
export const OPEN_PLACEHOLDER_COUNT = Object.values(PLACEHOLDER_VALUES).filter(
  (value) => value === null,
).length;

/**
 * Legal document model.
 *
 * Policies are data, not JSX, for one reason: the same content has to render as
 * a full page, a table of contents, a section navigator and a set of deep-link
 * anchors. Holding it as structured blocks means those four surfaces cannot
 * disagree with each other.
 */

/** Facts Orindle's owner has not confirmed yet. Never invented — always shown as open. */
export type PlaceholderKey =
  | "legalEntity"
  | "registeredAddress"
  | "businessContact"
  | "dpoName"
  | "grievanceOfficer"
  | "hostingRegions"
  | "subProcessors"
  | "transferMechanism"
  | "retentionPeriods"
  | "backupWindow"
  | "subscriptionRefund"
  | "deletionSla"
  | "governingLaw"
  | "minimumAge";

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "sub"; heading: string; blocks: LegalBlock[] }
  | { type: "note"; tone: "info" | "warning" | "critical"; title?: string; text: string }
  | { type: "placeholder"; key: PlaceholderKey; note?: string }
  | { type: "table"; head: string[]; rows: string[][]; caption?: string }
  | { type: "definitions"; items: Array<{ term: string; text: string }> };

export interface LegalSection {
  /** Stable anchor. Never change without redirecting the old one. */
  id: string;
  heading: string;
  /** One line, shown in the table of contents under the heading on wide screens. */
  gist?: string;
  blocks: LegalBlock[];
  /** Marks a section that needs a qualified lawyer before publication. */
  review?: string;
}

export type LegalDocId =
  | "privacy"
  | "terms"
  | "cookies"
  | "acceptable-use"
  | "data-deletion";

export interface LegalDocument {
  id: LegalDocId;
  path: string;
  title: string;
  /** Shown under the title, and in the legal index. */
  summary: string;
  /** ISO date of the last substantive edit to this draft. */
  updated: string;
  /** What this document is for, in one sentence for the index card. */
  purpose: string;
  sections: LegalSection[];
}

/**
 * The legal document registry.
 *
 * Adding a policy means adding it here. The index page, the footer, the sitemap
 * and the cross-links between documents all read from this array, so a new policy
 * cannot exist without being linked from somewhere.
 */

import { PRIVACY_POLICY } from "./privacy";
import { TERMS_OF_SERVICE } from "./terms";
import { COOKIE_POLICY } from "./cookies";
import { ACCEPTABLE_USE_POLICY } from "./acceptable-use";
import { DATA_DELETION_POLICY } from "./data-deletion";
import type { LegalDocId, LegalDocument } from "./types";

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
  COOKIE_POLICY,
  ACCEPTABLE_USE_POLICY,
  DATA_DELETION_POLICY,
];

export function legalDocument(id: LegalDocId): LegalDocument {
  const found = LEGAL_DOCUMENTS.find((doc) => doc.id === id);
  if (!found) throw new Error(`Unknown legal document: ${id}`);
  return found;
}

export function legalDocumentByPath(path: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.path === path);
}

/** Total sections needing a lawyer, across every document. */
export const LEGAL_REVIEW_ITEM_COUNT = LEGAL_DOCUMENTS.reduce(
  (total, doc) => total + doc.sections.filter((section) => section.review).length,
  0,
);

export type { LegalDocId, LegalDocument, LegalSection, LegalBlock } from "./types";

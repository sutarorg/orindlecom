import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { DATA_DELETION_POLICY } from "@/config/legal/data-deletion";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.dataDeletion);

export default function Page() {
  return <LegalDocumentPage document={DATA_DELETION_POLICY} />;
}

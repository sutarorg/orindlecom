import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { ACCEPTABLE_USE_POLICY } from "@/config/legal/acceptable-use";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.acceptableUse);

export default function Page() {
  return <LegalDocumentPage document={ACCEPTABLE_USE_POLICY} />;
}

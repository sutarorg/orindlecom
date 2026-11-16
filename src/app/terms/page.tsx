import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { TERMS_OF_SERVICE } from "@/config/legal/terms";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.terms);

export default function Page() {
  return <LegalDocumentPage document={TERMS_OF_SERVICE} />;
}

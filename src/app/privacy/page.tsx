import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { PRIVACY_POLICY } from "@/config/legal/privacy";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.privacy);

export default function Page() {
  return <LegalDocumentPage document={PRIVACY_POLICY} />;
}

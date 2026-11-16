import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { COOKIE_POLICY } from "@/config/legal/cookies";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.cookies);

export default function Page() {
  return <LegalDocumentPage document={COOKIE_POLICY} />;
}

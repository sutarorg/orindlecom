import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { TERMS_OF_SERVICE } from "@/config/legal/terms";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description:
    "The agreement between you and Orindle: what the service is, what you may store, how billing works, and how either side ends it.",
  path: "/terms",
});

export default function Page() {
  return <LegalDocumentPage document={TERMS_OF_SERVICE} />;
}

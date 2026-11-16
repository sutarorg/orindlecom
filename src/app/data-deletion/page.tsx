import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { DATA_DELETION_POLICY } from "@/config/legal/data-deletion";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Data deletion",
  description:
    "What happens to your files, your account and your backups when you delete something — and what is kept, and why.",
  path: "/data-deletion",
});

export default function Page() {
  return <LegalDocumentPage document={DATA_DELETION_POLICY} />;
}

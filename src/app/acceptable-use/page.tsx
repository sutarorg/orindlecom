import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { ACCEPTABLE_USE_POLICY } from "@/config/legal/acceptable-use";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Acceptable use",
  description:
    "What may not be stored on Orindle, what happens when a line is crossed, and how to report something.",
  path: "/acceptable-use",
});

export default function Page() {
  return <LegalDocumentPage document={ACCEPTABLE_USE_POLICY} />;
}

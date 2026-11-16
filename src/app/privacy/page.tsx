import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { PRIVACY_POLICY } from "@/config/legal/privacy";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "What Orindle collects, why, where it is stored, and how to get a copy of your data or have it deleted. A draft policy with open questions shown rather than guessed at.",
  path: "/privacy",
});

export default function Page() {
  return <LegalDocumentPage document={PRIVACY_POLICY} />;
}

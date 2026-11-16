import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { COOKIE_POLICY } from "@/config/legal/cookies";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Cookies",
  description:
    "The three things Orindle stores on your device, why none of them needs a consent banner, and how to remove them.",
  path: "/cookies",
});

export default function Page() {
  return <LegalDocumentPage document={COOKIE_POLICY} />;
}

import type { Metadata } from "next";
import { HelpHome } from "@/components/help/help-home";
import { approvedMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/config/seo-pages";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.help);

export default function HelpPage() {
  return <HelpHome />;
}

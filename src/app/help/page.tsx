import type { Metadata } from "next";
import { HelpHome } from "@/components/help/help-home";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Help centre",
  description:
    "Answers about your account, storage, files, sharing, billing and business workspaces — written to describe what Orindle actually does.",
  path: "/help",
});

export default function HelpPage() {
  return <HelpHome />;
}

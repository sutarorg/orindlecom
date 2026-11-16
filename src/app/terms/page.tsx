import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description:
    "The terms that apply to using Orindle: acceptable use, your ownership of your files, plan and billing terms, and what we do and do not promise.",
  path: "/terms",
});

const SECTIONS: LegalSection[] = [
  {
    heading: "Using Orindle",
    body: [
      "You need to be old enough to enter a contract in your jurisdiction to hold an account. You are responsible for keeping your sign-in credentials secure and for activity that happens under your account.",
    ],
  },
  {
    heading: "Your files stay yours",
    body: [
      "You keep ownership of everything you upload. You grant Orindle only the permission needed to store, transmit and display your files back to you and to the people you choose to share them with.",
      "You can download your data and delete it at any time. We do not claim a licence to use your content for any other purpose, and we do not mine it.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not use Orindle to store or distribute material that is illegal, that infringes someone else's rights, or that is designed to harm other systems. Do not attempt to access another account, probe the service for vulnerabilities without permission, or resell storage capacity.",
      "Accounts found in serious breach may be suspended. Where it is reasonable and lawful to do so, we will tell you why and give you a route to respond.",
    ],
  },
  {
    heading: "Plans and storage",
    body: [
      "Storage allowances are shared across every device signed in to your account. The free tier provides 10 GB. Paid tiers are monthly and are listed on the pricing page.",
      "If your usage exceeds your plan's allowance you will not be able to add new files until you remove some or upgrade. Existing files remain accessible.",
    ],
  },
  {
    heading: "Billing",
    body: [
      "Paid plans are billed monthly in advance through Razorpay in the currency shown at checkout. Your billing currency is fixed at the time you subscribe and is not changed retroactively by altering your display currency.",
      "Annual pricing is not offered yet. When you cancel, your plan returns to the free tier at the end of the current billing period rather than terminating immediately.",
      "A refund policy has not been finalised. Until it is published, contact support for any billing dispute and you will receive a direct answer.",
    ],
  },
  {
    heading: "Availability",
    body: [
      "We aim to keep the service available continuously, but no service is perfect and no uptime guarantee is offered today. Planned maintenance will be communicated in advance where practical.",
      "You should keep your own backup of anything you cannot afford to lose. Orindle is a storage product, not a substitute for a considered backup strategy.",
    ],
  },
  {
    heading: "Ending the agreement",
    body: [
      "You can stop using Orindle and delete your account whenever you want. We may suspend or close an account for a material breach of these terms, or where required by law.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "Material changes will be described on this page with a new review date. If you keep using the service after a change, you accept the updated terms.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      description="Your rights, your files, and the limits of what we promise."
      updated="16 November 2026"
      pendingNotice="These terms are under legal review before paid plans open. They describe how Orindle is operated today, but they are not yet a finalised legal contract."
      sections={SECTIONS}
    />
  );
}

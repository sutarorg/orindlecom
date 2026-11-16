import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/layout/legal-page";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "What Orindle collects, why, where it is stored, and how to get a copy of your data or have it deleted. Written to be read, not to protect us.",
  path: "/privacy",
});

const SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    body: [
      "Account data: the email address you register with, your display name, and a hashed password if you sign in with one. If you sign in with a third-party provider, we receive the identifier that provider issues — not your password.",
      "File data: the files and folders you upload, plus the metadata needed to show them to you (name, size, type, timestamps and parent folder).",
      "Billing data: if you subscribe, our payment processor Razorpay holds your payment method. Orindle stores only the identifiers needed to map a subscription to your account. We never see or store your full card number.",
      "Technical data: standard server logs (IP address, user agent, timestamps) and error reports, used to operate and secure the service.",
    ],
  },
  {
    heading: "Why we hold it",
    body: [
      "To provide the storage service you asked for, to authenticate you, to take payment for a paid plan, to answer support requests, and to keep the service secure. We do not sell personal data, and we do not share it with advertisers.",
    ],
  },
  {
    heading: "Where it lives",
    body: [
      "Application data and authentication records are held in Supabase (PostgreSQL). File contents are held in Cloudflare R2 object storage, encrypted at rest. Both are reputable infrastructure providers acting as processors on our behalf.",
      "Transfers happen over TLS. Access to production data is limited to what operating the service requires.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Account data is kept while your account exists. Files are kept until you delete them; deleted items sit in Trash before being removed permanently. Server logs are retained for a short operational window and then discarded.",
      "If you close your account, your files and account record are deleted. Billing records may be retained where tax law requires it.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You can access, correct, export or delete your data at any time. You can download individual files or your whole library, and you can ask for permanent deletion.",
      "To make a request, use the contact form with the Privacy subject. You will receive a direct reply describing exactly what will happen and when.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "Essential cookies keep you signed in and remember your chosen display currency. We do not run third-party advertising trackers on this site.",
    ],
  },
  {
    heading: "Changes",
    body: [
      "If this policy changes materially, the change will be described on this page with a new review date. Continuing to use the service after a change means you accept the updated policy.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy"
      description="What we collect, where it is stored, and how to get it back or get it deleted."
      updated="16 November 2026"
      pendingNotice="This policy is under legal review before paid plans open. It accurately describes current practice, but it is not yet a finalised legal document — if you need terms for a compliance review, write to us and we will tell you where things stand."
      sections={SECTIONS}
    />
  );
}

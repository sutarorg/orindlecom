import type { Metadata } from "next";
import { Clock, Mail, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { ContactForm } from "@/components/forms/contact-form";
import { SITE } from "@/config/site";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Questions about plans, storage, billing or privacy? Send Orindle a message and you will get a reply from a real person.",
  path: "/contact",
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const allowed = ["sales", "support", "billing", "privacy", "other"];
  const defaultSubject = allowed.includes(subject ?? "") ? subject : "support";

  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.65),rgba(223,244,242,0.34)_50%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Contact"
            title="Talk to us directly."
            description="Whether it is a plan question, a bug, or something that concerns your data, this reaches a person rather than a ticket queue."
          />
        </div>
      </section>

      <section className="pb-16 pt-9 sm:pb-20 sm:pt-12">
        <div className="container-or">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
            <div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-5 shadow-[var(--brand-shadow-sm)] sm:p-7">
              <h2 className="text-[length:var(--brand-body-size)] font-bold text-ink">
                Send a message
              </h2>
              <p className="mt-1.5 text-[length:var(--brand-body-sm-size)] leading-relaxed text-text-muted">
                All fields are required. Nothing here is stored beyond what it takes to reply.
              </p>
              <div className="mt-5">
                <ContactForm defaultSubject={defaultSubject} />
              </div>
            </div>

            <div className="space-y-3">
              <InfoCard
                icon={Mail}
                title="Email"
                body={
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="font-semibold text-primary-ink underline decoration-[var(--brand-primary-soft-2)] underline-offset-2 hover:decoration-primary"
                  >
                    {SITE.supportEmail}
                  </a>
                }
              />
              <InfoCard
                icon={Clock}
                title="Response time"
                body="Usually within two business days. Billing and data-deletion requests are prioritised."
              />
              <InfoCard
                icon={ShieldCheck}
                title="Privacy requests"
                body="Ask for a copy of your data or its deletion using the Privacy subject. You will get a direct reply with what happens next."
              />

              <div className="rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4">
                <p className="text-[12px] font-semibold text-ink">Before you write</p>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-text-muted">
                  <li>Plan limits, currencies and billing periods are all covered on the pricing page.</li>
                  <li>Security architecture, and what we do not claim, is on the security page.</li>
                  <li>Most product questions are already answered in the FAQ.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-[14px] border border-[var(--brand-border)] bg-white p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
      </span>
      <div>
        <p className="text-[12.5px] font-bold leading-tight text-ink">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{body}</p>
      </div>
    </div>
  );
}

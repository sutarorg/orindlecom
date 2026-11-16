import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FolderLock, HardDrive, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { StorageMeter } from "@/components/product/storage-meter";
import { ALL_FAQ } from "@/config/faq";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.business);

const CAPABILITIES = [
  {
    icon: Building2,
    title: "One organisation account",
    body: "The organisation owns the storage and the billing. Files belong to the company, not to whichever employee uploaded them, so people can leave without taking the library with them.",
  },
  {
    icon: Users,
    title: "Members with roles",
    body: "Invite people into the organisation and assign them an Owner, Admin or Member role. Access is granted to a person at invite time, never shared through a password everyone knows.",
  },
  {
    icon: HardDrive,
    title: "A shared storage pool",
    body: "Team members draw from one organisation-level allowance. You can see total usage, so nobody has to guess whose quota is about to run out.",
  },
  {
    icon: FolderLock,
    title: "Folder-level permissions",
    body: "Restrict a folder to specific members or to a role. When someone changes team, one permission change closes every file inside it.",
  },
  {
    icon: ShieldCheck,
    title: "Administrative controls",
    body: "Admins manage members, roles, permissions and billing from a single place, and can revoke access immediately.",
  },
  {
    icon: ReceiptText,
    title: "Centralised billing",
    body: "One invoice for the organisation rather than a dozen personal subscriptions, with the plan tied to the org rather than an individual.",
  },
] as const;

export default function BusinessPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(227,230,254,0.8),rgba(223,244,242,0.34)_50%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Business"
            title="A simpler space for your team's files."
            description="An organisation workspace gives your team one shared pool of space, clear Owner / Admin / Member roles, and folder permissions that hold — included under your Orindle storage plan with no per-seat fee."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {CAPABILITIES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-[14px] border border-[var(--brand-border)] bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden="true" />
                </span>
                <h2 className="mt-3.5 text-[length:var(--brand-body-size)] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
                  {title}
                </h2>
                <p className="mt-2 text-[length:var(--brand-body-sm-size)] leading-[1.65] tracking-[-0.012em] text-text-muted">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* honest status panel */}
      <section className="py-8 sm:py-12">
        <div className="container-or">
          <div className="grid gap-6 rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-center lg:gap-10">
            <div>
              <h2 className="text-[length:var(--brand-body-size)] font-bold text-ink">
                Included with your plan — no per-seat fee
              </h2>
              <p className="mt-2 max-w-[60ch] text-[length:var(--brand-body-sm-size)] leading-[1.65] text-text-muted">
                Every Business workspace inherits the organisation owner&rsquo;s active storage
                plan — from 10 GB Free up to 5 TB Max — with no separate per-user seat surcharge.
                Create your organisation right from your dashboard, invite teammates as Admins or
                Members, and manage folder permissions in one place.
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  href="/dashboard/business"
                  className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Open Business workspace
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-9 items-center rounded-full border border-[var(--brand-border-strong)] bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)]"
                >
                  Compare storage plans
                </Link>
              </div>
            </div>

            <div className="rounded-[12px] border border-[var(--brand-border)] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                Organisation allowance
              </p>
              <div className="mt-3">
                <StorageMeter used={0} total={500 * 1000 ** 3} />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-text-subtle">
                A shared pool is metered for the whole organisation. This preview shows the meter
                a new team would see on day one.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FaqSection
        items={ALL_FAQ.filter((item) => item.category === "Business")}
        title="Business questions."
      />
      <CtaBand />
    </SiteShell>
  );
}

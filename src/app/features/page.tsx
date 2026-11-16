import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, Folder, FolderTree, Gauge, ShieldCheck, Smartphone } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { StorageBand } from "@/components/marketing/storage-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { FileManager, SAMPLE_FOLDERS } from "@/components/product/file-manager";
import { StorageMeter } from "@/components/product/storage-meter";
import { ALL_FAQ } from "@/config/faq";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.features);

const FEATURE_FAQ = ALL_FAQ.filter((item) =>
  ["Files & sharing", "Storage & plans"].includes(item.category),
);

const DEEP_DIVES = [
  {
    id: "organise",
    eyebrow: "Organisation",
    title: "A folder tree that behaves like one.",
    body: "Nest folders as deep as your work needs. Moving a folder takes its contents with it, searching looks inside every level, and nothing lands in a mystery location.",
    points: ["Unlimited nesting", "Move a folder with its contents", "Search across every level"],
    icon: FolderTree,
  },
  {
    id: "access",
    eyebrow: "Access",
    title: "The same library, on every screen.",
    body: "Storage is one pool per account, not a copy per device. Open a file on your phone in the morning and finish it on a laptop at night without syncing duplicates.",
    points: ["One shared allowance", "No plugin or desktop install", "Works in any current browser"],
    icon: Smartphone,
  },
  {
    id: "capacity",
    eyebrow: "Capacity",
    title: "Know exactly where you stand.",
    body: "A single meter tells you what you have used and what is left. Above 80% it turns amber, at capacity it turns red — and the number is always written out too.",
    points: ["Usage visible at a glance", "Never colour-only", "Upgrade without losing files"],
    icon: Gauge,
  },
  {
    id: "exit",
    eyebrow: "Portability",
    title: "Your files stay yours.",
    body: "Download a single file or your whole library whenever you want, and delete your data permanently when you are done. Nothing about Orindle is designed to trap your files.",
    points: ["Download anything, any time", "Permanent deletion on request", "No export fee"],
    icon: Download,
  },
] as const;

export default function FeaturesPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(231,226,253,0.65),rgba(223,244,242,0.42)_48%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Features"
            title="Everything you need. Nothing you don't."
            description="Every screen below is a working component of Orindle, not an illustration. Where a capability is not built yet, we say so instead of drawing it."
          />
        </div>
      </section>

      {/* ---------- live file manager ---------- */}
      <section className="pb-10 pt-9 sm:pb-14 sm:pt-12">
        <div className="container-or">
          <div className="mx-auto max-w-[860px]">
            <FileManager folders={SAMPLE_FOLDERS} connected={false} />
            <p className="mt-3 text-center text-[11.5px] leading-relaxed text-text-subtle">
              Interactive preview. Search filters the folders, the grid/list switch works, and
              upload is disabled because this page runs without a storage connection.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- deep dives ---------- */}
      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="space-y-14 lg:space-y-20">
            {DEEP_DIVES.map(({ id, eyebrow, title, body, points, icon: Icon }, index) => (
              <div
                key={id}
                id={id}
                className="grid items-center gap-7 lg:grid-cols-2 lg:gap-16"
              >
                <div className={cn(index % 2 === 1 && "lg:order-2")}>
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    {eyebrow}
                  </p>
                  <h2 className="mt-3 text-[length:var(--brand-h2-size)] font-extrabold leading-[1.22] tracking-[var(--brand-h2-tracking)] text-ink">
                    {title}
                  </h2>
                  <p className="mt-3 max-w-[46ch] text-[length:var(--brand-body-size)] leading-[1.62] tracking-[var(--brand-body-tracking)] text-text-muted">
                    {body}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-[length:var(--brand-body-sm-size)] text-text">
                        <span
                          aria-hidden="true"
                          className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={cn("relative", index % 2 === 1 && "lg:order-1")}>
                  <DeepDiveVisual index={index} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StorageBand />

      {/* ---------- security pointer ---------- */}
      <section className="py-10 sm:py-12">
        <div className="container-or">
          <div className="flex flex-col items-start gap-4 rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft">
                <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[length:var(--brand-body-size)] font-bold text-ink">
                  How your files are protected
                </p>
                <p className="mt-1 max-w-[52ch] text-[length:var(--brand-body-sm-size)] leading-relaxed text-text-muted">
                  TLS in transit, encryption at rest, and per-request authorisation. We describe
                  the architecture exactly as it is — including what we have not certified yet.
                </p>
              </div>
            </div>
            <Link
              href="/security"
              className="inline-flex shrink-0 items-center gap-1.5 text-[length:var(--brand-body-sm-size)] font-semibold text-primary-ink hover:text-primary"
            >
              Read the security page
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.3} />
            </Link>
          </div>
        </div>
      </section>

      <FaqSection items={FEATURE_FAQ} title="Feature questions." />
      <CtaBand />
    </SiteShell>
  );
}

/**
 * Four small, honest visuals for the deep-dive rows. Each is drawn in code and
 * each shows a real part of the interface rather than decoration.
 */
function DeepDiveVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4 shadow-[var(--brand-shadow-md)]">
        <ul className="space-y-1.5">
          {[
            { depth: 0, label: "My Files", open: true },
            { depth: 1, label: "Documents", open: true },
            { depth: 2, label: "Invoices" },
            { depth: 2, label: "Contracts" },
            { depth: 1, label: "Photos" },
            { depth: 1, label: "Projects" },
          ].map((node, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]",
                node.open ? "text-ink" : "text-text-muted",
              )}
              style={{ marginLeft: node.depth * 18 }}
            >
              <Folder
                className={cn("h-3.5 w-3.5", node.open ? "text-primary" : "text-text-subtle")}
                strokeWidth={2}
                aria-hidden="true"
              />
              {node.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="relative flex items-end justify-center gap-3 rounded-[16px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-6">
        <div className="w-[46%] overflow-hidden rounded-lg border-[3px] border-[#1B2036] bg-white shadow-[var(--brand-shadow-md)]">
          <div className="h-16 bg-[linear-gradient(160deg,#EAF1FF,#F7F9FD)] p-2">
            <div className="h-1.5 w-8 rounded-full bg-primary/70" />
            <div className="mt-2 grid grid-cols-3 gap-1">
              <span className="h-5 rounded bg-white" />
              <span className="h-5 rounded bg-white" />
              <span className="h-5 rounded bg-white" />
            </div>
          </div>
        </div>
        <div className="w-[26%] overflow-hidden rounded-md border-[3px] border-[#1B2036] bg-white shadow-[var(--brand-shadow-md)]">
          <div className="h-14 bg-[linear-gradient(160deg,#EAF1FF,#F7F9FD)] p-1.5">
            <div className="h-1 w-5 rounded-full bg-primary/70" />
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              <span className="h-4 rounded bg-white" />
              <span className="h-4 rounded bg-white" />
            </div>
          </div>
        </div>
        <div className="w-[14%] overflow-hidden rounded-md border-[2.5px] border-[#1B2036] bg-white shadow-[var(--brand-shadow-md)]">
          <div className="h-12 bg-[linear-gradient(160deg,#EAF1FF,#F7F9FD)] p-1">
            <div className="h-1 w-4 rounded-full bg-primary/70" />
            <div className="mt-1 grid grid-cols-2 gap-1">
              <span className="h-3 rounded bg-white" />
              <span className="h-3 rounded bg-white" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="space-y-4 rounded-[16px] border border-[var(--brand-border)] bg-white p-5 shadow-[var(--brand-shadow-md)]">
        <StorageMeter used={8.2 * 1000 ** 3} total={10 * 1000 ** 3} />
        <StorageMeter used={9.4 * 1000 ** 3} total={10 * 1000 ** 3} />
        <StorageMeter used={10 * 1000 ** 3} total={10 * 1000 ** 3} />
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Three example states: comfortable, above 80% (amber), and full (red). The value is
          always written out, never colour alone.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-[var(--brand-border)] bg-white p-4 shadow-[var(--brand-shadow-md)]">
      <div className="flex items-center justify-between border-b border-[var(--brand-border-soft)] pb-2.5">
        <span className="text-[12px] font-semibold text-ink">Export library</span>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-ink">
          No fee
        </span>
      </div>
      <ul className="mt-2.5 space-y-2">
        {["Download a single file", "Download a whole folder", "Delete everything, permanently"].map(
          (row, i) => (
            <li key={row} className="flex items-center justify-between text-[12px] text-text">
              {row}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  i === 2
                    ? "bg-[#FDECEC] text-[#C93B2B]"
                    : "bg-[#E9F8F0] text-[#1E8E5A]",
                )}
              >
                {i === 2 ? "Permanent" : "Anytime"}
              </span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

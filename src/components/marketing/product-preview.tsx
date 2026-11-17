import Link from "next/link";
import { ArrowRight, FolderTree, History, ShieldCheck, Share2 } from "lucide-react";
import { EmptyLibraryPreview } from "@/components/product/empty-library-preview";
import { SectionHeading } from "./section-heading";

/**
 * Product preview.
 *
 * Placed after the storage band. This is where the reference's language is
 * extended with an actual, honest interface: the empty state of a new Orindle
 * library, framed by four product facts. No testimonials, no fabricated
 * customer data, no numbers we cannot stand behind.
 */
const POINTS = [
  {
    icon: FolderTree,
    title: "A structure you choose",
    body: "Nested folders, not a flat pile. Move things once and they stay put.",
  },
  {
    icon: Share2,
    title: "Sharing on your terms",
    body: "Invite specific people or send a link, with view or comment access you can revoke.",
  },
  {
    icon: History,
    title: "Trash, not regret",
    body: "Deleted files rest in Trash before they are gone, so a mistake is recoverable.",
  },
  {
    icon: ShieldCheck,
    title: "Encrypted end to end in transit",
    body: "TLS in flight, encryption at rest, and access checks on every request.",
  },
] as const;

export function ProductPreview() {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_90%_at_50%_0%,rgba(227,230,254,0.5),rgba(255,255,255,0)_70%)]"
      />
      <div className="container-or">
        <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div className="order-2 lg:order-1">
            <EmptyLibraryPreview />
          </div>

          <div className="order-1 lg:order-2">
            <SectionHeading className="max-w-[16ch]">
              This is what a new library looks like.
            </SectionHeading>
            <p className="mt-3 max-w-[42ch] text-[length:var(--brand-body-size)] leading-[1.62] tracking-[var(--brand-body-tracking)] text-text-muted">
              We would rather show you the real starting point than a mock-up full of files you
              do not have. Everything below is what the product actually does today.
            </p>

            <ul className="mt-7 space-y-5">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary-soft">
                    <Icon className="h-4 w-4 text-primary" strokeWidth={1.9} />
                  </span>
                  <div>
                    <p className="text-[length:var(--brand-body-size)] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
                      {title}
                    </p>
                    <p className="mt-1 max-w-[40ch] text-[length:var(--brand-body-sm-size)] leading-[1.6] tracking-[-0.015em] text-text-muted">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/features"
              className="mt-7 inline-flex items-center gap-1.5 text-[length:var(--brand-body-sm-size)] font-semibold text-primary-ink transition-colors hover:text-primary"
            >
              See the full product tour
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.3} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

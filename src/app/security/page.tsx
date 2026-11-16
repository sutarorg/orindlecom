import type { Metadata } from "next";
import { KeyRound, Lock, ScrollText, ServerCog, ShieldCheck, UserCheck } from "lucide-react";
import { SiteShell } from "@/components/layout/site-shell";
import { PageIntro } from "@/components/marketing/section-heading";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq-section";
import { ALL_FAQ } from "@/config/faq";
import { PAGE_SEO } from "@/config/seo-pages";
import { approvedMetadata } from "@/lib/seo";

export const metadata: Metadata = approvedMetadata(PAGE_SEO.security);

const PILLARS = [
  {
    icon: Lock,
    title: "Encrypted in transit",
    body: "Every request to Orindle travels over TLS. Uploads go straight from your browser to object storage over an authenticated, time-limited session rather than through a shared application server.",
  },
  {
    icon: ServerCog,
    title: "Encrypted at rest",
    body: "Files live in Cloudflare R2 object storage, which encrypts data at rest. Objects are stored under random keys, so a filename alone never reveals a location.",
  },
  {
    icon: KeyRound,
    title: "Short-lived signed access",
    body: "Downloads are issued as signed URLs that expire. Nobody can construct a permanent public address for a private file by guessing it, and revoking sharing stops new links immediately.",
  },
  {
    icon: UserCheck,
    title: "Authorisation on every request",
    body: "Access checks run on the server for every read and write, using database row-level security so one account can never query another account's rows — even if a client is tampered with.",
  },
  {
    icon: ShieldCheck,
    title: "Scoped secrets",
    body: "Service credentials live only in server-side environment variables. Nothing privileged is shipped to the browser, and no key is committed to the repository.",
  },
  {
    icon: ScrollText,
    title: "Least-privilege billing",
    body: "Payment processing is handled by Razorpay. Card data never touches Orindle's servers, and webhooks are signature-verified before they can change a subscription.",
  },
] as const;

const DATA_FLOW = [
  {
    step: "01",
    title: "You sign in",
    body: "Supabase Auth verifies your identity and returns a short-lived session token.",
  },
  {
    step: "02",
    title: "Orindle authorises",
    body: "The server checks your session and your row-level permissions for the folder you asked for.",
  },
  {
    step: "03",
    title: "Storage issues a signed URL",
    body: "Cloudflare R2 hands back a one-time, expiring upload or download URL scoped to a single object.",
  },
  {
    step: "04",
    title: "Bytes move directly",
    body: "Your file travels between your browser and R2. It is never buffered on the application server.",
  },
] as const;

export default function SecurityPage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 sm:pt-14 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(223,244,242,0.75),rgba(231,226,253,0.42)_48%,rgba(255,255,255,0)_74%)]"
        />
        <div className="container-or">
          <PageIntro
            eyebrow="Security"
            title="Your files deserve thoughtful protection."
            description="This page explains the architecture as it is built. It does not list certifications Orindle does not hold — that would be a claim, not a security practice."
          />
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-[14px] border border-[var(--brand-border)] bg-white p-5"
              >
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

      {/* data flow */}
      <section className="py-10 sm:py-14">
        <div className="container-or">
          <h2 className="text-[length:var(--brand-h2-size)] font-extrabold tracking-[var(--brand-h2-tracking)] text-ink">
            What happens when you open a file
          </h2>
          <p className="mt-2 max-w-[56ch] text-[length:var(--brand-body-size)] leading-[1.6] tracking-[var(--brand-body-tracking)] text-text-muted">
            Four steps, each with a narrowly scoped credential. The application server never
            holds your file content.
          </p>

          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DATA_FLOW.map(({ step, title, body }) => (
              <li
                key={step}
                className="relative rounded-[14px] border border-[var(--brand-border)] bg-[var(--brand-canvas)] p-4"
              >
                <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                  {step}
                </span>
                <p className="mt-3 text-[13px] font-bold leading-tight text-ink">{title}</p>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* what we do not claim */}
      <section className="py-10 sm:py-14">
        <div className="container-or">
          <div className="rounded-[16px] border border-[var(--brand-border-strong)] bg-[var(--brand-canvas)] p-5 sm:p-7">
            <h2 className="text-[length:var(--brand-body-size)] font-bold text-ink">
              What Orindle does not claim
            </h2>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {[
                "No SOC 2, ISO 27001 or HIPAA certification is held today.",
                "No third-party penetration test has been published yet.",
                "No end-to-end zero-knowledge encryption — the service can decrypt data to serve it to you.",
                "No enterprise SSO or SCIM provisioning — those are on the roadmap, not shipped.",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] leading-[1.6] text-text"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#F9A53B]"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-text-muted">
              If a certification becomes relevant to your organisation, write to support and we
              will tell you precisely where things stand rather than sending a badge we have not
              earned.
            </p>
          </div>
        </div>
      </section>

      <FaqSection
        items={ALL_FAQ.filter((item) => item.category === "Privacy & security")}
        title="Privacy and security questions."
      />
      <CtaBand />
    </SiteShell>
  );
}

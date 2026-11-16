import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

/**
 * The quiet column beside the card on wide viewports.
 *
 * It exists to stop a 920px grid leaving half the screen empty. The content is
 * deliberately *not* a testimonial, a customer logo wall or a stat — this site
 * publishes none of those. What it carries instead is the same promise the
 * marketing pages make, restated where someone about to hand over an email
 * address will actually read it.
 */
export function AuthAside({ variant }: { variant: "login" | "signup" | "recovery" | "verify" }) {
  if (variant === "signup" || variant === "login") {
    return (
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute -inset-x-6 -inset-y-8 -z-10 rounded-[32px] bg-[radial-gradient(80%_70%_at_30%_20%,rgba(255,255,255,0.85),rgba(255,255,255,0)_70%)]"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          {variant === "login" ? "One library" : "What you get"}
        </p>
        <p className="mt-3 text-[26px] font-extrabold leading-[1.16] tracking-[-0.045em] text-ink">
          Your files.
          <br />
          Your world.
          <br />
          <span className="text-primary">One simple place.</span>
        </p>

        <ul className="mt-7 space-y-3.5">
          {[
            "10 GB free, shared across every device you sign in on",
            "Folders, search, sharing and trash recovery from day one",
            "No credit card, and nothing to cancel if you leave",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-text">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#EAF8F0]">
                <Check className="h-2.5 w-2.5 text-[#1B6B45]" strokeWidth={3.2} aria-hidden="true" />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-[var(--brand-border)] bg-white/70 p-3.5">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
          <p className="text-[11.5px] leading-relaxed text-text-muted">
            Encrypted in transit and at rest.{" "}
            <Link href="/security" className="font-semibold text-primary underline-offset-2 hover:underline">
              How your data is handled
            </Link>
            <ArrowRight className="ml-1 inline h-3 w-3 -translate-y-px" aria-hidden="true" />
          </p>
        </div>
      </div>
    );
  }

  return null;
}

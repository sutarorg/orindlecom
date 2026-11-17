import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Confirm your email",
  description: "Confirm your email address to finish setting up your Orindle account.",
  path: "/verify-email",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Email verification.
 *
 * Two situations land here: right after signup (we know the address, so it is
 * prefilled) and from an expired confirmation link (we don't, so the field is
 * blank). The confirmation itself always happens through `/auth/callback` with
 * a real token — this page never marks anything verified on its own.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; resent?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.slice(0, 254) : "";
  /*
   * Two different diagnoses, deliberately not merged.
   *
   * `link_expired` means the auth server rejected the token itself — the one case
   * where "expired or already used" is true. `session_missing` means the token was
   * accepted but no session could be created (a `?code=` link opened without its
   * PKCE verifier cookie, or after the flow state's 300-second window). Telling
   * that second visitor their link expired is what produced the original report,
   * and it sent them to request a replacement when the fix was simply to sign in.
   */
  const expired = params.error === "link_expired";
  const alreadyConfirmed = params.error === "session_missing";
  // Set when sign-in was refused because the address was never confirmed. The link
  // has just been re-sent, so the card says so instead of leaving them to guess.
  const resent = params.resent === "1";

  return (
    <AuthLayout
      footer={
        <>
          Wrong address?{" "}
          <Link
            href="/signup"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Start again
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow="One step left"
        title="Confirm your email address"
        description={
          email
            ? `We sent a confirmation link to ${email}. Open it to activate your account.`
            : "We sent a confirmation link when you signed up. Open it to activate your account."
        }
      >
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-canvas)] px-3.5 py-3">
          <MailCheck className="mt-px h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
          <div className="text-[12px] leading-relaxed text-text">
            <p className="font-semibold text-ink">The link works once</p>
            <p className="mt-0.5 text-text-muted">
              Open it to finish signing in. Until you confirm, your library stays empty and you
              can&apos;t sign in.
            </p>
          </div>
        </div>

        {resent && (
          <div className="mb-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-primary-soft)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--brand-primary-ink)]">
            <p className="font-semibold">A new confirmation link is on its way.</p>
            <p className="mt-1">
              Your previous link no longer works. Open the newest one to finish signing in.
            </p>
          </div>
        )}

        {alreadyConfirmed && (
          <div className="mb-5 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-primary-soft)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--brand-primary-ink)]">
            <p className="font-semibold">Your address is most likely confirmed already.</p>
            <p className="mt-1">
              The link was accepted, but this browser couldn&apos;t finish signing you in — that
              happens when the link is opened on a different device, or a while after signing up.
              Sign in with your password and you&apos;re done. If signing in says the address
              isn&apos;t confirmed, request a fresh link below.
            </p>
          </div>
        )}

        {expired && (
          <div className="mb-5 rounded-xl border border-[#F3DFB8] bg-[#FEF9EE] px-3.5 py-3 text-[12px] leading-relaxed text-[#8A5A12]">
            <p className="font-semibold">That link has expired or was already used.</p>
            <p className="mt-1">Request a fresh one below — the old link stops working.</p>
          </div>
        )}

        <ResendVerificationForm defaultEmail={email} />

        <p className="mt-5 border-t border-[var(--brand-border-soft)] pt-4 text-[11.5px] leading-relaxed text-text-subtle">
          Nothing arrived? Check the spam folder first — first-time senders often land there. Still
          nothing after a few minutes, write to{" "}
          <a href="mailto:tejassutar.business@gmail.com" className="font-medium text-primary hover:underline">
            tejassutar.business@gmail.com
          </a>
          .
        </p>
      </AuthCard>
    </AuthLayout>
  );
}

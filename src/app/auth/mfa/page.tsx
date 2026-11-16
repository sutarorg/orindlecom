import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthAside } from "@/components/auth/auth-aside";
import { MfaChallengeForm } from "@/components/security/mfa-challenge-form";
import { getAuthService, isAuthConfigured } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { readOwnSecurity } from "@/lib/security/account-security";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Two-factor verification",
  description: "Enter the code from your authenticator app.",
  path: "/auth/mfa",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * The second-factor challenge screen.
 *
 * Reachable only with a session that is *one* factor in and needs a second. Every
 * other state is redirected:
 *
 *   - no session            → sign in
 *   - no enrolled factor    → onward (nothing to challenge)
 *   - already at aal2       → onward (nothing left to prove)
 *
 * That last one is what stops this page becoming a soft lock: after a successful
 * challenge the session is AAL2, so a back-button return here skips straight to
 * the destination instead of asking for another code.
 */
export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? null, "/dashboard");

  if (!isAuthConfigured()) redirect("/login?error=not_configured");

  const service = getAuthService();
  const session = await service.getCurrentSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const state = await service.mfaState();
  if (!state.ok) {
    // A provider failure must not become a bypass. Send them to sign in again,
    // where the challenge will be re-issued.
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (state.data.nextLevel !== "aal2" || state.data.factors.length === 0) {
    redirect(next);
  }
  if (state.data.currentLevel === "aal2") {
    redirect(next);
  }

  // A Google account that still owes a password finishes onboarding first; the
  // challenge does not supersede it.
  const security = await readOwnSecurity();
  if (security.passwordSetupRequired) {
    redirect(`/auth/set-password?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthLayout
      aside={<AuthAside variant="login" />}
      footer={
        <>
          Lost your authenticator?{" "}
          <a
            href="/contact"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Get help recovering your account
          </a>
        </>
      }
    >
      <AuthCard
        eyebrow="Two-factor"
        title="Enter your authenticator code"
        description="Open your authenticator app and type the six-digit code for Orindle."
      >
        <MfaChallengeForm next={next} email={session.user.email} />
      </AuthCard>
    </AuthLayout>
  );
}

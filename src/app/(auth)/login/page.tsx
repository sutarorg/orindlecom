import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Divider } from "@/components/auth/divider";
import { AuthAside } from "@/components/auth/auth-aside";
import { Alert } from "@/components/auth/alert";
import {
  enabledOAuthProviders,
  getAuthService,
  isAuthConfigured,
} from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { pageMetadata } from "@/lib/seo";

/**
 * Codes the callback route can attach to `?error=`. Each is rendered as a
 * sentence a person can act on; an unrecognised code renders nothing rather
 * than a bare token.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled. Nothing changed on your account.",
  mfa_required: "Enter the code from your authenticator app to finish signing in.",
  callback_failed: "That sign-in link didn’t work. Please sign in again below.",
  link_expired: "That link has expired. Sign in below, or request a new one.",
  session_missing: "Your address is most likely confirmed already — the link just couldn’t sign you in on this device. Sign in below.",
  network: "We couldn’t reach the server. Check your connection and try again.",
  rate_limited: "Too many attempts just now. Wait a minute and try again.",
  not_configured: "Accounts aren’t connected on this deployment yet.",
};

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Sign in to Orindle to reach your files from any device.",
  path: "/login",
  noIndex: true,
});

// Session state is per-visitor; never prerender this.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeRedirectPath(params.next) : undefined;
  const configured = isAuthConfigured();
  const providers = enabledOAuthProviders();

  /*
   * Already signed in? Go where they were going.
   *
   * This is what made `/login?next=/auth/set-password` render a sign-in form for
   * someone who was already signed in — a dead end, because the form's own submit
   * would then have to redirect them onward anyway. Their `next` is honoured, and
   * `/auth/set-password` re-checks the onboarding flag itself, so this cannot be
   * used to skip the Set Password gate.
   *
   * No `next` means the normal post-sign-in destination is resolved on the way out
   * of the sign-in action, not here; an already-authenticated visitor with no
   * target goes to `/dashboard`, which is also what that action would choose for a
   * brand-new account.
   */
  if (configured) {
    const session = await getAuthService().getCurrentSession();
    if (session) {
      redirect(next ?? "/dashboard");
    }
  }

  /**
   * `not_configured` is deliberately not rendered as a callback error here.
   *
   * The page already shows a banner for that exact situation when `configured`
   * is false, and the callback route redirects here with that code when
   * `/auth/set-password` or `/auth/mfa` is reached on a deployment with no
   * Supabase credentials. Rendering both produced the same sentence twice on one
   * screen, once in amber and once in red — caught by the visual gate rather than
   * by reading the code.
   */
  const callbackError =
    params.error && params.error !== "not_configured" ? CALLBACK_ERRORS[params.error] : undefined;

  return (
    <AuthLayout
      aside={<AuthAside variant="login" />}
      footer={
        <>
          New to Orindle?{" "}
          <Link
            href="/signup"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Create a free account
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow="Welcome back"
        title="Sign in to your files"
        description="Everything you saved is where you left it — on every device you use."
      >
        {!configured && (
          <div className="mb-5 rounded-xl border border-[#F3DFB8] bg-[#FEF9EE] px-3.5 py-3 text-[12px] leading-relaxed text-[#8A5A12]">
            <p className="font-semibold">Accounts aren&apos;t connected on this deployment yet.</p>
            <p className="mt-1">
              You can fill this form in, but submitting it will tell you the same thing rather than
              pretend to sign you in.
            </p>
          </div>
        )}

        {params.deleted === "1" && (
          <div className="mb-5">
            <Alert tone="info">
              Your account is scheduled for deletion. Nothing has been removed, and signing
              in now cancels it.
            </Alert>
          </div>
        )}

        {callbackError && (
          <div className="mb-5">
            <Alert tone={params.error === "oauth_denied" ? "info" : "error"}>{callbackError}</Alert>
          </div>
        )}

        {providers.length > 0 && (
          <div className="mb-5 space-y-4">
            <SocialSignIn providers={providers} next={next} />
            <Divider>or</Divider>
          </div>
        )}

        <Suspense fallback={null}>
          <LoginForm next={next} />
        </Suspense>
      </AuthCard>
    </AuthLayout>
  );
}

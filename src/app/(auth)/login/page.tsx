import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Divider } from "@/components/auth/divider";
import { AuthAside } from "@/components/auth/auth-aside";
import { Alert } from "@/components/auth/alert";
import { enabledOAuthProviders, isAuthConfigured } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { pageMetadata } from "@/lib/seo";

/**
 * Codes the callback route can attach to `?error=`. Each is rendered as a
 * sentence a person can act on; an unrecognised code renders nothing rather
 * than a bare token.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled. Nothing changed on your account.",
  callback_failed: "That sign-in link didn’t work. Please sign in again below.",
  link_expired: "That link has expired. Sign in below, or request a new one.",
  session_missing: "We couldn’t confirm that session. Please sign in again.",
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
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeRedirectPath(params.next) : undefined;
  const callbackError = params.error ? CALLBACK_ERRORS[params.error] : undefined;
  const configured = isAuthConfigured();
  const providers = enabledOAuthProviders();

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

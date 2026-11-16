import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Divider } from "@/components/auth/divider";
import { AuthAside } from "@/components/auth/auth-aside";
import { enabledOAuthProviders, isAuthConfigured } from "@/lib/auth/service";
import { pageMetadata } from "@/lib/seo";
import { PLANS } from "@/config/pricing";

export const metadata: Metadata = pageMetadata({
  title: "Create your account",
  description: "Create a free Orindle account with 10 GB of storage. No credit card required.",
  path: "/signup",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const params = await searchParams;
  // Only echo a plan we actually sell; an arbitrary query string should not end
  // up rendered next to the form.
  const plan = PLANS.find((candidate) => candidate.id === params.plan)?.id;
  const configured = isAuthConfigured();
  const providers = enabledOAuthProviders();

  return (
    <AuthLayout
      aside={<AuthAside variant="signup" />}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow={plan ? "Free account" : "Get started"}
        title="Start with 10 GB free"
        description={
          plan
            ? "Create the account first — you can move to a paid plan whenever you're ready."
            : "One account, one library, every device. No credit card required."
        }
      >
        {!configured && (
          <div className="mb-5 rounded-xl border border-[#F3DFB8] bg-[#FEF9EE] px-3.5 py-3 text-[12px] leading-relaxed text-[#8A5A12]">
            <p className="font-semibold">Accounts aren&apos;t connected on this deployment yet.</p>
            <p className="mt-1">
              The form works, but submitting it will tell you the same thing rather than create
              anything.
            </p>
          </div>
        )}

        {providers.length > 0 && (
          <div className="mb-5 space-y-4">
            <SocialSignIn providers={providers} />
            <Divider>or</Divider>
          </div>
        )}

        <SignupForm plan={plan} />
      </AuthCard>
    </AuthLayout>
  );
}

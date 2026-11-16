import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/auth/alert";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAuthService } from "@/lib/auth/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Choose a new password",
  description: "Set a new password for your Orindle account.",
  path: "/reset-password",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Reset password.
 *
 * Guarded on the server: `updateUser({ password })` needs a live session, and a
 * recovery link is the only thing that creates one without a password. If there
 * is no session the visitor gets an honest expired-link state instead of a form
 * that fails on submit.
 */
export default async function ResetPasswordPage() {
  const session = await getAuthService().getCurrentSession();

  return (
    <AuthLayout
      footer={
        <>
          Need a new link?{" "}
          <Link
            href="/forgot-password"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Request another
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow="Almost there"
        title={session ? "Choose a new password" : "This link has expired"}
        description={
          session
            ? "Pick something you haven't used here before. You'll stay signed in on this device."
            : undefined
        }
      >
        {session ? (
          <ResetPasswordForm />
        ) : (
          <div className="space-y-4">
            <Alert tone="warning" title="We couldn't verify this reset link">
              Links are single-use and expire after an hour. That usually means it was already used,
              or it was opened in a different browser from the one that requested it.
            </Alert>
            <Link
              href="/forgot-password"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[14px] font-semibold text-white shadow-[var(--brand-shadow-primary)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Request a new link
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

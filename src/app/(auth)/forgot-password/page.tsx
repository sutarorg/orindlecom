import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Reset your password",
  description: "Request a password reset link for your Orindle account.",
  path: "/forgot-password",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow="Password help"
        title="Reset your password"
        description="Enter the email address on your account and we'll send a link to choose a new password."
      >
        <ForgotPasswordForm />

        <p className="mt-5 border-t border-[var(--brand-border-soft)] pt-4 text-[11.5px] leading-relaxed text-text-subtle">
          The link works once and expires after an hour. For your safety we don&apos;t say whether an
          address has an account.
        </p>
      </AuthCard>
    </AuthLayout>
  );
}

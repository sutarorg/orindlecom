import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthAside } from "@/components/auth/auth-aside";
import { SetPasswordForm } from "@/components/security/set-password-form";
import { getAuthService, isAuthConfigured } from "@/lib/auth/service";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { readOwnSecurity } from "@/lib/security/account-security";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Set a password",
  description: "Finish setting up your Orindle account.",
  path: "/auth/set-password",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * The Set Password step, at the path the requirements specify.
 *
 * This route is a *gate*, not a suggestion: every branch below either renders the
 * form or sends the visitor somewhere they are genuinely allowed to be. There is
 * no path from here to the dashboard that skips the form while the flag is set.
 *
 * The same route serves three situations, which is why the copy adapts:
 *   - first-time Google signup (the normal case),
 *   - resuming after the browser was closed mid-onboarding,
 *   - a stale bookmark after setup is already complete, which redirects onward.
 *
 * It lives under `/auth` rather than in the `(auth)` route group because that is
 * the URL the requirement names; the group exists only to share a layout.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next ?? null, "/dashboard");

  if (!isAuthConfigured()) {
    redirect("/login?error=not_configured");
  }

  const session = await getAuthService().getCurrentSession();
  if (!session) {
    /*
     * Not an error page: someone who closes the browser mid-onboarding and comes
     * back later should simply land on sign-in and then be returned here.
     *
     * The inner `next` is carried through as well as the outer one, so a visitor
     * who was on their way to `/dashboard/files` finishes onboarding and lands
     * there rather than at the dashboard root. Both are validated by
     * `safeRedirectPath` on the way back in, and `/auth` is an allowed prefix.
     */
    const back = `/auth/set-password?next=${encodeURIComponent(next)}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const security = await readOwnSecurity();

  // Already done. Re-showing the form would be the "repeatedly prompt after the
  // password has been configured" failure the requirements name.
  if (!security.passwordSetupRequired) {
    redirect(next);
  }

  const firstName = session.user.fullName?.trim().split(/\s+/)[0] ?? null;

  return (
    <AuthLayout
      aside={<AuthAside variant="login" />}
      footer={
        <>
          Wrong account?{" "}
          <Link
            href="/login"
            className="rounded font-semibold text-primary underline-offset-4 transition-colors hover:text-primary-ink hover:underline"
          >
            Sign in with a different one
          </Link>
        </>
      }
    >
      <AuthCard
        eyebrow={firstName ? `Almost there, ${firstName}` : "Almost there"}
        title="Set a password for your account"
        description="Create a password so you can also sign in to Orindle using your email address."
      >
        <SetPasswordForm next={next} email={session.user.email} />
      </AuthCard>
    </AuthLayout>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { signOutAction } from "@/app/(auth)/actions";
import { getAuthService } from "@/lib/auth/service";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Your account",
  description: "Your Orindle account.",
  path: "/account",
  noIndex: true,
});

export const dynamic = "force-dynamic";

/**
 * Account landing page.
 *
 * This exists so the auth flows have somewhere real to arrive: a successful
 * sign-in, an OAuth callback and a confirmed email all land here. It is a
 * placeholder for the product shell (PROMPT 3), not a dashboard — it shows the
 * confirmed identity and nothing else, and does not pretend to have a file
 * library behind it.
 */
export default async function AccountPage() {
  const session = await getAuthService().getCurrentSession();

  if (!session) redirect("/login?next=/account");

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(110%_70%_at_20%_-10%,rgba(231,226,253,0.7),rgba(231,226,253,0)_60%),radial-gradient(90%_60%_at_90%_0%,rgba(223,244,242,0.6),rgba(223,244,242,0)_65%)]"
      />
      <header className="container-or flex h-[var(--brand-header-height)] items-center justify-between">
        <Link href="/" aria-label="Orindle home">
          <Wordmark />
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--brand-border-strong)] bg-white px-3 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[var(--brand-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </header>

      <main id="main" className="container-or py-10">
        <div className="mx-auto max-w-[560px] rounded-[20px] border border-[var(--brand-border)] bg-white p-6 shadow-[var(--brand-shadow-md)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Signed in</p>
          <h1 className="mt-2.5 text-[22px] font-extrabold leading-tight tracking-[-0.035em] text-ink">
            {session.user.fullName ? `Hello, ${session.user.fullName.split(" ")[0]}.` : "You're signed in."}
          </h1>
          <dl className="mt-5 space-y-2.5 border-t border-[var(--brand-border-soft)] pt-4 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Email</dt>
              <dd className="truncate font-medium text-ink">{session.user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Email confirmed</dt>
              <dd className="font-medium text-ink">{session.user.emailConfirmed ? "Yes" : "Not yet"}</dd>
            </div>
          </dl>

          <p className="mt-6 rounded-xl border border-[var(--brand-border)] bg-[var(--brand-canvas)] px-3.5 py-3 text-[12px] leading-relaxed text-text-muted">
            The file library itself isn&apos;t built yet — this page confirms your identity and
            nothing more. Nothing you upload is stored here.
          </p>
        </div>
      </main>
    </div>
  );
}

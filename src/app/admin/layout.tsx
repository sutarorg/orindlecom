/**
 * Admin layout — the authorization boundary for the whole console.
 *
 * This runs before any admin page renders, so a page component never has to
 * remember to check. That is the same argument the dashboard's middleware gate is
 * built on: a per-page check means the page that forgets is the hole.
 *
 * `requirePlatformAdmin` throws, and `redirect` turns an authenticated non-admin
 * away without rendering anything. Note the split:
 *
 *   - no session      → /login?next=/admin (they can fix that)
 *   - not an admin    → /access-denied, a page outside this segment that says
 *                        nothing about what is behind it (they cannot fix that,
 *                        and should not learn that it exists)
 *
 * Middleware also gates `/admin` (see src/middleware.ts) — but middleware is a
 * convenience, not the boundary. It cannot see `platform_admins`, and a matcher
 * change would silently remove it. The check here is the one that counts.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { resolvePlatformAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: {
    default: "Administration — Orindle",
    template: "%s — Orindle Admin",
  },
  // Belt and braces with robots.txt: a disallowed URL can still be indexed if it
  // is linked from somewhere, and `noindex` is the only thing that stops that.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const result = await resolvePlatformAdmin();

  if (!result.ok) {
    if (result.code === "unauthenticated") redirect("/login?next=/admin");
    if (result.code === "email_unverified") redirect("/verify-email?next=/admin");

    /*
     * `not_configured` is its own case, and it matters.
     *
     * On a deployment with no Supabase credentials there is no account system at
     * all, so "your account doesn't have administration access" would be a
     * statement about an account that cannot exist. The refusal page varies its
     * copy for that case.
     *
     * Everything else — a disabled administrator, an ordinary customer, a read
     * failure — gets the identical page. Those must be indistinguishable.
     */
    if (result.code === "not_configured") redirect("/access-denied?reason=not-configured");

    redirect("/access-denied");
  }

  return (
    <AdminShell admin={{ email: result.admin.email, role: result.admin.role }}>
      {children}
    </AdminShell>
  );
}

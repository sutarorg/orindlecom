/**
 * Where a customer goes after signing in.
 *
 * The requirement is specific: no more `/account` chooser. A first-time signup goes
 * straight to `/dashboard`; a returning customer goes back to the workspace they
 * were last in — `/dashboard` or `/business` — and to the page inside it if that is
 * still knowable.
 *
 * ── Why the client's path is not trusted ────────────────────────────────────
 *
 * `last_path` is written from a value the browser sends. Redirecting to it without
 * validation is an open redirect: `?next=https://evil.example` or a `//host` path
 * would send a freshly-authenticated customer straight to someone else's page, with
 * the login they just completed as the convincer. Two independent checks apply —
 * one when storing, one when redirecting — because a database value written by an
 * older or buggier client is still a value reaching a `redirect()`.
 *
 * `/account` is deliberately absent from the allow-list: it is exactly the page this
 * behaviour exists to stop sending people to.
 */

import "server-only";

import { createSupabaseServerClient } from "@/lib/auth/supabase/server";

export type WorkspaceKind = "personal" | "business";

/** The two workspaces, and the only prefixes a stored path may have. */
const WORKSPACE_ROOT: Record<WorkspaceKind, string> = {
  personal: "/dashboard",
  business: "/business",
};

/** Pages that are not a sensible "where you left off" landing. */
const NON_LANDING_PATHS = new Set([
  "/dashboard/profile",
  "/business/settings",
]);

/**
 * Reduce a candidate path to a safe one, or null.
 *
 * Rejects absolute URLs, protocol-relative paths (`//host`), backslash tricks
 * (`/\host` is treated as `//host` by some browsers), embedded newlines, and
 * anything outside the two workspace roots.
 */
export function sanitizeWorkspacePath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (!path || path.length > 512) return null;

  // Must be a rooted, single-slash path. `//` and `/\` are host-relative.
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return null;
  // Control characters can terminate a header or a URL in some clients.
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;

  // Query and hash are dropped: a filtered view is fine to restore, but a
  // `?invite=` token or a `#` fragment is not something to replay on sign-in.
  const withoutSuffix = path.split(/[?#]/)[0];
  if (!withoutSuffix) return null;

  const roots = Object.values(WORKSPACE_ROOT);
  if (!roots.some((root) => withoutSuffix === root || withoutSuffix.startsWith(`${root}/`))) {
    return null;
  }

  if (NON_LANDING_PATHS.has(withoutSuffix)) return null;

  return withoutSuffix;
}

/** Which workspace a path belongs to, or null when it is neither. */
export function workspaceForPath(path: string): WorkspaceKind | null {
  if (path === WORKSPACE_ROOT.personal || path.startsWith(`${WORKSPACE_ROOT.personal}/`)) {
    return "personal";
  }
  if (path === WORKSPACE_ROOT.business || path.startsWith(`${WORKSPACE_ROOT.business}/`)) {
    return "business";
  }
  return null;
}

export interface LastWorkspace {
  workspace: WorkspaceKind | null;
  path: string | null;
}

/**
 * Read the stored preference for the current session.
 *
 * Returns empty values on any failure rather than throwing: a dashboard redirect is
 * not worth failing a login over, and RLS already scopes this to the caller's row.
 */
export async function readLastWorkspace(): Promise<LastWorkspace> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { workspace: null, path: null };

    const { data } = await supabase
      .from("profiles")
      .select("last_workspace, last_path")
      .eq("id", user.user.id)
      .maybeSingle();

    const workspace =
      data?.last_workspace === "business" || data?.last_workspace === "personal"
        ? (data.last_workspace as WorkspaceKind)
        : null;

    return { workspace, path: sanitizeWorkspacePath(data?.last_path) };
  } catch {
    return { workspace: null, path: null };
  }
}

/** Persist the preference for the current session. Silent on failure by design. */
export async function rememberWorkspace(path: string): Promise<void> {
  const safe = sanitizeWorkspacePath(path);
  if (!safe) return;
  const workspace = workspaceForPath(safe);
  if (!workspace) return;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    await supabase
      .from("profiles")
      .update({ last_workspace: workspace, last_path: safe })
      .eq("id", user.user.id);
  } catch {
    // Losing this degrades to "sign in at /dashboard", which is the old default.
  }
}

/**
 * The destination for a signed-in customer with no explicit `next`.
 *
 * A first-time account has no stored preference, and lands on `/dashboard` — the
 * "after signing up, go straight to the dashboard" half of the requirement.
 */
export function destinationFor(last: LastWorkspace): string {
  if (last.path) return last.path;
  if (last.workspace === "business") return WORKSPACE_ROOT.business;
  return WORKSPACE_ROOT.personal;
}

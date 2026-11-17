/**
 * The dashboard's viewer.
 *
 * With authentication configured this comes from the session. With none
 * configured, the dashboard still needs to render so the interface can be
 * built and reviewed — so this returns a clearly-labelled placeholder identity
 * rather than bouncing every route to the login screen.
 *
 * The placeholder is deliberately not a realistic-looking person: a name like
 * "Tejas Sutar" would be indistinguishable from a real account in a screenshot.
 * "Your account" reads as a placeholder at a glance.
 */

import { cache } from "react";
import { getAuthService } from "@/lib/auth/service";

export interface Viewer {
  name: string;
  email: string;
  initials: string;
  /** True when this is a real signed-in account rather than the placeholder. */
  authenticated: boolean;
}

const PLACEHOLDER: Viewer = {
  name: "Your account",
  email: "Not signed in",
  initials: "OR",
  authenticated: false,
};

/**
 * The signed-in viewer, resolved at most once per request.
 *
 * `getCurrentSession()` validates the token with the auth server (`getUser()`),
 * which is a real network round trip — it is not a local cookie read. Because both
 * the dashboard layout and the dashboard page call this, an uncached version made
 * every dashboard navigation wait on two identical auth round trips in series
 * before any content could render.
 *
 * React's `cache` keys on the request, so the second caller in the same render
 * gets the first result for free. This is the same treatment `resolveActor` already
 * gets, for the same reason.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getAuthService().getCurrentSession();
  if (!session) return PLACEHOLDER;

  const name = session.user.fullName?.trim() || session.user.email.split("@")[0] || "Your account";
  const parts = name.split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  return {
    name,
    email: session.user.email,
    initials,
    authenticated: true,
  };
});

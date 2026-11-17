"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll to the top on every route change, and remember where the customer is.
 *
 * ── Why this is needed on top of Next's own behaviour ─────────────────────
 *
 * Next does scroll to the top on navigation, but only when it judges the new page to
 * be a fresh "page" navigation. Two situations defeat it in practice:
 *
 *   1. **A global `scroll-behavior: smooth`.** The reset becomes a long animation
 *      rather than an instant jump, and any layout shift during the animation leaves
 *      it stranded part-way (see globals.css). Fixed there; this guards the rest.
 *   2. **The scroll container is not yet tall enough.** When the departing page is
 *      tall and the arriving one is still streaming, the browser clamps `scrollTo`
 *      to the new document height and then *grows* under the retained offset. The
 *      visitor lands mid-page once the content arrives.
 *
 * ── What it deliberately does not do ──────────────────────────────────────
 *
 * It does not fight the back button. A route with a hash (`/pricing#plans`) is left
 * to the browser so an in-page anchor still jumps to its section, and a
 * `popstate`-driven restore is left alone: someone returning to a long article with
 * Back expects their previous position. Both are checked before scrolling.
 *
 * It is `useLayoutEffect`-free on purpose — it runs after paint so it never blocks
 * the first frame of the new page, which matters for the load-time requirement.
 *
 * ── Remembering the workspace ─────────────────────────────────────────────
 *
 * The same effect reports the current in-app path so a returning customer can be
 * sent back to it at sign-in instead of to a chooser page. It is piggy-backed here
 * rather than in a second component because this already runs on exactly the event
 * that matters — a pathname change — and mounting a second `usePathname` watcher to
 * observe the same thing would run two effects on every navigation.
 *
 * Only `/dashboard` and `/business` paths are reported, and the report is fire-and-
 * forget: a dropped beacon degrades the landing page to `/dashboard`, which is not
 * worth showing an error for.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const previous = React.useRef<string | null>(null);

  React.useEffect(() => {
    const first = previous.current === null;
    const changed = previous.current !== null && previous.current !== pathname;
    previous.current = pathname;

    // First mount: leave the browser alone (a deep link into a #section must work,
    // and a refresh should restore the position the visitor had).
    if (first) return;

    // A deliberate anchor jump is the browser's job.
    if (window.location.hash) return;

    // Same path, different query is still a new view for our purposes; Next does
    // not scroll on that either, and a filtered list should start at the top.
    if (!changed && !window.location.search) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  // Report where the customer is, so sign-in can return them here.
  React.useEffect(() => {
    if (!pathname.startsWith("/dashboard") && !pathname.startsWith("/business")) return;
    if (pathname === "/dashboard/profile") return;

    const controller = new AbortController();
    void fetch("/api/session/last-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      // Best effort; the landing page falls back to /dashboard.
    });

    return () => controller.abort();
  }, [pathname]);

  return null;
}

/**
 * Cookie adjustments Supabase's SSR helper can't express.
 *
 * The helper always writes auth cookies with `maxAge`, which makes every
 * session a persistent one. "Remember me" unchecked should give a cookie that
 * dies with the browser, so we rewrite the expiry of whatever auth cookies the
 * provider just set.
 */

import "server-only";

import { cookies } from "next/headers";

export async function shortenAuthCookiesToSession() {
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    store.set(cookie.name, cookie.value, {
      // Omitting maxAge/expires makes it a session cookie.
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: cookie.name.includes("auth-token") ? false : true,
    });
  }
}

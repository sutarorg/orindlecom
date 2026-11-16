import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Request middleware.
 *
 * Two jobs, in this order:
 *
 *   1. **Refresh the session and gate the dashboard.** Previously this file only
 *      set a region cookie, which meant `/dashboard/**` rendered for an anonymous
 *      visitor with a placeholder identity. That was defensible while no real data
 *      existed; now that it does, an unauthenticated request must not reach it.
 *
 *   2. **Region detection for display currency.** Unchanged: this only chooses the
 *      currency a first-time visitor sees. It never rewrites a subscriber's
 *      billing currency, which is fixed at subscription time.
 *
 * The auth check is deliberately soft: with no Supabase credentials configured the
 * middleware does nothing, so the site still renders and every screen explains
 * that accounts aren't connected. A hard gate would make the deployment
 * unreviewable.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** Routes that require a session. */
const PROTECTED_PREFIXES = ["/dashboard", "/account"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * API routes that authenticate by some other means and must not be redirected.
 *
 * A webhook is called by Razorpay, not a browser; a cron job is called by Vercel.
 * Both authenticate themselves (signature / bearer secret) and a redirect would
 * break them silently.
 */
const SELF_AUTHENTICATING = ["/api/webhooks/", "/api/cron/", "/api/auth/", "/api/health"];

function isSelfAuthenticating(pathname: string): boolean {
  return SELF_AUTHENTICATING.some((prefix) => pathname.startsWith(prefix));
}

/** Cached per-request lookup: the same account is checked at most once. */
async function needsPasswordSetup(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("account_security")
      .select("password_setup_required")
      .eq("user_id", userId)
      .maybeSingle();
    return Boolean(data?.password_setup_required);
  } catch {
    // Fail open; see the note at the call site.
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // A response we can attach refreshed cookies to. If we end up redirecting, the
  // cookies are carried onto the redirect so the session survives it.
  let response = NextResponse.next({ request });

  const { pathname, search } = request.nextUrl;
  const needsAuth = isProtected(pathname) || (isApi(pathname) && !isSelfAuthenticating(pathname));

  if (needsAuth && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser() validates the token with the auth server. getSession() would
    // trust the cookie's contents, which is exactly what a forged cookie relies on.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (isApi(pathname)) {
        // An API client needs to know why, not to receive an HTML login page.
        return NextResponse.json(
          {
            ok: false,
            code: "unauthenticated",
            message: "You need to sign in to do that.",
          },
          { status: 401 },
        );
      }

      const login = request.nextUrl.clone();
      login.pathname = "/login";
      login.search = "";
      // Remember where they were going so sign-in returns them there. The path is
      // validated server-side on the way back out, so this cannot become an open
      // redirect.
      login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }

    /**
     * Onboarding gate.
     *
     * A Google-created account that has not set a password may not reach the
     * dashboard. This is checked here, in middleware, because it has to hold for
     * every route at once — including a bookmarked `/dashboard/files` — and doing
     * it per-page means the one page that forgets is the hole.
     *
     * The flag is read from `account_security` over the *user-scoped* client, so
     * RLS applies and a token cannot be used to read another account's row.
     *
     * Failing open on a read error is deliberate: a database blip must not lock
     * every Google user out of their files. The page-level redirect still applies
     * when the read succeeds.
     */
    if (!isApi(pathname) && pathname !== "/auth/set-password") {
      if (await needsPasswordSetup(supabase, user.id)) {
        const setup = request.nextUrl.clone();
        setup.pathname = "/auth/set-password";
        setup.search = "";
        setup.searchParams.set("next", `${pathname}${search}`);
        return NextResponse.redirect(setup);
      }
    }
  }

  // ── Region detection for display currency ────────────────────────────────
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    request.headers.get("x-country-code");

  if (country && !request.cookies.get("orindle_region")) {
    response.cookies.set("orindle_region", country.toUpperCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts|art|favicon).*)"],
};

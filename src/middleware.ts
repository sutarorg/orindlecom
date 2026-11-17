import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Request middleware.
 *
 * Refreshes the Supabase session and gates private routes (`/dashboard/**`,
 * `/admin/**`, `/account`) so unauthenticated or unverified requests cannot
 * reach customer data. Pricing currency is resolved directly on the server from
 * edge geolocation headers (see `src/lib/geo/currency.ts`), never from a
 * client-writable cookie.
 *
 * The auth check is deliberately soft: with no Supabase credentials configured the
 * middleware does nothing, so the site still renders and every screen explains
 * that accounts aren't connected. A hard gate would make the deployment
 * unreviewable.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/**
 * Routes that require a session.
 *
 * `/admin` is here for the redirect-to-login behaviour — an anonymous visitor
 * should land on the sign-in page, not a JSON 401 or an unstyled error.
 *
 * **Middleware is not the authorization boundary for /admin.** It cannot read
 * `platform_admins`, so it can only answer "is there a session", which is not the
 * question. The real check is `requirePlatformAdmin()` in
 * `src/app/admin/layout.tsx` and again in every route under `/api/admin/`. This
 * line exists so the *anonymous* case produces a sensible redirect, and nothing
 * more.
 */
/*
 * `/business` is the team workspace (it used to live under `/dashboard/business`).
 * It must be listed here in its own right: the move took it out from under the
 * `/dashboard` prefix, and while the page itself calls the auth service, middleware
 * is what turns an anonymous visit into a login redirect instead of an empty shell.
 * This is a coarse gate only — every business route and `/api/organizations/*`
 * still authorizes the actor on the server.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/account", "/admin", "/business"];

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
    if (
      !isApi(pathname) &&
      pathname !== "/auth/set-password" &&
      // An operator with a pending onboarding step is still an operator. Bouncing
      // them into the Set Password flow mid-incident would be worse than the
      // (owner-approved) administrator row they already hold.
      !pathname.startsWith("/admin")
    ) {
      if (await needsPasswordSetup(supabase, user.id)) {
        const setup = request.nextUrl.clone();
        setup.pathname = "/auth/set-password";
        setup.search = "";
        setup.searchParams.set("next", `${pathname}${search}`);
        return NextResponse.redirect(setup);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts|art|favicon).*)"],
};

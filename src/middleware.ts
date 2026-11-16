import { NextResponse, type NextRequest } from "next/server";

/**
 * Region detection for display currency.
 *
 * Sets `orindle_region` from the CDN's country header so a first-time visitor
 * sees the prices for their region. This only chooses the *display* currency:
 * it never rewrites a subscriber's billing currency, which is fixed at
 * subscription time.
 *
 * A manual choice stored in `orindle_currency` always wins, and the middleware
 * never overwrites it.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

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

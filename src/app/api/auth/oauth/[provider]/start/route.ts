import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/auth/service";
import { resolveOrigin, safeRedirectPath } from "@/lib/auth/redirect";
import type { OAuthProvider } from "@/lib/auth/types";

/**
 * Starts an OAuth handshake.
 *
 * POST-only on purpose: a GET would let any page navigate the visitor into a
 * sign-in flow with `next` pre-set, which is the first half of a login-CSRF.
 * The `next` parameter is validated as a same-origin path before it is used.
 *
 * Returns `{ ok: true, url }` and lets the client navigate. Doing the redirect
 * here would work too, but the client needs the JSON shape to render its own
 * error state when the provider isn't enabled.
 */

export const dynamic = "force-dynamic";

const SUPPORTED: ReadonlyArray<OAuthProvider> = ["google"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!SUPPORTED.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { ok: false, message: "That sign-in method isn't supported." },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { next?: string };
  const next = safeRedirectPath(body.next, "/account");

  const origin = resolveOrigin(request.headers);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", next);

  const result = await getAuthService().startOAuth(provider as OAuthProvider, {
    redirectTo: callbackUrl.toString(),
    next,
  });

  if (!result.ok) {
    const status = result.code === "provider_disabled" ? 400 : result.code === "not_configured" ? 503 : 500;
    return NextResponse.json({ ok: false, code: result.code, message: result.message }, { status });
  }

  return NextResponse.json({ ok: true, url: result.data.url }, { headers: { "Cache-Control": "no-store" } });
}

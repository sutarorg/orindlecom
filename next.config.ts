import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * These were absent entirely until now — the security checklist recorded that gap
 * rather than pretending otherwise, and this closes it.
 *
 * The CSP is the interesting one. It has to allow:
 *   - Supabase's auth endpoints (connect-src), because sign-in is a fetch.
 *   - Cloudflare R2, because uploads go browser→R2 directly and downloads are
 *     presigned URLs on the bucket host.
 *   - `'unsafe-inline'` for styles, because Tailwind/Next inject inline style
 *     attributes that a nonce cannot cover without rewriting the design system.
 *   - No `'unsafe-eval'`: nothing in the app uses it.
 *
 * `frame-ancestors 'none'` and `X-Frame-Options: DENY` are both set. The header is
 * redundant in modern browsers but is what older ones honour, and a storage
 * product being framed is a clickjacking surface worth closing twice.
 */

const supabaseHost = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

/**
 * The R2 origin that browser uploads PUT to.
 *
 * `R2_ENDPOINT` wins, and `R2_ACCOUNT_ID` is only the fallback — the same
 * precedence `src/lib/r2/client.ts` uses. Deriving this from the account id alone
 * was a real bug: a deployment that sets `R2_ENDPOINT` and not `R2_ACCOUNT_ID` (or
 * uses a custom-domain endpoint) got the correct presigned URL from the server but a
 * CSP with no R2 in `connect-src`. The browser then blocked the PUT, and the upload
 * sidebar reported "Network error while uploading directly to storage" — which points
 * at the network rather than at the specific header that caused it.
 *
 * Any host R2 hands back must be reachable, or every upload fails, so this mirrors
 * the server's own resolution rather than approximating it.
 */
const r2Host = (() => {
  const raw = process.env.R2_ENDPOINT?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // A malformed endpoint is the server's problem to report, not a reason to
      // widen CSP.
    }
  }
  const account = process.env.R2_ACCOUNT_ID?.trim();
  return account ? `https://${account}.r2.cloudflarestorage.com` : "";
})();

/**
 * The virtual-hosted origin, `<bucket>.<account>.r2.cloudflarestorage.com`.
 *
 * Not used for uploads — `src/lib/r2/client.ts` pins path-style so every object
 * URL stays on `r2Host`. It is here because it is the form the old code silently
 * produced, and a CSP that omits it turns that mistake into "network error" in the
 * browser rather than an obvious failure. Allowing both means a future change to
 * the SDK's URL style degrades to still-working rather than to every upload failing.
 */
const r2VirtualHostedOrigin = (() => {
  const bucket = process.env.R2_BUCKET?.trim();
  const account = process.env.R2_ACCOUNT_ID?.trim();
  return bucket && account ? `https://${bucket}.${account}.r2.cloudflarestorage.com` : "";
})();

const r2PublicHost = (() => {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const connectSrc = [
  "'self'",
  supabaseHost,
  supabaseHost ? supabaseHost.replace("https://", "wss://") : "",
  r2Host,
  r2VirtualHostedOrigin,
  r2PublicHost,
  "https://api.razorpay.com",
  "https://checkout.razorpay.com",
  "https://challenges.cloudflare.com",
]
  .filter(Boolean)
  .join(" ");

const r2Origins = [r2PublicHost, r2Host, r2VirtualHostedOrigin].filter(Boolean).join(" ");

const csp = [
  "default-src 'self'",
  // Next's runtime, Razorpay checkout, and Cloudflare Turnstile widget.
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://challenges.cloudflare.com",
  // Tailwind and Next emit inline style attributes; a nonce cannot cover them.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${r2Origins}`,
  `media-src 'self' blob: ${r2Origins}`,
  "font-src 'self' data:",
  // Uploads go straight to R2; auth, Turnstile, and payments are fetches.
  `connect-src ${connectSrc}`,
  // Razorpay checkout, Cloudflare Turnstile widget, and signed PDF previews.
  `frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://challenges.cloudflare.com ${r2Origins}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join("; ")
  .replace(/\s+/g, " ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Keeps server actions within a predictable payload size for the contact form.
    serverActions: { bodySizeLimit: "256kb" },
    /*
     * Tried `optimizePackageImports: ["lucide-react"]` here and measured it: the
     * emitted chunks were byte-identical (same hashes, same sizes) and no chunk
     * contained a lucide string, so Turbopack was already tree-shaking the icon
     * imports. Left out rather than kept as a plausible-looking no-op, because a
     * config line that does nothing is a claim that it does something.
     */
  },

  /**
   * `/account` is gone. It was the four-option chooser shown after sign-in, and the
   * only reason to keep it would be to serve a page this change exists to remove.
   *
   * Bookmarks, old emails and documents still point at it, so it redirects rather
   * than 404s. `permanent: false` on purpose: this is a routing decision that may
   * be revisited, and a 308 would be cached by browsers indefinitely.
   */
  async redirects() {
    return [
      { source: "/account", destination: "/dashboard", permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Redundant with frame-ancestors for modern browsers, but honoured by
          // older ones and cheap.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops a browser from guessing that a .txt is really a script. Matters
          // most on the paths that serve user-supplied content.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs a camera, microphone or location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // API responses are never rendered, so the page CSP does not apply; these
        // two still do.
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
